package com.example.proyecto.demo.security;

import com.example.proyecto.demo.Entity.AuditLog;
import com.example.proyecto.demo.Service.AuditLogService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class SecurityAuditFilter extends OncePerRequestFilter {

    private final AuditLogService auditLogService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        filterChain.doFilter(request, response);

        if (!isAuditable(request)) {
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Long authUserId = authentication != null && authentication.getPrincipal() instanceof Long id ? id : null;
        String accion = request.getMethod() + " " + normalizedPath(request);
        String detalle = "HTTP " + response.getStatus();
        auditLogService.registrar(
                categoryForPath(normalizedPath(request)),
                accion,
                detalle,
                authUserId,
                null,
                null,
                "HTTP_REQUEST",
                null,
                clientIp(request)
        );
    }

    private boolean isAuditable(HttpServletRequest request) {
        String method = request.getMethod();
        if (!("POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method))) {
            return false;
        }
        String path = normalizedPath(request);
        return path.startsWith("/documentos/")
                || path.startsWith("/api/documentos/")
                || path.startsWith("/postulaciones")
                || path.startsWith("/api/postulaciones")
                || path.startsWith("/admin/")
                || path.startsWith("/api/admin/")
                || path.startsWith("/migracion")
                || path.startsWith("/api/migracion")
                || path.startsWith("/usuarios/me")
                || path.startsWith("/api/usuarios/me");
    }

    private AuditLog.Categoria categoryForPath(String path) {
        if (path.startsWith("/documentos/") || path.startsWith("/api/documentos/")) {
            return AuditLog.Categoria.DOCUMENTO;
        }
        if (path.startsWith("/postulaciones") || path.startsWith("/api/postulaciones")
                || path.contains("/postulaciones")) {
            return AuditLog.Categoria.POSTULACION;
        }
        if (path.startsWith("/admin/") || path.startsWith("/api/admin/")) {
            return AuditLog.Categoria.ADMIN;
        }
        if (path.startsWith("/usuarios/") || path.startsWith("/api/usuarios/")) {
            return AuditLog.Categoria.USUARIO;
        }
        return AuditLog.Categoria.SISTEMA;
    }

    private String normalizedPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isBlank() && path.startsWith(context)) {
            path = path.substring(context.length());
        }
        return path;
    }

    private String clientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
