package com.example.proyecto.demo.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginStep1Request {
    @NotBlank(message = "El correo es obligatorio")
    @Email(message = "Correo electrónico inválido")
    private String email;

    @NotBlank(message = "La contraseña es obligatoria")
    private String password;

    /** Token de dispositivo confiable (opcional, para saltar 2FA). */
    private String rememberToken;

    /** Si es true, exige que la cuenta tenga ROLE_ADMIN. */
    private Boolean adminOnly;
}
