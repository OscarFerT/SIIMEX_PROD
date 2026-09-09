package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Entity.Notificacion;
import com.example.proyecto.demo.Entity.Notificacion.TipoNotificacion;
import com.example.proyecto.demo.Repository.NotificacionRepository;
import org.springframework.data.domain.PageRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificacionService {

    private static final int DEFAULT_LIMIT = 12;
    private static final int MAX_LIMIT = 50;

    private final NotificacionRepository notificacionRepo;

    public void crear(AuthUser destinatario, String titulo, String mensaje,
                      TipoNotificacion tipo, String rutaLink) {
        Notificacion n = Notificacion.builder()
                .authUser(destinatario)
                .titulo(titulo)
                .mensaje(mensaje)
                .tipo(tipo)
                .rutaLink(rutaLink)
                .build();
        notificacionRepo.save(n);
        log.info("Notificación creada: [{}] {} -> {}",
                tipo, titulo, destinatario != null ? destinatario.getEmail() : "ADMIN_BROADCAST");
    }

    /** Notificación broadcast para admins (authUser = null) */
    public void crearParaAdmins(String titulo, String mensaje, TipoNotificacion tipo, String rutaLink) {
        crear(null, titulo, mensaje, tipo, rutaLink);
    }

    public List<Map<String, Object>> listarUsuario(Long authUserId) {
        return notificacionRepo.findByAuthUserId(authUserId).stream()
                .filter(this::esNotificacionUsuarioVisible)
                .map(this::toMap)
                .toList();
    }

    public List<Map<String, Object>> listarUsuarioRecientes(Long authUserId, Integer limit) {
        int size = sanitizeLimit(limit);
        return notificacionRepo.findByAuthUserId(authUserId).stream()
                .filter(this::esNotificacionUsuarioVisible)
                .limit(size)
                .map(this::toMap)
                .toList();
    }

    public long contarNoLeidas(Long authUserId) {
        return notificacionRepo.findByAuthUserId(authUserId).stream()
                .filter(this::esNotificacionUsuarioVisible)
                .filter(n -> !n.isLeida())
                .count();
    }

    public List<Map<String, Object>> listarAdmin(Long authUserId) {
        return notificacionRepo.findAdminNotificaciones(authUserId).stream()
                .map(this::toMap)
                .toList();
    }

    public List<Map<String, Object>> listarAdminRecientes(Long authUserId, Integer limit) {
        int size = sanitizeLimit(limit);
        return notificacionRepo.findAdminNotificaciones(authUserId, PageRequest.of(0, size)).stream()
                .map(this::toMap)
                .toList();
    }

    public long contarNoLeidasAdmin(Long authUserId) {
        return notificacionRepo.countNoLeidasAdmin(authUserId);
    }

    @Transactional
    public void marcarLeida(Long notificacionId) {
        notificacionRepo.findById(notificacionId).ifPresent(n -> {
            n.setLeida(true);
            notificacionRepo.save(n);
        });
    }

    @Transactional
    public void marcarTodasLeidas(Long authUserId) {
        notificacionRepo.marcarTodasLeidasByAuthUserId(authUserId);
    }

    @Transactional
    public void marcarTodasLeidasAdmin(Long authUserId) {
        notificacionRepo.marcarTodasLeidasAdmin(authUserId);
    }

    private boolean esNotificacionUsuarioVisible(Notificacion n) {
        if (n == null || n.getTipo() == null) return false;
        if (n.getTipo() == TipoNotificacion.POSTULACION_ACEPTADA) return true;
        if (n.getTipo() != TipoNotificacion.SISTEMA) return false;
        String titulo = n.getTitulo() != null ? n.getTitulo().toLowerCase(Locale.ROOT) : "";
        String mensaje = n.getMensaje() != null ? n.getMensaje().toLowerCase(Locale.ROOT) : "";
        return titulo.contains("observaciones")
                || titulo.contains("correcciones")
                || titulo.contains("constancia")
                || titulo.contains("carta de cierre")
                || titulo.contains("oficio")
                || titulo.contains("nombramiento")
                || mensaje.contains("disponible para descarga")
                || mensaje.contains("requiere correcciones")
                || mensaje.contains("observaciones");
    }

    private Map<String, Object> toMap(Notificacion n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId());
        m.put("titulo", n.getTitulo());
        m.put("mensaje", n.getMensaje());
        m.put("tipo", n.getTipo().name());
        m.put("leida", n.isLeida());
        m.put("fechaCreacion", n.getFechaCreacion() != null ? n.getFechaCreacion().toString() : null);
        m.put("rutaLink", n.getRutaLink());
        return m;
    }

    private int sanitizeLimit(Integer limit) {
        if (limit == null) return DEFAULT_LIMIT;
        if (limit < 1) return DEFAULT_LIMIT;
        return Math.min(limit, MAX_LIMIT);
    }
}
