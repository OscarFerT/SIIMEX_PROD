package com.example.proyecto.demo.config;

import com.example.proyecto.demo.Entity.CatalogOption;
import com.example.proyecto.demo.Entity.CatalogOption.CatalogType;
import com.example.proyecto.demo.Repository.CatalogOptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.InputStream;
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
public class CatalogSeedRunner implements CommandLineRunner {

    private static final String ROOT_PARENT_KEY = "ROOT";
    private static final String ROOT_SCOPE_KEY = "ROOT";
    private static final String UNKNOWN_LOCALIDAD_PARENT_KEY = "SIN_MUNICIPIO";
    private static final String UNKNOWN_CP_SCOPE_KEY = "SIN_CP";

    private final CatalogOptionRepository catalogOptionRepository;
    private final JdbcTemplate jdbcTemplate;
    private final DataFormatter dataFormatter = new DataFormatter();

    @Override
    public void run(String... args) {
        try {
            asegurarEsquemaCatalogos();

            if (todosLosCatalogosYaSembrados()) {
                logCatalogosActuales();
                return;
            }

            ClassPathResource resource = new ClassPathResource("catalogos.xlsx");
            if (!resource.exists()) {
                log.warn(">>> No se encontró catalogos.xlsx en classpath; se omite siembra inicial de catálogos");
                return;
            }

            try (InputStream inputStream = resource.getInputStream(); Workbook workbook = WorkbookFactory.create(inputStream)) {
                seedEntidades(workbook.getSheet("ENTIDAD_FEDERATIVA"));
                seedMunicipios(workbook.getSheet("MUNICIPIOS"));
                seedLocalidades(workbook.getSheet("CAT_LOCALIDADES"));
                seedSimple(workbook.getSheet("NACIONALIDADES"), CatalogType.NACIONALIDAD, "CT_NACIONALIDAD", "NACIONALIDAD");
                seedSimple(workbook.getSheet("EDO.CIVIL"), CatalogType.ESTADO_CIVIL, "CT_EDO_CIVIL", "ESTADO_CIVIL");
                seedSimple(workbook.getSheet("IDENTIFICACION"), CatalogType.IDENTIFICACION_OFICIAL, "TP_ID_OFICIAL", "IDENTIFICACION");
                seedSimple(workbook.getSheet("RED SOCIAL"), CatalogType.RED_SOCIAL, "CT_RED_SOCIAL", "RED");
                seedSimple(workbook.getSheet("TIPO DE INSTITUCION"), CatalogType.TIPO_INSTITUCION, "CT_TIP_INSTITUCION", "TIPO DE INSTITUCION");
                seedSimple(workbook.getSheet("GRADO DE ESTUDIOS"), CatalogType.GRADO_ESTUDIOS, "CT_GDO_ESTUDIOS", "GRADO");
            }

            seedCarrerasDesdeRecurso();
            logCatalogosActuales();
        } catch (Exception ex) {
            log.error(">>> Error al sembrar catálogos iniciales: {}", ex.getMessage(), ex);
        }
    }

    private void asegurarEsquemaCatalogos() {
        if (!existeTabla("catalog_options")) {
            return;
        }

        if (!existeColumna("catalog_options", "scope_key")) {
            jdbcTemplate.execute("ALTER TABLE catalog_options ADD COLUMN scope_key VARCHAR(120) NULL AFTER parent_key");
            log.info(">>> Columna scope_key agregada a catalog_options");
        }

        jdbcTemplate.update(
                "UPDATE catalog_options SET parent_key = ? WHERE catalog_type <> 'LOCALIDAD' AND (parent_key IS NULL OR TRIM(parent_key) = '')",
                ROOT_PARENT_KEY
        );
        jdbcTemplate.update(
                "UPDATE catalog_options SET scope_key = ? WHERE catalog_type <> 'LOCALIDAD' AND (scope_key IS NULL OR TRIM(scope_key) = '')",
                ROOT_SCOPE_KEY
        );
        jdbcTemplate.update(
                "UPDATE catalog_options SET scope_key = CONCAT(COALESCE(NULLIF(TRIM(parent_key), ''), ?), '|', COALESCE(NULLIF(TRIM(extra_1), ''), ?)) WHERE catalog_type = 'LOCALIDAD' AND (scope_key IS NULL OR TRIM(scope_key) = '')",
                UNKNOWN_LOCALIDAD_PARENT_KEY,
                UNKNOWN_CP_SCOPE_KEY
        );

        dropIndexIfExists("catalog_options", "uk_catalog_type_clave");
        dropIndexIfExists("catalog_options", "uk_catalog_type_parent_clave");

        if (!existeIndice("catalog_options", "uk_catalog_type_scope_clave")) {
            jdbcTemplate.execute("CREATE UNIQUE INDEX uk_catalog_type_scope_clave ON catalog_options (catalog_type, scope_key, clave)");
            log.info(">>> Índice uk_catalog_type_scope_clave creado sobre catalog_type, scope_key y clave");
        }
    }

