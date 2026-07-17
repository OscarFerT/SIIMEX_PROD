package com.example.proyecto.demo.config;

import com.example.proyecto.demo.Entity.InstitucionEducativa;
import com.example.proyecto.demo.Repository.InstitucionEducativaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class InstitucionEducativaSeedRunner implements CommandLineRunner {

    private static final long ACTIVE_SEED_THRESHOLD = 4000L;

    private final InstitucionEducativaRepository institucionEducativaRepository;
    private final DataFormatter dataFormatter = new DataFormatter(Locale.forLanguageTag("es-MX"));

    @Override
    public void run(String... args) {
        try {
            ClassPathResource resource = new ClassPathResource("instituciones_academicas.xlsx");
            if (!resource.exists()) {
                log.warn(">>> No se encontró instituciones_academicas.xlsx en classpath; se omite siembra de instituciones educativas");
                return;
            }

            long activas = institucionEducativaRepository.countByEstado(InstitucionEducativa.EstadoInstitucion.ACTIVA);
            if (activas >= ACTIVE_SEED_THRESHOLD) {
                log.info(">>> Catálogo de instituciones educativas ya sembrado. Activas={}", activas);
                return;
            }

            Set<String> seenByName = new HashSet<>();
            Set<String> seenDetailed = new HashSet<>();
            for (InstitucionEducativa institucion : institucionEducativaRepository.findAll()) {
                seenByName.add(normalizar(institucion.getNombre()));
                seenDetailed.add(dedupeKey(institucion.getNombre(), institucion.getDomicilio(), institucion.getNivelEducativo()));
            }

            List<InstitucionEducativa> batch = new ArrayList<>();
            int duplicadas = 0;
            int ignoradas = 0;

            try (InputStream inputStream = resource.getInputStream(); Workbook workbook = WorkbookFactory.create(inputStream)) {
                List<Sheet> orderedSheets = orderedSheets(workbook);
                for (Sheet sheet : orderedSheets) {
                    Map<String, Integer> headers = headers(sheet.getRow(sheet.getFirstRowNum()));
                    for (int i = sheet.getFirstRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
                        Row row = sheet.getRow(i);
                        if (row == null) {
                            continue;
                        }

                        String nombre = limitarLongitud(limpiarEspecial(cell(row, headers, "DESC_INST_ACADEM")), 220);
                        if (nombre.isBlank()) {
                            ignoradas++;
                            continue;
                        }

                        String domicilio = limitarLongitud(limpiarEspecial(cell(row, headers, "DOMICILIO")), 250);
                        String telefono = limitarLongitud(limpiarEspecial(cell(row, headers, "TELEFONO")), 30);
                        String correo = normalizarCorreoFlexible(cell(row, headers, "CORREO_ELECTRONICO"));
                        String nivel = limitarLongitud(normalizarNivel(cell(row, headers, "NIVEL_ESTUDIOS")), 120);
                        String indicadorEstatus = limpiarEspecial(cell(row, headers, "IND_ESTATUS"));
                        InstitucionEducativa.EstadoInstitucion estado = "1".equals(indicadorEstatus)
                                ? InstitucionEducativa.EstadoInstitucion.ACTIVA
                                : InstitucionEducativa.EstadoInstitucion.PENDIENTE_VALIDACION;

                        String nameKey = normalizar(nombre);
                        String detailKey = dedupeKey(nombre, domicilio, nivel);
                        boolean sparse = domicilio.isBlank() && telefono.isBlank() && (correo == null || correo.isBlank()) && nivel.isBlank();

                        if (seenDetailed.contains(detailKey) || (sparse && seenByName.contains(nameKey))) {
                            duplicadas++;
                            continue;
                        }

                        seenByName.add(nameKey);
                        seenDetailed.add(detailKey);
                        batch.add(InstitucionEducativa.builder()
                                .cct(null)
                                .nombre(nombre)
                                .domicilio(domicilio.isBlank() ? null : domicilio)
                                .colonia(null)
                                .codigoPostal(null)
                                .municipio(null)
                                .entidadFederativa(null)
                                .telefono(telefono.isBlank() ? null : telefono)
                                .director(null)
                                .correo(correo)
                                .nivelEducativo(nivel.isBlank() ? null : nivel)
                                .estado(estado)
                                .solicitudUsuarioId(null)
                                .createdAt(LocalDateTime.now())
                                .build());
                    }
                }
            }

            if (!batch.isEmpty()) {
                institucionEducativaRepository.saveAll(batch);
            }

            log.info(">>> Catálogo de instituciones educativas sembrado: nuevas={}, duplicadasOmitidas={}, ignoradas={}, activasTotales={}",
                    batch.size(),
                    duplicadas,
                    ignoradas,
                    institucionEducativaRepository.countByEstado(InstitucionEducativa.EstadoInstitucion.ACTIVA));
        } catch (Exception ex) {
            log.error(">>> Error al sembrar instituciones educativas: {}", ex.getMessage(), ex);
        }
    }

    private List<Sheet> orderedSheets(Workbook workbook) {
        List<Sheet> sheets = new ArrayList<>();
        Sheet hoja4 = workbook.getSheet("Hoja4");
        Sheet hoja2 = workbook.getSheet("Hoja2");
        Sheet hoja1 = workbook.getSheet("Hoja1");
        if (hoja4 != null) sheets.add(hoja4);
        if (hoja2 != null) sheets.add(hoja2);
        if (hoja1 != null) sheets.add(hoja1);
        for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
            Sheet sheet = workbook.getSheetAt(i);
            if (!sheets.contains(sheet)) {
                sheets.add(sheet);
            }
        }
        return sheets;
    }

    private Map<String, Integer> headers(Row headerRow) {
        Map<String, Integer> headers = new LinkedHashMap<>();
        if (headerRow == null) {
            return headers;
        }
        for (int i = headerRow.getFirstCellNum(); i < headerRow.getLastCellNum(); i++) {
            String value = readCell(headerRow, i);
            if (!value.isBlank()) {
                headers.put(value.trim().toUpperCase(Locale.ROOT), i);
            }
        }
        return headers;
    }

    private String cell(Row row, Map<String, Integer> headers, String key) {
        Integer index = headers.get(key.toUpperCase(Locale.ROOT));
        return index == null ? "" : readCell(row, index);
    }

    private String readCell(Row row, int index) {
        if (row == null || row.getCell(index) == null) {
            return "";
        }
        return dataFormatter.formatCellValue(row.getCell(index)).trim();
    }

    private String limpiarEspecial(String value) {
        String limpio = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (limpio.equalsIgnoreCase("VACIO") || limpio.equalsIgnoreCase("NULL") || limpio.equalsIgnoreCase("N/A")) {
            return "";
        }
        return limpio;
    }

    private String normalizarNivel(String value) {
        String nivel = limpiarEspecial(value).toUpperCase(Locale.ROOT);
        if (nivel.isBlank()) {
            return "";
        }
        return switch (nivel) {
            case "BASI" -> "Básica";
            case "SECU" -> "Secundaria";
            case "MEDIO", "MEDIA_SUPERIOR" -> "Media Superior";
            case "SUPE", "SUPERIOR", "MESU" -> "Superior";
            default -> normalizarTitulo(nivel);
        };
    }

    private String normalizarCorreoFlexible(String value) {
        String correo = limpiarEspecial(value).toLowerCase(Locale.ROOT);
        if (correo.isBlank()) {
            return null;
        }
        if (!correo.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            return null;
        }
        return correo.length() > 180 ? correo.substring(0, 180) : correo;
    }

    private String limitarLongitud(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    private String dedupeKey(String nombre, String domicilio, String nivel) {
        return normalizar(nombre) + "|" + normalizar(domicilio) + "|" + normalizar(nivel);
    }

    private String normalizar(String value) {
        String source = value == null ? "" : value;
        return java.text.Normalizer.normalize(source.toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalizarTitulo(String value) {
        String limpio = limpiarEspecial(value);
        if (limpio.isBlank()) {
            return limpio;
        }
        String[] parts = limpio.toLowerCase(Locale.ROOT).split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.toString();
    }
}





