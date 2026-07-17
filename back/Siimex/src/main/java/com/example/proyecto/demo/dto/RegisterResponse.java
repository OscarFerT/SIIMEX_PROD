package com.example.proyecto.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Respuesta del registro cuando se requiere verificación de correo.
 * No incluye token; el usuario debe verificar su email antes de iniciar sesión.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterResponse {
    private boolean success;
    private String email;
    private String message;
    /** Folio de registro configurable por modalidad (ej. SIIMEX-INV-001). */
    private String folioRegistro;
}
