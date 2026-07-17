package com.example.proyecto.demo.exception;

import org.springframework.http.HttpStatus;

/**
 * Excepción para errores de API con mensaje claro en el cuerpo de la respuesta.
 * El GlobalExceptionHandler devuelve siempre status + message + detail en JSON.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
