package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.ListaNegra;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.ListaNegraRepository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ListaNegraService {

    public static final String TIPO_SANCION_ANIO = "ANIO";
    public static final String TIPO_SANCION_DEFINITIVO = "DEFINITIVO";
    public static final String TIPO_SANCION_REEMBOLSO = "REEMBOLSO";

    private final ListaNegraRepository listaNegraRepository;
    private final UsuarioRepository usuarioRepository;

    public List<ListaNegra> listar(boolean soloActivas) {
        if (soloActivas) {
            return listaNegraRepository.findActivas();
        }
        return listaNegraRepository.findAllWithUsuario();
    }

    @Transactional
    public ListaNegra sancionar(Long usuarioId, String email, String curp, String motivo, Integer meses) {
        return sancionar(usuarioId, email, curp, motivo, meses, null, null, null, null);
    }

    @Transactional
    public ListaNegra sancionar(
            Long usuarioId,
            String email,
            String curp,
            String motivo,
            Integer meses,
            String tipoSancion,
            String nombrePrograma,
            String folioReferencia,
            String nombreReferencia
    ) {
        if ((usuarioId == null) && (email == null || email.trim().isBlank()) && (curp == null || curp.trim().isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes indicar usuario, email o CURP para sancionar");
        }
        String motivoLimpio = motivo != null ? motivo.trim() : "";
        if (motivoLimpio.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El motivo de la sanción es obligatorio");
        }
        String tipo = normalizarTipoSancion(tipoSancion, meses);

        Usuario usuario = null;
        if (usuarioId != null) {
            usuario = usuarioRepository.findById(usuarioId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        }

        String emailLimpio = normalizarEmail(email);
        String curpLimpio = normalizarCurp(curp);
        if (usuario != null && usuario.getAuthUser() != null && usuario.getAuthUser().getEmail() != null) {
            emailLimpio = usuario.getAuthUser().getEmail().trim().toLowerCase(Locale.ROOT);
        }
        if (usuario != null && usuario.getRegistro1() != null && usuario.getRegistro1().getCurp() != null) {
            curpLimpio = usuario.getRegistro1().getCurp().trim().toUpperCase(Locale.ROOT);
        }

        LocalDate inicio = LocalDate.now();
        LocalDate fin = calcularFechaFinSegunTipo(inicio, tipo);
        ListaNegra l = ListaNegra.builder()
                .usuario(usuario)
                .email(emailLimpio)
                .curp(curpLimpio)
                .motivo(motivoLimpio)
                .tipoSancion(tipo)
                .nombrePrograma(normalizarTexto(nombrePrograma, 220))
                .folioReferencia(normalizarTexto(folioReferencia, 120))
                .nombreReferencia(normalizarTexto(nombreReferencia, 220))
                .fechaInicio(inicio)
                .fechaFin(fin)
                .activa(true)
                .build();
        return listaNegraRepository.save(l);
    }

    @Transactional
    public ListaNegra levantar(Long id, Long adminUserId) {
        ListaNegra l = listaNegraRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Registro de lista negra no encontrado"));
        l.setActiva(false);
        l.setFechaLevantamiento(LocalDateTime.now());
        l.setLevantadaPorUsuarioId(adminUserId);
        return listaNegraRepository.save(l);
    }

    public void validarNoBloqueado(Usuario usuario, String email, String curp) {
        Long usuarioId = usuario != null ? usuario.getId() : null;
        String emailEval = normalizarEmail(email);
        String curpEval = normalizarCurp(curp);

        if (usuario != null && usuario.getAuthUser() != null && usuario.getAuthUser().getEmail() != null) {
            emailEval = usuario.getAuthUser().getEmail().trim().toLowerCase(Locale.ROOT);
        }
        if (usuario != null && usuario.getRegistro1() != null && usuario.getRegistro1().getCurp() != null) {
            curpEval = usuario.getRegistro1().getCurp().trim().toUpperCase(Locale.ROOT);
        }

        List<ListaNegra> vigentes = listaNegraRepository.buscarBloqueosVigentes(usuarioId, emailEval, curpEval, LocalDate.now());
        if (!vigentes.isEmpty()) {
            ListaNegra bloqueo = vigentes.get(0);
            String hasta = bloqueo.getFechaFin() != null ? bloqueo.getFechaFin().toString() : "fecha indefinida";
            String tipo = bloqueo.getTipoSancion() != null ? bloqueo.getTipoSancion().trim().toUpperCase(Locale.ROOT) : "";
            if (TIPO_SANCION_DEFINITIVO.equals(tipo) || TIPO_SANCION_REEMBOLSO.equals(tipo)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "No puedes postularte: tienes una sanción activa en lista negra.");
            }
            throw new ApiException(HttpStatus.FORBIDDEN, "No puedes postularte: estás en lista negra hasta " + hasta);
        }
    }

    public boolean tieneBloqueoActivo(Long usuarioId, String email, String curp) {
        List<ListaNegra> vigentes = listaNegraRepository.buscarBloqueosVigentes(
                usuarioId,
                normalizarEmail(email),
                normalizarCurp(curp),
                LocalDate.now()
        );
        return !vigentes.isEmpty();
    }

    public Map<String, Object> toMap(ListaNegra l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("usuarioId", l.getUsuario() != null ? l.getUsuario().getId() : null);
        String nombre = null;
        if (l.getUsuario() != null) {
            String n = l.getUsuario().getNombre() != null ? l.getUsuario().getNombre().trim() : "";
            String ap = l.getUsuario().getApellidoPaterno() != null ? l.getUsuario().getApellidoPaterno().trim() : "";
            String am = l.getUsuario().getApellidoMaterno() != null ? l.getUsuario().getApellidoMaterno().trim() : "";
            nombre = (n + " " + ap + " " + am).trim();
            if (nombre.isBlank()) nombre = null;
        }
        m.put("nombre", nombre);
        m.put("email", l.getEmail());
        m.put("curp", l.getCurp());
        m.put("motivo", l.getMotivo());
        m.put("tipoSancion", l.getTipoSancion());
        m.put("tipoSancionLabel", getTipoSancionLabel(l.getTipoSancion()));
        m.put("nombrePrograma", l.getNombrePrograma());
        m.put("folioReferencia", l.getFolioReferencia());
        m.put("nombreReferencia", l.getNombreReferencia());
        m.put("fechaInicio", l.getFechaInicio() != null ? l.getFechaInicio().toString() : null);
        m.put("fechaFin", l.getFechaFin() != null ? l.getFechaFin().toString() : null);
        m.put("activa", l.isActiva());
        m.put("fechaLevantamiento", l.getFechaLevantamiento() != null ? l.getFechaLevantamiento().toString() : null);
        m.put("levantadaPorUsuarioId", l.getLevantadaPorUsuarioId());
        m.put("createdAt", l.getCreatedAt() != null ? l.getCreatedAt().toString() : null);
        m.put("updatedAt", l.getUpdatedAt() != null ? l.getUpdatedAt().toString() : null);
        return m;
    }

    private String normalizarEmail(String value) {
        String limpio = value != null ? value.trim().toLowerCase(Locale.ROOT) : "";
        return limpio.isBlank() ? null : limpio;
    }

    private String normalizarCurp(String value) {
        String limpio = value != null ? value.trim().toUpperCase(Locale.ROOT) : "";
        return limpio.isBlank() ? null : limpio;
    }

    private String normalizarTipoSancion(String tipoSancion, Integer meses) {
        String tipo = tipoSancion != null ? tipoSancion.trim().toUpperCase(Locale.ROOT) : "";
        if (tipo.isBlank()) {
            if (meses != null && meses == 12) return TIPO_SANCION_ANIO;
            if (meses != null && meses == 6) return TIPO_SANCION_ANIO;
            return TIPO_SANCION_ANIO;
        }
        return switch (tipo) {
            case TIPO_SANCION_ANIO, TIPO_SANCION_DEFINITIVO, TIPO_SANCION_REEMBOLSO -> tipo;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "Tipo de sanción inválido. Usa: ANIO, DEFINITIVO o REEMBOLSO");
        };
    }

    private LocalDate calcularFechaFinSegunTipo(LocalDate inicio, String tipo) {
        if (inicio == null) inicio = LocalDate.now();
        return switch (tipo) {
            case TIPO_SANCION_ANIO -> inicio.plusMonths(12);
            case TIPO_SANCION_DEFINITIVO, TIPO_SANCION_REEMBOLSO -> null;
            default -> inicio.plusMonths(12);
        };
    }

    private String normalizarTexto(String value, int max) {
        String limpio = value != null ? value.trim() : "";
        if (limpio.isBlank()) return null;
        return limpio.length() > max ? limpio.substring(0, max) : limpio;
    }

    private String getTipoSancionLabel(String tipoSancion) {
        String tipo = tipoSancion != null ? tipoSancion.trim().toUpperCase(Locale.ROOT) : "";
        return switch (tipo) {
            case TIPO_SANCION_DEFINITIVO -> "Definitivo";
            case TIPO_SANCION_REEMBOLSO -> "Reembolso";
            default -> "1 año";
        };
    }
}
