package com.example.proyecto.demo.dto;

import com.example.proyecto.demo.Entity.Registro1;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record ProfileRequest(

    // ===== USUARIO =====
    @NotBlank
    String nombre,

    @NotBlank
    String apellidoPaterno,

    @NotBlank
    String apellidoMaterno,

    // ===== REGISTRO1 =====
    @NotBlank
    @Pattern(regexp = "^[A-Z0-9]{18}$")
    String curp,

    @Pattern(regexp = "^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{2,3}$")
    String rfc,

    @Past
    LocalDate fechaNacimiento,

    @NotNull
    Registro1.Genero genero,

    @NotBlank
    String paisNacimiento,

    @NotBlank
    String entidadFederativa,

    @NotBlank
    String nacionalidad,

    @NotNull
    Registro1.EstadoCivil estadoCivil

) {}
