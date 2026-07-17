package com.example.proyecto.demo.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

/**
 * Cuando hay 401 (no autenticado), redirige al login del frontend si la petición
 * viene del navegador; si es una petición API (JSON), devuelve 401 con cuerpo JSON.
 */
@Component
public class RedirectUnauthorizedEntryPoint implements AuthenticationEntryPoint {

    @Value("${app.frontend.url}")
    private String frontendUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        String accept = request.getHeader("Accept") != null ? request.getHeader("Accept") : "";
        boolean isBrowser = accept.contains("text/html");

        if (!isBrowser) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            Map<String, Object> body = Map.of(
                    "error", "Unauthorized",
                    "message", "Sesión expirada o no autenticado",
                    "redirectUrl", frontendUrl + "/login"
            );
            response.getWriter().write(objectMapper.writeValueAsString(body));
        } else {
            String loginUrl = frontendUrl + "/login";
            response.setStatus(HttpServletResponse.SC_FOUND);
            response.sendRedirect(loginUrl);
        }
    }
}
