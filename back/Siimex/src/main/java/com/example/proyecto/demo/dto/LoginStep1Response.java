package com.example.proyecto.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginStep1Response {
    /** Indica que se requiere verificar el código enviado por correo */
    private boolean requiresVerification = true;
    /** Email al que se envió el código (para mostrar en el frontend) */
    private String email;
    /** JWT devuelto directamente si el dispositivo es de confianza (sin 2FA). */
    private String token;
    /** Token de confianza para futuros logins (solo si remember=true). */
    private String rememberToken;

    public LoginStep1Response(boolean requiresVerification, String email) {
        this.requiresVerification = requiresVerification;
        this.email = email;
    }
}
