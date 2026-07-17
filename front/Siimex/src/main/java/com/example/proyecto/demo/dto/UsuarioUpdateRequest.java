package com.example.proyecto.demo.dto;

import java.time.LocalDate;

public record UsuarioUpdateRequest(
        String nombre,
        String apellidoPaterno,
        String apellidoMaterno,
        String telefono,
        String curp,
        String rfc,
        String nacionalidad,
        String lugarNacimiento,
        LocalDate fechaNacimiento,
        String semblanza,
        String visibilidadPerfil,
        Boolean consentimientoDirectorioPublico,
        Boolean registro2Completo
) {}
