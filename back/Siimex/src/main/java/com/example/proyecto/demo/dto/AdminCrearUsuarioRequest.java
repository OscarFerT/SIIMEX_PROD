package com.example.proyecto.demo.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * DTO para que el administrador cree un usuario directamente (alta manual).
 * La cuenta se crea activa (enabled=true), sin verificación de email.
 */
public record AdminCrearUsuarioRequest(
        @NotBlank(message = "El email es requerido")
        @Email(message = "Email inválido")
        String email,

        @NotBlank(message = "La contraseña es requerida")
        @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
        String password,

        @NotBlank(message = "El nombre es requerido")
        String nombre,

        @NotBlank(message = "El apellido paterno es requerido")
        String apellidoPaterno,

        String apellidoMaterno,

        @NotBlank(message = "La CURP es requerida")
        @Pattern(regexp = "^[A-Z0-9X]{18}$", message = "CURP inválida (18 caracteres)")
        String curp,

        @Pattern(regexp = "^[A-ZÑ&X]{3,4}\\d{6}[A-Z0-9]{2,3}$", message = "RFC inválido")
        String rfc,

        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        @NotNull(message = "La fecha de nacimiento es requerida")
        @Past(message = "La fecha de nacimiento debe ser en el pasado")
        LocalDate fechaNacimiento,

        @NotNull(message = "El género es requerido")
        Registro1Request.Genero genero,

        String nacionalidad,

        String paisNacimiento,

        String entidadFederativa,

        String municipio,

        Registro1Request.EstadoCivil estadoCivil,

        Registro1Request.TipoPerfil tipoPerfil,

        String telefono,

        String rol
) {}
