package com.example.proyecto.demo.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginStep2Request {
    @NotBlank(message = "El correo es obligatorio")
    @Email(message = "Correo electrónico inválido")
    private String email;

    @NotBlank(message = "El código de verificación es obligatorio")
    @Size(min = 6, max = 6, message = "El código debe tener 6 dígitos")
    @Pattern(regexp = "\\d{6}", message = "El código debe contener solo números")
    private String code;

    /** Si true, genera un token de confianza para futuros logins sin 2FA. */
    private boolean remember;

    /** Si es true, exige que la cuenta tenga ROLE_ADMIN. */
    private Boolean adminOnly;
}
