package com.example.proyecto.demo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Arrays;
import java.util.Set;

@Component
public class CookieRequestGuard extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean safe = Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod());
        boolean hasCookie = request.getCookies() != null && Arrays.stream(request.getCookies())
                .anyMatch(c -> "COMECYT_AUTH".equals(c.getName()) && !c.getValue().isBlank());
        String bearer = request.getHeader("Authorization");
        // A cross-origin HTML form cannot supply this header; CORS allows only trusted origins.
        if (!safe && hasCookie && (bearer == null || !bearer.startsWith("Bearer "))
                && !"1".equals(request.getHeader("X-SIIMEX-Request"))) {
            response.setStatus(403);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Solicitud no permitida\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
