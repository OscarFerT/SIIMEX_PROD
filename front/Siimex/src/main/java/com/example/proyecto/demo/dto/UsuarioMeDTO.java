package com.example.proyecto.demo.dto;

import java.time.LocalDate;

public record UsuarioMeDTO(
        Long id,
        String nombre,
        String apellidoPaterno,
        String apellidoMaterno,
        String email,
        String telefono,
        String curp,
        String lugarNacimiento,
        LocalDate fechaNacimiento,
        String rfc,
        String nacionalidad,
        String estadoCivil
) {}
