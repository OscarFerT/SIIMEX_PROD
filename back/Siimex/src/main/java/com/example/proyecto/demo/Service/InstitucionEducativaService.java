package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.InstitucionEducativa;
import com.example.proyecto.demo.Entity.Notificacion;
import com.example.proyecto.demo.Repository.InstitucionEducativaRepository;
import com.example.proyecto.demo.exception.ApiException;
import com.example.proyecto.demo.util.FileSecurityUtils;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InstitucionEducativaService {

    private static final long MAX_IMPORT_SIZE = 10L * 1024L * 1024L;

    private final InstitucionEducativaRepository institucionEducativaRepository;
    private final NotificacionService notificacionService;

    public List<InstitucionEducativa> listar(String q) {
        String query = q != null ? q.trim() : null;
        return institucionEducativaRepository.buscar(query);
    }

    public List<InstitucionEducativa> listarActivas() {
        return institucionEducativaRepository.findByEstadoOrderByNombreAsc(InstitucionEducativa.EstadoInstitucion.ACTIVA);
    }

    public InstitucionEducativa crear(Map<String, Object> body, Long usuarioSolicitanteId, boolean notificarAdmins) {
        String cct = normalizarCct(getString(body, "cct"));
        String nombre = normalizarTextoRequerido(getString(body, "nombre"), "El nombre es obligatorio", 220);
        if (cct != null && institucionEducativaRepository.existsByCctIgnoreCase(cct)) {
            throw new ApiException(HttpStatus.CONFLICT, "La CCT ya existe en el catálogo");
        }

        InstitucionEducativa.EstadoInstitucion estado = parseEstado(getString(body, "estado"), InstitucionEducativa.EstadoInstitucion.PENDIENTE_VALIDACION);
        if (usuarioSolicitanteId != null && body != null && body.get("estado") == null) {
            estado = InstitucionEducativa.EstadoInstitucion.PENDIENTE_VALIDACION;
        }

        InstitucionEducativa i = InstitucionEducativa.builder()
                .cct(cct)
                .nombre(nombre)
                .domicilio(normalizarTextoOpcional(getString(body, "domicilio"), 250))
                .colonia(normalizarTextoOpcional(getString(body, "colonia"), 180))
                .codigoPostal(normalizarCodigoPostal(getString(body, "codigoPostal")))
                .municipio(normalizarTextoOpcional(getString(body, "municipio"), 120))
                .entidadFederativa(normalizarTextoOpcional(getString(body, "entidadFederativa"), 120))
                .telefono(normalizarTextoOpcional(getString(body, "telefono"), 30))
                .director(normalizarTextoOpcional(getString(body, "director"), 180))
                .correo(normalizarCorreo(getString(body, "correo")))
                .nivelEducativo(normalizarTextoOpcional(getString(body, "nivelEducativo"), 120))
                .estado(estado)
                .solicitudUsuarioId(usuarioSolicitanteId)
                .build();
        InstitucionEducativa saved = institucionEducativaRepository.save(i);

        if (notificarAdmins) {
            try {
                notificacionService.crearParaAdmins(
                        "Nueva solicitud de institución educativa",
                        "Se registró una institución pendiente de validación: \"" + saved.getNombre() + "\".",
                        Notificacion.TipoNotificacion.SISTEMA,
                        "/admin/instituciones-educativas");
            } catch (Exception ignored) {
            }
        }
        return saved;
    }

    public InstitucionEducativa actualizar(Long id, Map<String, Object> body) {
        InstitucionEducativa i = obtener(id);
        String cct = normalizarCct(getString(body, "cct"));
        if (cct != null && !cct.equalsIgnoreCase(i.getCct()) && institucionEducativaRepository.existsByCctIgnoreCase(cct)) {
            throw new ApiException(HttpStatus.CONFLICT, "La CCT ya existe en el catálogo");
        }
        String nombre = normalizarTextoRequerido(getString(body, "nombre"), "El nombre es obligatorio", 220);

        i.setCct(cct);
        i.setNombre(nombre);
        i.setDomicilio(normalizarTextoOpcional(getString(body, "domicilio"), 250));
        i.setColonia(normalizarTextoOpcional(getString(body, "colonia"), 180));
        i.setCodigoPostal(normalizarCodigoPostal(getString(body, "codigoPostal")));
        i.setMunicipio(normalizarTextoOpcional(getString(body, "municipio"), 120));
        i.setEntidadFederativa(normalizarTextoOpcional(getString(body, "entidadFederativa"), 120));
        i.setTelefono(normalizarTextoOpcional(getString(body, "telefono"), 30));
        i.setDirector(normalizarTextoOpcional(getString(body, "director"), 180));
        i.setCorreo(normalizarCorreo(getString(body, "correo")));
        i.setNivelEducativo(normalizarTextoOpcional(getString(body, "nivelEducativo"), 120));
        i.setEstado(parseEstado(getString(body, "estado"), i.getEstado()));
        return institucionEducativaRepository.save(i);
    }

    public void eliminar(Long id) {
        if (!institucionEducativaRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Institución educativa no encontrada");
        }
        institucionEducativaRepository.deleteById(id);
    }

    public InstitucionEducativa obtener(Long id) {
        return institucionEducativaRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Institución educativa no encontrada"));
    }

    public byte[] generarPlantillaExcel() {
        String[] headers = {
                "CCT",
                "Nombre",
                "Domicilio",
                "Colonia",
                "Codigo postal",
                "Municipio",
                "Entidad federativa",
                "Telefono",
                "Director",
                "Correo",
                "Nivel educativo",
                "Estado (ACTIVA/PENDIENTE_VALIDACION/RECHAZADA)"
        };
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Instituciones");
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                headerRow.createCell(i).setCellValue(headers[i]);
            }
            sheet.createRow(1);
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }
            workbook.write(bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo generar la plantilla XLSX");
        }
    }

    public Map<String, Object> importarDesdeArchivo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes adjuntar un archivo para importar");
        }
        if (file.getSize() > MAX_IMPORT_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El archivo de importación no puede superar 10 MB");
        }
        String extension = FileSecurityUtils.extensionOf(file.getOriginalFilename());
        List<List<String>> filas;
        if ("xlsx".equals(extension)) {
            if (!FileSecurityUtils.isOfficeDocument(file)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Usa una plantilla XLSX válida");
            }
            filas = parsearFilasExcel(file);
        } else if ("csv".equals(extension) || "txt".equals(extension)) {
            filas = parsearFilasTexto(file);
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo se permiten archivos XLSX, CSV o TXT");
        }
        if (filas.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El archivo no contiene registros válidos");
        }

        int creadas = 0;
        int actualizadas = 0;
        int ignoradas = 0;
        List<String> errores = new ArrayList<>();

        for (int i = 0; i < filas.size(); i++) {
            List<String> c = filas.get(i);
            if (c.stream().allMatch(v -> v == null || v.trim().isEmpty())) {
                ignoradas++;
                continue;
            }
            String cctRaw = valorCol(c, 0);
            String nombre = valorCol(c, 1);
            if (nombre == null || nombre.isBlank()) {
                errores.add("Fila " + (i + 2) + ": nombre obligatorio");
                continue;
            }
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("cct", cctRaw);
            body.put("nombre", nombre);
            body.put("domicilio", valorCol(c, 2));
            body.put("colonia", valorCol(c, 3));
            body.put("codigoPostal", valorCol(c, 4));
            body.put("municipio", valorCol(c, 5));
            body.put("entidadFederativa", valorCol(c, 6));
            body.put("telefono", valorCol(c, 7));
            body.put("director", valorCol(c, 8));
            body.put("correo", valorCol(c, 9));
            body.put("nivelEducativo", valorCol(c, 10));
            body.put("estado", valorCol(c, 11));

            try {
                String cctNorm = normalizarCct(cctRaw);
                if (cctNorm != null) {
                    InstitucionEducativa existente = institucionEducativaRepository.findByCctIgnoreCase(cctNorm).orElse(null);
                    if (existente != null) {
                        actualizar(existente.getId(), body);
                        actualizadas++;
                        continue;
                    }
                }
                crear(body, null, false);
                creadas++;
            } catch (Exception ex) {
                errores.add("Fila " + (i + 2) + ": " + (ex.getMessage() != null ? ex.getMessage() : "error de validación"));
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("creadas", creadas);
        out.put("actualizadas", actualizadas);
        out.put("ignoradas", ignoradas);
        out.put("errores", errores);
        out.put("totalProcesadas", filas.size());
        return out;
    }

    public Map<String, Object> toMap(InstitucionEducativa i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("cct", i.getCct());
        m.put("nombre", i.getNombre());
        m.put("domicilio", i.getDomicilio());
        m.put("colonia", i.getColonia());
        m.put("codigoPostal", i.getCodigoPostal());
        m.put("municipio", i.getMunicipio());
        m.put("entidadFederativa", i.getEntidadFederativa());
        m.put("telefono", i.getTelefono());
        m.put("director", i.getDirector());
        m.put("correo", i.getCorreo());
        m.put("nivelEducativo", i.getNivelEducativo());
        m.put("estado", i.getEstado() != null ? i.getEstado().name() : null);
        m.put("solicitudUsuarioId", i.getSolicitudUsuarioId());
        m.put("createdAt", i.getCreatedAt() != null ? i.getCreatedAt().toString() : null);
        m.put("updatedAt", i.getUpdatedAt() != null ? i.getUpdatedAt().toString() : null);
        return m;
    }

    private String getString(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) return null;
        return String.valueOf(body.get(key));
    }

    private List<List<String>> parsearFilasTexto(MultipartFile file) {
        String raw;
        try {
            raw = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No se pudo leer el archivo de importación");
        }
        String source = raw.trim();
        if (source.isBlank()) return List.of();

        List<List<String>> rows = new ArrayList<>();
        String[] lineas = source.replace("\r\n", "\n").replace('\r', '\n').split("\n");
        char delim = detectarDelimitador(lineas.length > 0 ? lineas[0] : "");
        for (int i = 1; i < lineas.length; i++) {
            String line = lineas[i];
            if (line == null || line.isBlank()) continue;
            String[] cols = (delim == '\t') ? line.split("\t", -1) : line.split(",", -1);
            List<String> row = new ArrayList<>();
            for (String col : cols) {
                row.add(limpiarCelda(col));
            }
            rows.add(row);
        }
        return rows;
    }

    private List<List<String>> parsearFilasExcel(MultipartFile file) {
        List<List<String>> rows = new ArrayList<>();
        DataFormatter formatter = new DataFormatter(Locale.forLanguageTag("es-MX"));
        try (InputStream is = file.getInputStream(); Workbook workbook = WorkbookFactory.create(is)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) return rows;

            boolean primeraFila = true;
            for (Row row : sheet) {
                if (primeraFila) {
                    primeraFila = false;
                    continue;
                }
                int maxCell = row.getLastCellNum();
                if (maxCell < 0) continue;
                List<String> cols = new ArrayList<>();
                for (int c = 0; c < maxCell; c++) {
                    Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    cols.add(cell == null ? "" : limpiarCelda(formatter.formatCellValue(cell)));
                }
                rows.add(cols);
            }
            return rows;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No se pudo leer el archivo Excel. Usa una plantilla XLSX válida.");
        }
    }

    private char detectarDelimitador(String headerLine) {
        if (headerLine == null) return ',';
        int tabs = headerLine.split("\t", -1).length;
        int commas = headerLine.split(",", -1).length;
        return tabs > commas ? '\t' : ',';
    }

    private String limpiarCelda(String value) {
        if (value == null) return null;
        String v = value.trim();
        if (v.startsWith("\"") && v.endsWith("\"") && v.length() >= 2) {
            v = v.substring(1, v.length() - 1);
        }
        return v.replace("&nbsp;", " ").replace("&amp;", "&").trim();
    }

    private String valorCol(List<String> cols, int index) {
        if (cols == null || index < 0 || index >= cols.size()) return null;
        String v = cols.get(index);
        return (v != null && !v.isBlank()) ? v.trim() : null;
    }

    private String normalizarCct(String value) {
        String limpio = value != null ? value.trim().toUpperCase(Locale.ROOT) : "";
        if (limpio.isBlank()) return null;
        limpio = limpio.replaceAll("\\s+", "");
        if (limpio.length() > 25) {
            limpio = limpio.substring(0, 25);
        }
        return limpio;
    }

    private String normalizarTextoRequerido(String value, String msg, int maxLen) {
        String limpio = value != null ? value.trim() : "";
        if (limpio.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, msg);
        }
        return limpio.length() > maxLen ? limpio.substring(0, maxLen) : limpio;
    }

    private String normalizarTextoOpcional(String value, int maxLen) {
        String limpio = value != null ? value.trim() : "";
        if (limpio.isBlank()) return null;
        return limpio.length() > maxLen ? limpio.substring(0, maxLen) : limpio;
    }

    private String normalizarCodigoPostal(String value) {
        String limpio = value != null ? value.replaceAll("\\s+", "").trim() : "";
        if (limpio.isBlank()) return null;
        if (!limpio.matches("^[0-9]{4,10}$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El código postal debe contener entre 4 y 10 dígitos");
        }
        return limpio;
    }

    private String normalizarCorreo(String value) {
        String limpio = value != null ? value.trim().toLowerCase(Locale.ROOT) : "";
        if (limpio.isBlank()) return null;
        if (!limpio.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El correo de institución no es válido");
        }
        return limpio.length() > 180 ? limpio.substring(0, 180) : limpio;
    }

    private InstitucionEducativa.EstadoInstitucion parseEstado(String value, InstitucionEducativa.EstadoInstitucion fallback) {
        String v = value != null ? value.trim() : "";
        if (v.isBlank()) return fallback;
        try {
            return InstitucionEducativa.EstadoInstitucion.valueOf(v.toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Estado inválido. Usa ACTIVA, PENDIENTE_VALIDACION o RECHAZADA");
        }
    }

}
