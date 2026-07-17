package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.Registro1Repository;
import com.example.proyecto.demo.Repository.ArticuloRepository;
import com.example.proyecto.demo.Repository.AreaConocimientoRepository;
import com.example.proyecto.demo.Repository.AuthUserRepository;
import com.example.proyecto.demo.Repository.CongresoRepository;
import com.example.proyecto.demo.Repository.CursoRepository;
import com.example.proyecto.demo.Repository.DocumentoRepository;
import com.example.proyecto.demo.Repository.DivulgacionRepository;
import com.example.proyecto.demo.Repository.EmailVerificationTokenRepository;
import com.example.proyecto.demo.Repository.EstanciaRepository;
import com.example.proyecto.demo.Repository.HerramientaRepository;
import com.example.proyecto.demo.Repository.IdiomaRepository;
import com.example.proyecto.demo.Repository.IncidenciaSocialRepository;
import com.example.proyecto.demo.Repository.InstitucionRepository;
import com.example.proyecto.demo.Repository.InteresHabilidadRepository;
import com.example.proyecto.demo.Repository.LogroRepository;
import com.example.proyecto.demo.Repository.PropiedadIntelectualRepository;
import com.example.proyecto.demo.Repository.TrayectoriaAcademicaRepository;
import com.example.proyecto.demo.Repository.TrayectoriaProfesionalRepository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.dto.AdminCrearUsuarioRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.proyecto.demo.exception.ApiException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UsuarioRepository usuarioRepository;
    private final AuthUserRepository authUserRepository;
    private final DocumentoRepository documentoRepository;
    private final AreaConocimientoRepository areaConocimientoRepository;
    private final InstitucionRepository institucionRepository;
    private final TrayectoriaAcademicaRepository trayectoriaAcademicaRepository;
    private final IdiomaRepository idiomaRepository;
    private final TrayectoriaProfesionalRepository trayectoriaProfesionalRepository;
    private final EstanciaRepository estanciaRepository;
    private final CursoRepository cursoRepository;
    private final CongresoRepository congresoRepository;
    private final DivulgacionRepository divulgacionRepository;
    private final ArticuloRepository articuloRepository;
    private final LogroRepository logroRepository;
    private final InteresHabilidadRepository interesHabilidadRepository;
    private final IncidenciaSocialRepository incidenciaSocialRepository;
    private final HerramientaRepository herramientaRepository;
    private final PropiedadIntelectualRepository propiedadIntelectualRepository;
    private final Registro1Repository registro1Repository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Crea un usuario desde el panel de administración. La cuenta se crea activa (sin verificación de email).
     */
    @Transactional
    public Usuario crearUsuario(AdminCrearUsuarioRequest req) {
        String email = req.email().trim().toLowerCase();
        if (authUserRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "El email ya está registrado");
        }
        if (registro1Repository.existsByCurp(req.curp().trim().toUpperCase())) {
            throw new ApiException(HttpStatus.CONFLICT, "La CURP ya está registrada");
        }

        Usuario u = Usuario.builder()
                .nombre(req.nombre().trim())
                .apellidoPaterno(req.apellidoPaterno().trim())
                .apellidoMaterno(req.apellidoMaterno() != null ? req.apellidoMaterno().trim() : "")
                .build();

        Set<String> roles = new HashSet<>(List.of("ROLE_USER"));
        if ("ROLE_ADMIN".equalsIgnoreCase(req.rol())) {
            roles.add("ROLE_ADMIN");
        } else if ("ROLE_EVALUADOR".equalsIgnoreCase(req.rol())) {
            roles.add("ROLE_EVALUADOR");
        }

        AuthUser au = AuthUser.builder()
                .email(email)
                .username(email)
                .passwordHash(passwordEncoder.encode(req.password()))
                .enabled(true)
                .locked(false)
                .roles(roles)
                .build();

        au.setUsuario(u);
        u.setAuthUser(au);
        usuarioRepository.save(u);

        Registro1 reg = Registro1.builder()
                .usuario(u)
                .curp(req.curp().trim().toUpperCase())
                .rfc(req.rfc() != null && !req.rfc().isBlank() ? req.rfc().trim().toUpperCase() : null)
                .fechaNacimiento(req.fechaNacimiento())
                .genero(Registro1.Genero.valueOf(req.genero().name()))
                .nacionalidad(req.nacionalidad() != null && !req.nacionalidad().isBlank() ? req.nacionalidad().trim() : null)
                .paisNacimiento(req.paisNacimiento() != null && !req.paisNacimiento().isBlank() ? req.paisNacimiento().trim() : null)
                .entidadFederativa(req.entidadFederativa() != null && !req.entidadFederativa().isBlank() ? req.entidadFederativa().trim() : null)
                .municipio(req.municipio() != null && !req.municipio().isBlank() ? req.municipio().trim() : null)
                .estadoCivil(req.estadoCivil() != null ? Registro1.EstadoCivil.valueOf(req.estadoCivil().name()) : null)
                .tipoPerfil(req.tipoPerfil() != null ? Registro1.TipoPerfil.valueOf(req.tipoPerfil().name()) : Registro1.TipoPerfil.INVESTIGADOR)
                .telefono(req.telefono() != null && !req.telefono().isBlank() ? req.telefono().trim() : null)
                .build();
        reg.setUsuario(u);
        u.setRegistro1(reg);
        registro1Repository.save(reg);

        log.info("Usuario creado por admin: {} (id={})", email, u.getId());
        return u;
    }

    /**
     * Elimina un usuario y todos sus datos asociados (documentos, trayectoria, auth). Registro1 y PerfilMigracion se eliminan en cascada al borrar Usuario.
     */
    @Transactional
    public void eliminarUsuario(Long usuarioId) {
        Usuario u = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Long id = u.getId();
        documentoRepository.findByUsuarioId(id).forEach(documentoRepository::delete);
        areaConocimientoRepository.findByUsuarioId(id).forEach(areaConocimientoRepository::delete);
        institucionRepository.findByUsuarioId(id).forEach(institucionRepository::delete);
        trayectoriaAcademicaRepository.findByUsuarioId(id).forEach(trayectoriaAcademicaRepository::delete);
        idiomaRepository.findByUsuarioId(id).forEach(idiomaRepository::delete);
        trayectoriaProfesionalRepository.findByUsuarioId(id).forEach(trayectoriaProfesionalRepository::delete);
        estanciaRepository.findByUsuarioId(id).forEach(estanciaRepository::delete);
        cursoRepository.findByUsuarioId(id).forEach(cursoRepository::delete);
        congresoRepository.findByUsuarioId(id).forEach(congresoRepository::delete);
        divulgacionRepository.findByUsuarioId(id).forEach(divulgacionRepository::delete);
        articuloRepository.findByUsuarioId(id).forEach(articuloRepository::delete);
        logroRepository.findByUsuarioId(id).forEach(logroRepository::delete);
        interesHabilidadRepository.findByUsuarioId(id).ifPresent(interesHabilidadRepository::delete);
        incidenciaSocialRepository.findByUsuarioId(id).forEach(incidenciaSocialRepository::delete);
        herramientaRepository.findByUsuarioId(id).forEach(herramientaRepository::delete);
        propiedadIntelectualRepository.findByUsuarioId(id).forEach(propiedadIntelectualRepository::delete);

        AuthUser au = u.getAuthUser();
        if (au != null) {
            // Evita violación FK con email_verification_tokens al borrar auth_users.
            emailVerificationTokenRepository.deleteByAuthUser_Id(au.getId());
            u.setAuthUser(null);
            usuarioRepository.save(u);
            authUserRepository.delete(au);
        }
        usuarioRepository.delete(u);
        log.info("Usuario {} eliminado correctamente", usuarioId);
    }
}
