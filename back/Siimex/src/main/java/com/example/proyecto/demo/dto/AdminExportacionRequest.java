package com.example.proyecto.demo.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AdminExportacionRequest(
        @Size(max = 20000) List<@NotNull @Positive Long> ids,
        @Size(max = 200) String busqueda,
        @Size(max = 30) String perfil,
        @Size(max = 30) String sexo,
        @Size(max = 255) String entidad,
        @Size(max = 255) String municipio) {
}
