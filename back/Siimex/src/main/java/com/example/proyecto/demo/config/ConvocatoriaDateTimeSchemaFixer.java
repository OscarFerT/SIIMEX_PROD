package com.example.proyecto.demo.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

@Slf4j
@Component
@DependsOn("entityManagerFactory")
@RequiredArgsConstructor
public class ConvocatoriaDateTimeSchemaFixer {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void ensureConvocatoriaDateTimeColumns() {
        try {
            ensureDateTimeColumn("fecha_apertura", "DATETIME NULL");
            ensureDateTimeColumn("fecha_cierre", "DATETIME NOT NULL");
        } catch (Exception e) {
            log.warn("No se pudo verificar/ajustar fecha-hora de convocatorias: {}", e.getMessage());
        }
    }

    private void ensureDateTimeColumn(String columnName, String definition) {
        List<String> dataTypes = jdbcTemplate.queryForList(
                "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'convocatorias' AND COLUMN_NAME = ?",
                String.class,
                columnName
        );
        String dataType = dataTypes.isEmpty() ? null : dataTypes.get(0);
        if (dataType == null) {
            return;
        }
        String normalized = dataType.toLowerCase(Locale.ROOT);
        if ("datetime".equals(normalized) || "timestamp".equals(normalized)) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE convocatorias MODIFY " + columnName + " " + definition);
        log.info("Columna convocatorias.{} convertida a {}", columnName, definition);
    }
}