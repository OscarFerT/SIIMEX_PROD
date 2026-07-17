package com.example.proyecto.demo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.io.IOException;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtFilter extends OncePerRequestFilter {

    private final JwtVerifier jwtVerifier; // tu clase que hace parse/verify 0.12.x

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = resolveToken(request);

        if (log.isTraceEnabled()) {
            log.trace("Incoming {} {}", request.getMethod(), request.getRequestURI());
        }

        if (token != null && !token.isBlank()) {
            try {
                JwtPayload payload = jwtVerifier.verifyAndParse(token); // Claims -> payload

                if (payload != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                    // IMPORTANTE: Authorities con el prefijo correcto tal cual viene del claim
                    // ej: "ROLE_USER" → SimpleGrantedAuthority("ROLE_USER")
                    Set<SimpleGrantedAuthority> authorities = payload.roles().stream()
                            .map(SimpleGrantedAuthority::new)
                            .collect(Collectors.toSet());

                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(payload.authUserId(), null, authorities);

                    // (Opcional) detalles de la petición
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(auth);
                    log.debug("Auth set for principal={} authorities={}", payload.authUserId(), authorities);
                }
            } catch (Exception e) {
                // Si el token es inválido/expirado, deja sin autenticar → caerá en 401 (no 403)
                log.debug("Token inválido o expirado: {}", e.getMessage());
            }
        }
        chain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("COMECYT_AUTH".equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                    return cookie.getValue();
                }
            }
        }
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
