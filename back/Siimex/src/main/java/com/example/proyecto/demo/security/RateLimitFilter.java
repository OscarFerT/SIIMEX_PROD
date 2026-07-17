package com.example.proyecto.demo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final int maxRequests;
    private final Duration window;
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitFilter(
            @Value("${security.rate-limit.public.max-requests:30}") int maxRequests,
            @Value("${security.rate-limit.public.window-seconds:60}") long windowSeconds) {
        this.maxRequests = maxRequests;
        this.window = Duration.ofSeconds(windowSeconds);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!isLimitedEndpoint(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = clientIp(request) + ":" + request.getMethod() + ":" + normalizedPath(request);
        Bucket bucket = buckets.compute(key, (ignored, current) -> nextBucket(current));
        if (bucket.count > maxRequests) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Demasiadas solicitudes. Intenta más tarde.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Bucket nextBucket(Bucket current) {
        Instant now = Instant.now();
        if (current == null || now.isAfter(current.windowStart.plus(window))) {
            cleanup(now);
            return new Bucket(now, 1);
        }
        return new Bucket(current.windowStart, current.count + 1);
    }

    private boolean isLimitedEndpoint(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String path = normalizedPath(request);
        return path.startsWith("/auth/")
                || path.startsWith("/api/auth/")
                || "/contacto".equals(path)
                || "/api/contacto".equals(path)
                || path.startsWith("/documentos/")
                || path.startsWith("/api/documentos/")
                || path.startsWith("/postulaciones")
                || path.startsWith("/api/postulaciones")
                || path.startsWith("/migracion")
                || path.startsWith("/api/migracion")
                || "/usuarios/me/foto".equals(path)
                || "/api/usuarios/me/foto".equals(path)
                || "/usuarios/me/curriculum".equals(path)
                || "/api/usuarios/me/curriculum".equals(path);
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

    private void cleanup(Instant now) {
        if (buckets.size() < 10_000) {
            return;
        }
        for (Map.Entry<String, Bucket> entry : buckets.entrySet()) {
            if (now.isAfter(entry.getValue().windowStart.plus(window))) {
                buckets.remove(entry.getKey(), entry.getValue());
            }
        }
    }

    private record Bucket(Instant windowStart, int count) {
    }
}
