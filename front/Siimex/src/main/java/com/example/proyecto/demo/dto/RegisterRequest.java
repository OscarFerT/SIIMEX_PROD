package com.example.proyecto.demo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RegisterRequest(
    @NotBlank(message = "El email no debe estar vacío")
    String email,

    @NotBlank(message = "La contraseña no debe estar vacía")
    String password,

    /** Teléfono opcional; puede ser null o vacío. */
    String telefono,

    @Valid
    @NotNull(message = "Registro no puede ser nulo")
    Registro1Request registro

) {}
