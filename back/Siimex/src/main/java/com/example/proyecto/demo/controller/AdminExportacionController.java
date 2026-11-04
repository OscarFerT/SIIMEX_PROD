package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Service.AdminExportacionService;
import com.example.proyecto.demo.Service.AuditLogService;
import com.example.proyecto.demo.dto.AdminExportacionRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/registros/exportaciones")
@RequiredArgsConstructor
public class AdminExportacionController {
    private final AdminExportacionService exportaciones;
    private final AuditLogService auditoria;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminExportacionService.Estado> iniciar(Authentication auth, @Valid @RequestBody AdminExportacionRequest request,
                                                                HttpServletRequest http) {
        var estado = exportaciones.iniciar(auth.getName(), request);
        auditoria.registrarAdmin("EXPORTAR_EXPEDIENTES", "Exportacion " + estado.id() + ": " + estado.totalUsuarios() + " usuarios",
                Long.valueOf(auth.getName()), null, "Usuario", null, http.getRemoteAddr());
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(estado);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminExportacionService.Estado> consultar(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(exportaciones.consultar(auth.getName(), id));
    }

    @GetMapping("/actual")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminExportacionService.Estado> actual(Authentication auth) {
        return exportaciones.actual(auth.getName()).map(estado -> ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(estado))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminExportacionService.Estado> cancelar(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(exportaciones.cancelar(auth.getName(), id));
    }

    @PostMapping("/{id}/preparar-descarga")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> preparar(Authentication auth, @PathVariable UUID id, HttpServletRequest request) {
        String ticket = exportaciones.prepararDescarga(auth.getName(), id);
        // A short-lived HttpOnly capability permits native streaming downloads without putting the JWT in a URL.
        ResponseCookie cookie = ResponseCookie.from("siimex_export", ticket).httpOnly(true).secure(request.isSecure())
                .sameSite("Strict").path(rutaCookie(request, id)).maxAge(90).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).cacheControl(CacheControl.noStore())
                .body(Map.of("message", "Descarga autorizada por 90 segundos"));
    }

    @GetMapping("/{id}/archivo")
    public void descargar(@PathVariable UUID id, @CookieValue(name = "siimex_export", required = false) String ticket,
                          HttpServletRequest request, HttpServletResponse response) throws IOException {
        var descarga = exportaciones.abrirDescarga(id, ticket);
        response.setContentType("application/zip");
        response.setContentLengthLong(descarga.bytes());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store, private");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(descarga.nombre()).build().toString());
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("siimex_export", "").httpOnly(true)
                .secure(request.isSecure()).sameSite("Strict").path(rutaCookie(request, id)).maxAge(0).build().toString());
        try (var input = Files.newInputStream(descarga.archivo())) {
            input.transferTo(response.getOutputStream());
        } finally {
            exportaciones.cerrarDescarga(id);
        }
    }

    private String rutaCookie(HttpServletRequest request, UUID id) {
        return request.getContextPath() + "/admin/registros/exportaciones/" + id + "/archivo";
    }
}
