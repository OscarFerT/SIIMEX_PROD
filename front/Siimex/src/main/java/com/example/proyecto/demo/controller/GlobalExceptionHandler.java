package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        
        // Si hay errores anidados (como en registro.nombre), también capturarlos
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            if (error instanceof FieldError) {
                FieldError fieldError = (FieldError) error;
                String fieldName = fieldError.getField();
                
                // Si el campo es de un objeto anidado, incluir el path completo
                if (fieldError.getObjectName().contains("registro")) {
                    errors.put("registro." + fieldName, fieldError.getDefaultMessage());
                }
            }
        });
        
        log.error("Errores de validación: {}", errors);
        
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", java.time.Instant.now());
        response.put("status", HttpStatus.BAD_REQUEST.value());
        response.put("error", "Bad Request");
        response.put("message", "Errores de validación en los datos proporcionados");
        response.put("errors", errors);
        
        // Crear un mensaje legible
        StringBuilder mensajeCompleto = new StringBuilder();
        errors.forEach((campo, mensaje) -> {
            mensajeCompleto.append(campo).append(": ").append(mensaje).append("; ");
        });
        response.put("detail", mensajeCompleto.toString());
        
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /** Errores de API con mensaje explícito (CURP, email, etc.). Siempre devuelve body con message y detail. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : ex.getStatus().toString();
        log.warn("ApiException: {} - {}", ex.getStatus(), msg);
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", java.time.Instant.now());
        body.put("status", ex.getStatus().value());
        body.put("error", ex.getStatus().getReasonPhrase());
        body.put("message", msg);
        body.put("detail", msg);
        return new ResponseEntity<>(body, ex.getStatus());
    }

    /** Errores 400/409 lanzados con ResponseStatusException (fallback). */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        String reason = ex.getReason() != null ? ex.getReason() : ex.getStatusCode().toString();
        log.warn("ResponseStatusException: {} - {}", ex.getStatusCode(), reason);
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        String errorPhrase = status != null ? status.getReasonPhrase() : ex.getStatusCode().toString();
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", java.time.Instant.now());
        body.put("status", ex.getStatusCode().value());
        body.put("error", errorPhrase);
        body.put("message", reason);
        body.put("detail", reason);
        return new ResponseEntity<>(body, ex.getStatusCode());
    }

    /** Errores de configuración o envío (ej. Azure/Graph no configurado). */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        log.warn("IllegalStateException: {}", ex.getMessage());
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", java.time.Instant.now());
        body.put("status", 503);
        body.put("error", "Service Unavailable");
        String msg = ex.getMessage() != null ? ex.getMessage() : "Error en la configuración del servicio de correo";
        body.put("message", msg);
        body.put("detail", msg);
        return new ResponseEntity<>(body, HttpStatus.SERVICE_UNAVAILABLE);
    }

    /** Errores de Microsoft Graph / Azure (token, envío de correo). */
    @ExceptionHandler(HttpClientErrorException.class)
    public ResponseEntity<Map<String, Object>> handleHttpClientError(HttpClientErrorException ex) {
        log.warn("HttpClientErrorException: {} - {}", ex.getStatusCode(), ex.getMessage());
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", java.time.Instant.now());
        body.put("status", 503);
        body.put("error", "Service Unavailable");
        String msg = "Error al comunicarse con Microsoft Graph. Verifique AZURE_CLIENT_SECRET y los permisos Mail.Send. " + ex.getStatusCode();
        body.put("message", msg);
        body.put("detail", "Detalle no expuesto por seguridad.");
        return new ResponseEntity<>(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
}
