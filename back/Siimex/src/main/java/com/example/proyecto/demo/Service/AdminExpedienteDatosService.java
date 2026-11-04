package com.example.proyecto.demo.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.sql.Clob;
import java.util.*;
import java.util.function.LongConsumer;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class AdminExpedienteDatosService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    // Only profile tables are exportable. Never query auth credentials or verification tokens.
    private static final Map<String, String> SECCIONES;
    static {
        Map<String, String> tables = new LinkedHashMap<>();
        tables.put("Instituciones", "instituciones");
        tables.put("Areas de conocimiento", "areas_conocimiento");
        tables.put("Intereses y habilidades", "intereses_habilidades");
        tables.put("Perfil de migracion", "perfiles_migracion");
        tables.put("Trayectoria academica", "trayectorias_academicas");
        tables.put("Trayectoria profesional", "trayectorias_profesionales");
        tables.put("Estancias", "estancias");
        tables.put("Congresos", "congresos");
        tables.put("Divulgacion", "divulgaciones");
        tables.put("Articulos", "articulos");
        tables.put("Cursos", "cursos");
        tables.put("Idiomas", "idiomas");
        tables.put("Logros", "logros");
        tables.put("Herramientas", "herramientas");
        tables.put("Incidencia social", "incidencia_social");
        tables.put("Propiedad intelectual", "propiedad_intelectual");
        SECCIONES = Collections.unmodifiableMap(tables);
    }

    public record DocumentoExportable(long id, long usuarioId, String tipo, String nombre, long sizeBytes) {}

    public List<DocumentoExportable> documentos(List<Long> ids) {
        List<DocumentoExportable> result = new ArrayList<>();
        for (int start = 0; start < ids.size(); start += 500) {
            List<Long> batch = ids.subList(start, Math.min(ids.size(), start + 500));
            String placeholders = String.join(",", Collections.nCopies(batch.size(), "?"));
            result.addAll(jdbc.query("SELECT id, usuario_id, tipo, nombre_archivo, size_bytes FROM documentos " +
                            "WHERE usuario_id IN (" + placeholders + ") ORDER BY usuario_id, id",
                    (rs, row) -> new DocumentoExportable(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getLong(5)),
                    batch.toArray()));
        }
        return result;
    }

    public Map<String, Object> informacion(long id) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> usuarios = rows("SELECT id, nombre, apellido_paterno, apellido_materno, " +
                "visibilidad_perfil, consentimiento_directorio_publico, semblanza, registro2_completo FROM usuarios WHERE id = ?", id);
        if (usuarios.isEmpty()) throw new IllegalStateException("El usuario cambio durante la exportacion");
        result.put("Usuario", usuarios.get(0));
        List<Map<String, Object>> acceso = rows("SELECT a.email, a.username, a.enabled, a.locked, a.last_login_at " +
                "FROM auth_users a JOIN usuarios u ON u.auth_user_id = a.id WHERE u.id = ?", id);
        result.put("Cuenta", acceso);
        result.put("Roles", rows("SELECT r.role FROM auth_user_roles r JOIN usuarios u ON u.auth_user_id = r.auth_user_id WHERE u.id = ?", id));
        result.put("Datos personales y domicilio", rows("SELECT * FROM registro1 WHERE id = ?", id));
        SECCIONES.forEach((title, table) -> result.put(title, rows("SELECT * FROM " + table + " WHERE usuario_id = ? ORDER BY id", id)));
        result.put("Autores de articulos", rows("SELECT au.* FROM autores_articulos au JOIN articulos a ON a.id = au.articulo_id " +
                "WHERE a.usuario_id = ? ORDER BY au.articulo_id, au.orden, au.id", id));
        return result;
    }

    private List<Map<String, Object>> rows(String sql, long id) {
        return jdbc.query(sql, (rs, row) -> {
            Map<String, Object> values = new LinkedHashMap<>();
            for (int col = 1; col <= rs.getMetaData().getColumnCount(); col++) {
                String key = rs.getMetaData().getColumnLabel(col).toLowerCase(Locale.ROOT);
                if (key.matches(".*(password|token|secret|contrasena).*")) continue;
                Object value = rs.getObject(col);
                if (value instanceof Clob clob) {
                    value = clob.getSubString(1, Math.toIntExact(clob.length()));
                    clob.free();
                } else if (value instanceof java.util.Date || value instanceof java.time.temporal.TemporalAccessor) {
                    value = value.toString();
                }
                values.put(key, value);
            }
            return values;
        }, id);
    }

    public void escribirInformacion(ZipOutputStream zip, String folder, Map<String, Object> info,
                                    List<DocumentoExportable> documentos) throws IOException {
        Map<String, Object> exported = new LinkedHashMap<>(info);
        exported.put("Documentos", documentos);
        escribirTexto(zip, folder + "datos.json", mapper.writerWithDefaultPrettyPrinter().writeValueAsString(exported));
        StringBuilder html = new StringBuilder("<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><title>Expediente SIIMEX</title>" +
                "<style>body{font-family:Georgia,serif;color:#202735;max-width:1050px;margin:40px auto;padding:0 20px}" +
                "h1,h2{color:#6a0032}table{border-collapse:collapse;width:100%;margin:12px 0 24px;table-layout:fixed}" +
                "th,td{border:1px solid #ddd;padding:8px;text-align:left;overflow-wrap:anywhere;white-space:pre-wrap}th{width:30%;background:#f8f3f5}" +
                "@media print{body{margin:0}h2{break-after:avoid}tr{break-inside:avoid}}</style><h1>Expediente SIIMEX</h1>" +
                "<p>Informacion confidencial. Uso exclusivo de administracion.</p>");
        info.forEach((title, value) -> {
            html.append("<h2>").append(escape(title)).append("</h2>");
            render(html, value);
        });
        html.append("<h2>Documentos originales</h2><ul>");
        for (DocumentoExportable d : documentos) {
            html.append("<li><a href=\"").append(escape(rutaDocumento(d))).append("\">")
                    .append(escape(d.tipo() + " - " + d.nombre())).append("</a></li>");
        }
        if (documentos.isEmpty()) html.append("<li>Sin documentos registrados.</li>");
        html.append("</ul></html>");
        escribirTexto(zip, folder + "ficha.html", html.toString());
    }

    private void render(StringBuilder html, Object value) {
        if (value instanceof List<?> list) {
            if (list.isEmpty()) html.append("<p>Sin informacion registrada.</p>");
            list.forEach(item -> render(html, item));
        } else if (value instanceof Map<?, ?> values) {
            html.append("<table>");
            values.forEach((key, item) -> html.append("<tr><th>").append(escape(key.toString().replace('_', ' ')))
                    .append("</th><td>").append(escape(item == null ? "No registrado" : item.toString())).append("</td></tr>"));
            html.append("</table>");
        }
    }

    public static String rutaDocumento(DocumentoExportable d) {
        return "documentos/" + nombreSeguro(d.tipo()) + "/" + d.id() + "_" + nombreSeguro(d.nombre());
    }

    public static String nombreSeguro(String value) {
        String clean = com.example.proyecto.demo.util.FileSecurityUtils.sanitizeFilename(value, "archivo");
        clean = clean.replace("..", "_");
        if (clean.length() > 90) {
            int dot = clean.lastIndexOf('.');
            String extension = dot >= 0 && clean.length() - dot <= 12 ? clean.substring(dot) : "";
            clean = clean.substring(0, 90 - extension.length()) + extension;
        }
        return clean;
    }

    public void copiarDocumento(DocumentoExportable documento, OutputStream out, LongConsumer avance) {
        jdbc.query("SELECT contenido FROM documentos WHERE id = ? AND usuario_id = ?", rs -> {
            if (!rs.next()) throw new IllegalStateException("Un documento cambio durante la exportacion");
            try (InputStream input = rs.getBinaryStream(1)) {
                if (input == null) throw new IOException("Documento sin contenido");
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Exportacion cancelada");
                    out.write(buffer, 0, count);
                    avance.accept(count);
                }
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            return null;
        }, documento.id(), documento.usuarioId());
    }

    public static void escribirTexto(ZipOutputStream zip, String name, String text) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(text.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
