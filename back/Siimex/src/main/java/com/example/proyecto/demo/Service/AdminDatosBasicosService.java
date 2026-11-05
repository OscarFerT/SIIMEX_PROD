package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.*;
import com.example.proyecto.demo.Repository.*;
import com.example.proyecto.demo.dto.AdminDatosBasicos.*;
import com.example.proyecto.demo.exception.ApiException;
import com.example.proyecto.demo.util.CurpValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminDatosBasicosService {
    private final UsuarioRepository usuarios;
    private final AuthUserRepository cuentas;
    private final Registro1Repository registros;
    private final EmailVerificationTokenRepository verificaciones;
    private final AuditLogRepository auditoria;

    @Transactional(readOnly = true)
    public Datos consultar(Long id) { return datos(buscar(id, false)); }

    @Transactional
    public Datos actualizar(Long id, Cambio cambio, Long adminId, String ip) {
        AuthUser admin = cuentas.findById(adminId)
                .filter(a -> a.isEnabled() && !a.isLocked() && a.getRoles().contains("ROLE_ADMIN"))
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Se requiere un administrador activo"));
        Usuario usuario = buscar(id, true);
        Datos antes = datos(usuario);
        if (!antes.revision().equals(cambio.revision())) {
            throw new ApiException(HttpStatus.PRECONDITION_FAILED, "El registro cambio mientras lo editabas. Cierra y vuelve a abrir el formulario.");
        }
        AuthUser cuenta = usuario.getAuthUser();
        Registro1 registro = usuario.getRegistro1();
        List<String> campos = new ArrayList<>();
        agregarCambio(campos, "nombre", antes.nombre(), cambio.nombre());
        agregarCambio(campos, "apellidoPaterno", antes.apellidoPaterno(), cambio.apellidoPaterno());
        agregarCambio(campos, "apellidoMaterno", antes.apellidoMaterno(), cambio.apellidoMaterno());
        agregarCambio(campos, "email", antes.email(), cambio.email());
        agregarCambio(campos, "curp", antes.curp(), cambio.curp());
        agregarCambio(campos, "telefono", antes.telefono(), cambio.telefono());
        agregarCambio(campos, "fechaNacimiento", antes.fechaNacimiento(), cambio.fechaNacimiento());
        agregarCambio(campos, "genero", antes.genero(), cambio.genero());
        agregarCambio(campos, "entidadFederativa", antes.entidadFederativa(), cambio.entidadFederativa());
        if (campos.isEmpty()) return antes;

        boolean cambiaCorreo = campos.contains("email");
        boolean cambiaIdentidad = campos.stream().anyMatch(c -> !Set.of("email", "telefono").contains(c));
        if (cambiaCorreo && (cuentas.existsByEmailIgnoreCaseAndIdNot(cambio.email(), cuenta.getId())
                || cuentas.existsByUsernameIgnoreCaseAndIdNot(cambio.email(), cuenta.getId()))) {
            throw new ApiException(HttpStatus.CONFLICT, "El correo ya esta registrado por otra cuenta");
        }
        boolean correoEsUsername = Objects.equals(cuenta.getUsername(), cuenta.getEmail());
        if (cambiaCorreo && correoEsUsername && cambio.email().length() > 80) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El correo de acceso admite un maximo de 80 caracteres");
        }
        // Existing imported/demo CURPs must not prevent an unrelated contact correction.
        if (cambiaIdentidad) {
            if (!CurpValidator.validarFormato(cambio.curp())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "La estructura de la CURP no es valida");
            }
            CurpValidator.validarCoincidenciaDatosConMensaje(cambio.curp(), cambio.apellidoPaterno(),
                    cambio.apellidoMaterno(), cambio.nombre(), cambio.fechaNacimiento(), cambio.genero(),
                    cambio.entidadFederativa()).ifPresent(error -> { throw new ApiException(HttpStatus.BAD_REQUEST, error); });
        }
        if (campos.contains("curp") && registros.existsByCurpIgnoreCaseAndIdNot(cambio.curp(), usuario.getId())) {
            throw new ApiException(HttpStatus.CONFLICT, "La CURP ya esta registrada por otra persona");
        }

        usuario.setNombre(cambio.nombre());
        usuario.setApellidoPaterno(cambio.apellidoPaterno());
        usuario.setApellidoMaterno(cambio.apellidoMaterno());
        if (cambiaCorreo) {
            if (correoEsUsername) cuenta.setUsername(cambio.email());
            cuenta.setEmail(cambio.email());
            verificaciones.deleteByAuthUser_Id(cuenta.getId());
        }
        registro.setCurp(cambio.curp());
        registro.setTelefono(cambio.telefono());
        registro.setFechaNacimiento(cambio.fechaNacimiento());
        registro.setGenero(Registro1.Genero.valueOf(cambio.genero()));
        registro.setEntidadFederativa(cambio.entidadFederativa());
        if (cambiaCorreo || cambiaIdentidad) cuenta.revokeSessions();
        auditoria.save(AuditLog.builder().categoria(AuditLog.Categoria.ADMIN).accion("EDITAR_DATOS_BASICOS")
                .usuarioId(adminId).usuarioEmail(admin.getEmail()).entidadTipo("Usuario").entidadId(id)
                .ipAddress(ip).detalle("Campos: " + String.join(", ", campos) + ". Motivo: " + cambio.motivo()).build());
        usuarios.flush();
        return datos(usuario);
    }

    private Usuario buscar(Long id, boolean bloquear) {
        Usuario usuario = (bloquear ? usuarios.findForBasicEdit(id) : usuarios.findById(id))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (usuario.getAuthUser() == null || usuario.getRegistro1() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "El usuario no tiene cuenta o registro de identidad asociado");
        }
        return usuario;
    }

    private Datos datos(Usuario u) {
        Registro1 r = u.getRegistro1();
        String nombre = valor(u.getNombre()), paterno = valor(u.getApellidoPaterno()), materno = valor(u.getApellidoMaterno());
        String email = valor(u.getAuthUser().getEmail()), curp = valor(r.getCurp()), telefono = valor(r.getTelefono());
        String genero = r.getGenero() == null ? "" : r.getGenero().name(), entidad = valor(r.getEntidadFederativa());
        String base = String.join("\u0000", u.getId().toString(), nombre, paterno, materno, email, curp, telefono,
                Objects.toString(r.getFechaNacimiento(), ""), genero, entidad);
        try {
            String revision = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(base.getBytes(StandardCharsets.UTF_8)));
            return new Datos(u.getId(), nombre, paterno, materno, email, curp, telefono, r.getFechaNacimiento(), genero, entidad, revision);
        } catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private String valor(String value) { return value == null ? "" : value; }
    private void agregarCambio(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) campos.add(campo);
    }
}
