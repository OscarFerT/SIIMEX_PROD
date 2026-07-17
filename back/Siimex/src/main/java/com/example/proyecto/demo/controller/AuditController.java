package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.AuditLog;
import com.example.proyecto.demo.Service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin/auditoria")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuditController {

    private final AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> buscar(
            @RequestParam(required = false) String categoria,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String accion,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        AuditLog.Categoria cat = null;
        if (categoria != null && !categoria.isBlank()) {
            try { cat = AuditLog.Categoria.valueOf(categoria); } catch (Exception ignored) {}
        }

        Instant desdeInstant = desde != null ? desde.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant hastaInstant = hasta != null ? hasta.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;

        String emailParam = (email != null && !email.isBlank()) ? email.trim() : null;
        String accionParam = (accion != null && !accion.isBlank()) ? accion.trim() : null;

        Page<AuditLog> resultado = auditLogService.buscar(cat, emailParam, accionParam, desdeInstant, hastaInstant, page, size);

        List<Map<String, Object>> items = resultado.getContent().stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("fecha", a.getFecha().toString());
            m.put("categoria", a.getCategoria().name());
            m.put("accion", a.getAccion());
            m.put("detalle", a.getDetalle());
            m.put("usuarioId", a.getUsuarioId());
            m.put("usuarioEmail", a.getUsuarioEmail());
            m.put("usuarioNombre", a.getUsuarioNombre());
            m.put("entidadTipo", a.getEntidadTipo());
            m.put("entidadId", a.getEntidadId());
            m.put("ipAddress", a.getIpAddress());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("items", items);
        resp.put("totalElements", resultado.getTotalElements());
        resp.put("totalPages", resultado.getTotalPages());
        resp.put("page", resultado.getNumber());
        resp.put("size", resultado.getSize());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        Instant hace24h = Instant.now().minus(24, ChronoUnit.HOURS);
        Instant hace7d = Instant.now().minus(7, ChronoUnit.DAYS);
        Instant hace30d = Instant.now().minus(30, ChronoUnit.DAYS);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("total24h", auditLogService.contarDesde(hace24h));
        resp.put("total7d", auditLogService.contarDesde(hace7d));
        resp.put("total30d", auditLogService.contarDesde(hace30d));

        List<Object[]> porAccion = auditLogService.estadisticasPorAccion(hace30d);
        resp.put("porAccion", porAccion.stream().map(row -> Map.of("accion", row[0], "total", row[1])).collect(Collectors.toList()));

        List<Object[]> porCategoria = auditLogService.estadisticasPorCategoria(hace30d);
        resp.put("porCategoria", porCategoria.stream().map(row -> Map.of("categoria", row[0].toString(), "total", row[1])).collect(Collectors.toList()));

        resp.put("ultimosEventos", auditLogService.ultimosEventos().stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("fecha", a.getFecha().toString());
            m.put("categoria", a.getCategoria().name());
            m.put("accion", a.getAccion());
            m.put("usuarioEmail", a.getUsuarioEmail());
            m.put("detalle", a.getDetalle());
            return m;
        }).collect(Collectors.toList()));

        return ResponseEntity.ok(resp);
    }
}
