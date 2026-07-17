package com.example.proyecto.demo.dto;

import java.time.LocalDate;

public record PropiedadIntelectualItemDTO(
        String tipo,
        String titulo,
        String numeroRegistro,
        String institucionOficina,
        String pais,
        LocalDate fechaRegistro,
        Integer anio,
        String descripcion
) {}
