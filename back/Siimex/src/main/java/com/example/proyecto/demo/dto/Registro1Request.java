package com.example.proyecto.demo.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

public record Registro1Request(

    @NotBlank
    String nombre,

    @NotBlank
    String apellidoPaterno,

    @NotBlank
    String apellidoMaterno,

    @NotBlank
    @Pattern(
        regexp = "^[A-Z0-9X]{18}$",
        message = "CURP inválida"
    )
    String curp,

    @NotBlank
    @Pattern(
        regexp = "^[A-ZÑ&X]{3,4}\\d{6}[A-Z0-9]{2,3}$",
        message = "RFC inválido"
    )
    String rfc,

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @NotNull
    @Past
    LocalDate fechaNacimiento,

    @NotNull
    Registro1Request.Genero genero,   // aquí usamos el enum

    @NotBlank
    String nacionalidad,


    @NotBlank
    String paisNacimiento,

    @NotBlank
    String entidadFederativa,

    @NotBlank
    String municipio,

    @NotNull
    Registro1Request.EstadoCivil estadoCivil,   // aquí usamos el enum

    /** Tipo de perfil: INVESTIGADOR, INNOVADOR o HIBRIDO. Opcional para compatibilidad con clientes antiguos. */
    Registro1Request.TipoPerfil tipoPerfil

) {

    public enum Genero {
        MASCULINO, FEMENINO, OTRO
    }

    public enum EstadoCivil {
        SOLTERO, CASADO, DIVORCIADO, VIUDO, UNION_LIBRE
    }

    public enum TipoPerfil {
        INVESTIGADOR, INNOVADOR, HIBRIDO
    }
}
