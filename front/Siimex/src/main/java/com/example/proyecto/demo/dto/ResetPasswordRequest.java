package com.example.proyecto.demo.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @Email(message = "Email inválido")
        String email,
        
        @Pattern(regexp = "^[A-ZX]{4}\\d{6}[HM][A-Z]{5}[A-Z0-9]\\d$", message = "CURP inválida")
        String curp,
        
        @Pattern(regexp = "^[A-ZÑ&X]{3,4}\\d{6}[A-Z0-9]{2,3}$", message = "RFC inválido")
        String rfc,
        
        @NotBlank(message = "La nueva contraseña no puede estar vacía")
        @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
        String newPassword
) {
    // Validación personalizada: al menos 2 identificadores deben estar presentes
    public boolean hasEnoughIdentifiers() {
        int count = 0;
        if (email != null && !email.trim().isEmpty()) count++;
        if (curp != null && !curp.trim().isEmpty()) count++;
        if (rfc != null && !rfc.trim().isEmpty()) count++;
        return count >= 2;
    }
}
