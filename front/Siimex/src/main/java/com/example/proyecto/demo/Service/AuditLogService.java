package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.AuditLog;
import com.example.proyecto.demo.Repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Registra un evento de auditoría de forma asíncrona para no bloquear el flujo principal.
     */
    @Async
    public void registrar(AuditLog.Categoria categoria, String accion, String detalle,
                          Long usuarioId, String usuarioEmail, String usuarioNombre,
                          String entidadTipo, Long entidadId, String ipAddress) {
        try {
            AuditLog entry = AuditLog.builder()
                    .categoria(categoria)
                    .accion(accion)
                    .detalle(detalle)
                    .usuarioId(usuarioId)
                    .usuarioEmail(usuarioEmail)
                    .usuarioNombre(usuarioNombre)
                    .entidadTipo(entidadTipo)
                    .entidadId(entidadId)
                    .ipAddress(ipAddress)
                    .fecha(Instant.now())
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Error al registrar audit log: {}", e.getMessage(), e);
        }
    }

    /** Variante simplificada para acciones de autenticación */
    @Async
    public void registrarAuth(String accion, String detalle, String email, String ip) {
        registrar(AuditLog.Categoria.AUTENTICACION, accion, detalle, null, email, null, null, null, ip);
    }

    /** Variante simplificada para acciones de admin */
    @Async
    public void registrarAdmin(String accion, String detalle, Long adminId, String adminEmail,
                               String entidadTipo, Long entidadId, String ip) {
        registrar(AuditLog.Categoria.ADMIN, accion, detalle, adminId, adminEmail, null, entidadTipo, entidadId, ip);
    }

    public Page<AuditLog> buscar(AuditLog.Categoria categoria, String email, String accion,
                                 Instant desde, Instant hasta, int page, int size) {
        return auditLogRepository.buscarConFiltros(categoria, email, accion, desde, hasta, PageRequest.of(page, size));
    }

    public List<Object[]> estadisticasPorAccion(Instant desde) {
        return auditLogRepository.contarPorAccionDesde(desde);
    }

    public List<Object[]> estadisticasPorCategoria(Instant desde) {
        return auditLogRepository.contarPorCategoriaDesde(desde);
    }

    public long contarDesde(Instant desde) {
        return auditLogRepository.countByFechaAfter(desde);
    }

    public List<AuditLog> ultimosEventos() {
        return auditLogRepository.findTop10ByOrderByFechaDesc();
    }
}