    private void dropIndexIfExists(String tableName, String indexName) {
        if (existeIndice(tableName, indexName)) {
            jdbcTemplate.execute("DROP INDEX " + indexName + " ON " + tableName);
            log.info(">>> Índice {} eliminado", indexName);
        }
    }

    private boolean existeTabla(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                Integer.class,
                tableName
        );
        return count != null && count > 0;
    }

    private boolean existeColumna(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                Integer.class,
                tableName,
                columnName
        );
        return count != null && count > 0;
    }

    private boolean existeIndice(String tableName, String indexName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
                Integer.class,
                tableName,
                indexName
        );
        return count != null && count > 0;
    }

    private boolean todosLosCatalogosYaSembrados() {
        return catalogOptionRepository.countByCatalogType(CatalogType.ENTIDAD_FEDERATIVA) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.MUNICIPIO) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.LOCALIDAD) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.NACIONALIDAD) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.ESTADO_CIVIL) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.IDENTIFICACION_OFICIAL) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.RED_SOCIAL) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.TIPO_INSTITUCION) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.GRADO_ESTUDIOS) > 0
                && catalogOptionRepository.countByCatalogType(CatalogType.CARRERA) > 0;
    }

    private void logCatalogosActuales() {
        log.info(">>> Conteo actual de catálogos: entidades={}, municipios={}, localidades={}, nacionalidades={}, estadosCiviles={}, identificaciones={}, redesSociales={}, tiposInstitucion={}, gradosEstudio={}, carreras={}",
                catalogOptionRepository.countByCatalogType(CatalogType.ENTIDAD_FEDERATIVA),
                catalogOptionRepository.countByCatalogType(CatalogType.MUNICIPIO),
                catalogOptionRepository.countByCatalogType(CatalogType.LOCALIDAD),
                catalogOptionRepository.countByCatalogType(CatalogType.NACIONALIDAD),
                catalogOptionRepository.countByCatalogType(CatalogType.ESTADO_CIVIL),
                catalogOptionRepository.countByCatalogType(CatalogType.IDENTIFICACION_OFICIAL),
                catalogOptionRepository.countByCatalogType(CatalogType.RED_SOCIAL),
                catalogOptionRepository.countByCatalogType(CatalogType.TIPO_INSTITUCION),
                catalogOptionRepository.countByCatalogType(CatalogType.GRADO_ESTUDIOS),
                catalogOptionRepository.countByCatalogType(CatalogType.CARRERA)
        );
    }

    private void seedEntidades(Sheet sheet) {
        if (sheet == null || catalogOptionRepository.countByCatalogType(CatalogType.ENTIDAD_FEDERATIVA) > 0) {
            return;
        }
        Map<String, Integer> headers = headers(sheet.getRow(sheet.getFirstRowNum()));
        List<CatalogOption> batch = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();
        for (int i = sheet.getFirstRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String clave = cell(row, headers, "CT_ENTIDAD_FEDERATIVA");
            String nombre = cell(row, headers, "ENTIDAD_FEDERATIVA");
            String abreviatura = cell(row, headers, "ABREVIATURA");
            if (clave.isBlank() || nombre.isBlank()) continue;
            agregarSiNoDuplicado(batch, seenKeys,
                    CatalogOption.builder()
                            .catalogType(CatalogType.ENTIDAD_FEDERATIVA)
                            .clave(clave)
                            .nombre(normalizarNombreComun(nombre))
                            .parentKey(ROOT_PARENT_KEY)
                            .scopeKey(ROOT_SCOPE_KEY)
                            .extra1(abreviatura)
                            .sortOrder(i)
                            .activo(true)
                            .build(),
                    "ENTIDAD_FEDERATIVA", i);
        }
        catalogOptionRepository.saveAll(batch);
        log.info(">>> Catálogo ENTIDAD_FEDERATIVA sembrado con {} registros", batch.size());
    }

    private void seedMunicipios(Sheet sheet) {
        if (sheet == null || catalogOptionRepository.countByCatalogType(CatalogType.MUNICIPIO) > 0) {
            return;
        }
        Map<String, Integer> headers = headers(sheet.getRow(sheet.getFirstRowNum()));
        List<CatalogOption> batch = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();
        for (int i = sheet.getFirstRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String clave = cell(row, headers, "CT_MUNICIPIO");
            String nombre = cell(row, headers, "MUNICIPIO");
            if (clave.isBlank() || nombre.isBlank()) continue;
            agregarSiNoDuplicado(batch, seenKeys,
                    CatalogOption.builder()
                            .catalogType(CatalogType.MUNICIPIO)
                            .clave(clave)
                            .nombre(normalizarNombreComun(nombre))
                            .parentKey(ROOT_PARENT_KEY)
                            .scopeKey(ROOT_SCOPE_KEY)
                            .sortOrder(i)
                            .activo(true)
                            .build(),
                    "MUNICIPIOS", i);
        }
        catalogOptionRepository.saveAll(batch);
        log.info(">>> Catálogo MUNICIPIO sembrado con {} registros", batch.size());
    }

    private void seedLocalidades(Sheet sheet) {
        if (sheet == null || catalogOptionRepository.countByCatalogType(CatalogType.LOCALIDAD) > 0) {
            return;
        }
        Map<String, Integer> headers = headers(sheet.getRow(sheet.getFirstRowNum()));
        List<CatalogOption> batch = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();
        for (int i = sheet.getFirstRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String clave = cell(row, headers, "CT_LOCALIDAD");
            String nombre = cell(row, headers, "LOCALIDAD");
            String codigoPostal = cell(row, headers, "CODIGO_POSTAL");
            String municipioClave = cell(row, headers, "CVE_MUNICIPIO");
            String municipioNombre = cell(row, headers, "MUNICIPIO");
            if (clave.isBlank() || nombre.isBlank()) continue;
            agregarSiNoDuplicado(batch, seenKeys,
                    CatalogOption.builder()
                            .catalogType(CatalogType.LOCALIDAD)
                            .clave(clave)
                            .nombre(normalizarNombreComun(nombre))
                            .parentKey(parentKeyLocalidad(municipioClave))
                            .scopeKey(scopeKeyLocalidad(municipioClave, codigoPostal))
                            .extra1(codigoPostal)
                            .extra2(normalizarNombreComun(municipioNombre))
                            .sortOrder(i)
                            .activo(true)
                            .build(),
                    "CAT_LOCALIDADES", i);
        }
        catalogOptionRepository.saveAll(batch);
        log.info(">>> Catálogo LOCALIDAD sembrado con {} registros", batch.size());
    }

    private void seedCarrerasDesdeRecurso() {
        if (catalogOptionRepository.countByCatalogType(CatalogType.CARRERA) > 0) {
            return;
        }
        ClassPathResource resource = new ClassPathResource("carreras.xlsx");
        if (!resource.exists()) {
            log.warn(">>> No se encontró carreras.xlsx en classpath; se omite siembra de carreras");
            return;
        }
        try (InputStream inputStream = resource.getInputStream(); Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            seedSimple(sheet, CatalogType.CARRERA, "ID_CARRERA", "DESCRIPCION");
        } catch (Exception ex) {
            log.error(">>> Error al sembrar catálogo CARRERA: {}", ex.getMessage(), ex);
        }
    }
    private void seedSimple(Sheet sheet, CatalogType type, String keyHeader, String nameHeader) {
        if (sheet == null || catalogOptionRepository.countByCatalogType(type) > 0) {
            return;
        }
        Map<String, Integer> headers = headers(sheet.getRow(sheet.getFirstRowNum()));
        List<CatalogOption> batch = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();
        for (int i = sheet.getFirstRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String clave = cell(row, headers, keyHeader);
            String nombre = cell(row, headers, nameHeader);
            if (clave.isBlank() || nombre.isBlank()) continue;
            agregarSiNoDuplicado(batch, seenKeys,
                    CatalogOption.builder()
                            .catalogType(type)
                            .clave(clave)
                            .nombre(normalizarPorTipo(type, nombre))
                            .parentKey(ROOT_PARENT_KEY)
                            .scopeKey(ROOT_SCOPE_KEY)
                            .sortOrder(i)
                            .activo(true)
                            .build(),
                    type.name(), i);
        }
        catalogOptionRepository.saveAll(batch);
        log.info(">>> Catálogo {} sembrado con {} registros", type.name(), batch.size());
    }

    private void agregarSiNoDuplicado(List<CatalogOption> batch, Set<String> seenKeys, CatalogOption option, String hoja, int rowIndex) {
        String dedupeKey = option.getCatalogType().name() + "|" + normalizarBasico(option.getScopeKey()).toUpperCase(Locale.ROOT) + "|" + normalizarBasico(option.getClave()).toUpperCase(Locale.ROOT);
        if (!seenKeys.add(dedupeKey)) {
            log.warn(">>> Registro duplicado omitido en hoja {} fila {}: tipo={}, scopeKey={}, clave={}, nombre={}",
                    hoja,
                    rowIndex + 1,
                    option.getCatalogType().name(),
                    option.getScopeKey(),
                    option.getClave(),
                    option.getNombre());
            return;
        }
        batch.add(option);
    }

    private String parentKeyLocalidad(String municipioClave) {
        String value = municipioClave == null ? "" : municipioClave.trim();
        return value.isBlank() ? UNKNOWN_LOCALIDAD_PARENT_KEY : value;
    }

    private String scopeKeyLocalidad(String municipioClave, String codigoPostal) {
        String municipio = parentKeyLocalidad(municipioClave);
        String cp = codigoPostal == null ? "" : codigoPostal.trim();
        return municipio + "|" + (cp.isBlank() ? UNKNOWN_CP_SCOPE_KEY : cp);
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

    private String normalizarPorTipo(CatalogType type, String value) {
        if (type == CatalogType.ESTADO_CIVIL) {
            return normalizarEstadoCivil(value);
        }
        return normalizarNombreComun(value);
    }

    private String normalizarEstadoCivil(String value) {
        String v = normalizarBasico(value).replace("(A)", "(a)");
        if ("SOLTERO (a)".equalsIgnoreCase(v)) return "Soltero(a)";
        if ("CASADO (a)".equalsIgnoreCase(v)) return "Casado(a)";
        if ("DIVORCIADO (a)".equalsIgnoreCase(v)) return "Divorciado(a)";
        if ("VIUDO (a)".equalsIgnoreCase(v)) return "Viudo(a)";
        if ("UNION LIBRE".equalsIgnoreCase(v) || "UNIÓN LIBRE".equalsIgnoreCase(v)) return "Unión Libre";
        if ("NINGUNO".equalsIgnoreCase(v)) return "Ninguno";
        return v;
    }

    private String normalizarNombreComun(String value) {
        String limpio = normalizarBasico(value);
        if (limpio.isBlank()) return limpio;
        String[] parts = limpio.toLowerCase(Locale.ROOT).split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) continue;
            if (sb.length() > 0) sb.append(' ');
            if (part.length() == 1) {
                sb.append(part.toUpperCase(Locale.ROOT));
            } else {
                sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
            }
        }
        return sb.toString().replace(" De ", " de ").replace(" Del ", " del ").replace(" Y ", " y ");
    }

    private String normalizarBasico(String value) {
        if (value == null) return "";
        return value.trim().replaceAll("\\s+", " ");
    }
}
