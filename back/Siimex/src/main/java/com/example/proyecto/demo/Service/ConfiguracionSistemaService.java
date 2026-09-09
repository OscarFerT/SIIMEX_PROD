package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.ConfiguracionSistema;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Repository.ConfiguracionSistemaRepository;
import com.example.proyecto.demo.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ConfiguracionSistemaService {

    private static final String CLAVE_PREFIX_INV = "REGISTRO_FOLIO_PREFIX_INV";
    private static final String CLAVE_PREFIX_IND = "REGISTRO_FOLIO_PREFIX_IND";
    private static final String CLAVE_PREFIX_HIB = "REGISTRO_FOLIO_PREFIX_HIB";

    public static final int PDF_LIMIT_DEFAULT_MB = 2;
    public static final int PDF_LIMIT_MIN_MB = 1;
    public static final int PDF_LIMIT_MAX_MB = 25;

    private static final List<Map<String, String>> PDF_LIMIT_DEFINITIONS = List.of(
            pdfLimit("registro.documentos", "Registro inicial", "Documentos oficiales", "INE, cedula profesional, domicilio y constancia SNII."),
            pdfLimit("registro.perfilAcademico", "Completar registro", "Perfil academico", "Titulo, cedula, constancias SNII y documentos probatorios academicos."),
            pdfLimit("registro.idiomas", "Completar registro", "Dominio de idiomas", "Certificados o comprobantes de idioma."),
            pdfLimit("registro.estancias", "Completar registro", "Estancias de investigacion", "Constancias de estancia o cartas institucionales."),
            pdfLimit("registro.divulgacion", "Completar registro", "Divulgacion", "Evidencias PDF de productos de divulgacion."),
            pdfLimit("perfil.documentos", "Perfil", "Documentos del perfil", "INE, cedula, CV/curriculum y constancias visibles desde perfil."),
            pdfLimit("perfil.certificaciones", "Perfil", "Certificaciones", "Certificaciones agregadas en trayectoria/perfil."),
            pdfLimit("perfil.propiedadIntelectual", "Perfil", "Propiedad intelectual", "Documentos adjuntos para propiedad intelectual."),
            pdfLimit("perfil.rubros", "Perfil", "Evidencias por rubro", "Evidencias generales agregadas desde los modales de trayectoria."),
            pdfLimit("postulacion.curriculum", "Postulaciones", "Curriculum de postulacion", "Curriculum adjunto al enviar una postulacion."),
            pdfLimit("postulacion.documentos", "Postulaciones", "Documentos requeridos", "Documentos configurables solicitados por convocatoria."),
            pdfLimit("postulacion.informes", "Postulaciones", "Informes", "Informes parcial y final."),
            pdfLimit("postulacion.reciboPago", "Postulaciones", "Recibo de pago", "Comprobante de recepcion del apoyo."),
            pdfLimit("evaluacion.documentos", "Evaluacion", "Documentos de evaluacion", "Cartas, dictamenes o constancias firmadas por evaluadores.")
    );
    private final ConfiguracionSistemaRepository configuracionSistemaRepository;

    @Value("${app.registro.folio.prefix.investigador}")
    private String defaultPrefixInvestigador;
    @Value("${app.registro.folio.prefix.innovador}")
    private String defaultPrefixInnovador;
    @Value("${app.registro.folio.prefix.hibrido}")
    private String defaultPrefixHibrido;

    public Map<String, Object> obtenerPrefijosRegistro() {
        Map<String, String> defaults = defaultsNormalizados();
        Map<String, String> actuales = new LinkedHashMap<>(defaults);

        List<ConfiguracionSistema> rows = configuracionSistemaRepository.findByClaveIn(List.of(
                CLAVE_PREFIX_INV, CLAVE_PREFIX_IND, CLAVE_PREFIX_HIB
        ));
        for (ConfiguracionSistema row : rows) {
            if (row == null || row.getClave() == null) continue;
            String clave = row.getClave().trim().toUpperCase(Locale.ROOT);
            if (CLAVE_PREFIX_INV.equals(clave)) {
                actuales.put("investigador", normalizarPrefijoConFallback(row.getValor(), defaults.get("investigador")));
            } else if (CLAVE_PREFIX_IND.equals(clave)) {
                actuales.put("innovador", normalizarPrefijoConFallback(row.getValor(), defaults.get("innovador")));
            } else if (CLAVE_PREFIX_HIB.equals(clave)) {
                actuales.put("hibrido", normalizarPrefijoConFallback(row.getValor(), defaults.get("hibrido")));
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("investigador", actuales.get("investigador"));
        out.put("innovador", actuales.get("innovador"));
        out.put("hibrido", actuales.get("hibrido"));
        out.put("defaults", defaults);
        return out;
    }

    @Transactional
    public Map<String, Object> actualizarPrefijosRegistro(String investigador, String innovador, String hibrido) {
        Map<String, Object> actuales = obtenerPrefijosRegistro();

        String invActual = String.valueOf(actuales.getOrDefault("investigador", ""));
        String indActual = String.valueOf(actuales.getOrDefault("innovador", ""));
        String hibActual = String.valueOf(actuales.getOrDefault("hibrido", ""));

        String invFinal = investigador != null
                ? normalizarPrefijoParaPersistencia(investigador, "prefijo de investigador")
                : invActual;
        String indFinal = innovador != null
                ? normalizarPrefijoParaPersistencia(innovador, "prefijo de innovador")
                : indActual;
        String hibFinal = hibrido != null
                ? normalizarPrefijoParaPersistencia(hibrido, "prefijo de hibrido")
                : hibActual;

        upsert(CLAVE_PREFIX_INV, invFinal, "Prefijo de folio de registro para perfil investigador");
        upsert(CLAVE_PREFIX_IND, indFinal, "Prefijo de folio de registro para perfil innovador");
        upsert(CLAVE_PREFIX_HIB, hibFinal, "Prefijo de folio de registro para perfil mixto");

        return obtenerPrefijosRegistro();
    }

    public String resolverPrefijoRegistro(Registro1.TipoPerfil tipoPerfil) {
        Map<String, Object> map = obtenerPrefijosRegistro();
        Registro1.TipoPerfil perfil = tipoPerfil != null ? tipoPerfil : Registro1.TipoPerfil.INVESTIGADOR;
        return switch (perfil) {
            case INNOVADOR -> String.valueOf(map.getOrDefault("innovador", "SIIMEX-IND"));
            case HIBRIDO -> String.valueOf(map.getOrDefault("hibrido", "SIIMEX-HIB"));
            default -> String.valueOf(map.getOrDefault("investigador", "SIIMEX-INV"));
        };
    }

    public Map<String, Object> obtenerLimitesPdf() {
        List<Map<String, Object>> items = PDF_LIMIT_DEFINITIONS.stream().map(def -> {
            String key = def.get("key");
            int maxMb = obtenerLimitePdfMb(key);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", key);
            item.put("modulo", def.get("modulo"));
            item.put("seccion", def.get("seccion"));
            item.put("descripcion", def.get("descripcion"));
            item.put("maxMb", maxMb);
            item.put("defaultMb", PDF_LIMIT_DEFAULT_MB);
            item.put("maxBytes", mbToBytes(maxMb));
            return item;
        }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("defaultMb", PDF_LIMIT_DEFAULT_MB);
        out.put("minMb", PDF_LIMIT_MIN_MB);
        out.put("maxMb", PDF_LIMIT_MAX_MB);
        return out;
    }

    @Transactional
    public Map<String, Object> actualizarLimitesPdf(Map<String, Object> body) {
        Map<String, Object> valores = extraerMapaLimites(body);
        if (valores.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes enviar al menos un limite PDF");
        }

        for (Map<String, String> def : PDF_LIMIT_DEFINITIONS) {
            String key = def.get("key");
            if (!valores.containsKey(key)) continue;
            int maxMb = normalizarLimitePdfMb(valores.get(key), def.get("seccion"));
            upsert(claveConfiguracionPdf(key), String.valueOf(maxMb),
                    "Limite maximo PDF en MB para " + def.get("modulo") + " - " + def.get("seccion"));
        }
        return obtenerLimitesPdf();
    }

    public int obtenerLimitePdfMb(String key) {
        String keyNormalizada = normalizarClaveLimitePdf(key);
        String configKey = claveConfiguracionPdf(keyNormalizada);
        return configuracionSistemaRepository.findByClave(configKey)
                .map(row -> parseLimitePdfMb(row.getValor(), PDF_LIMIT_DEFAULT_MB))
                .orElse(PDF_LIMIT_DEFAULT_MB);
    }

    public long obtenerLimitePdfBytes(String key) {
        return mbToBytes(obtenerLimitePdfMb(key));
    }

    public String mensajeLimitePdf(String etiqueta, String key) {
        int maxMb = obtenerLimitePdfMb(key);
        return etiqueta + ": el archivo no puede superar " + maxMb + " MB";
    }

    private static Map<String, String> pdfLimit(String key, String modulo, String seccion, String descripcion) {
        Map<String, String> item = new LinkedHashMap<>();
        item.put("key", key);
        item.put("modulo", modulo);
        item.put("seccion", seccion);
        item.put("descripcion", descripcion);
        return item;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extraerMapaLimites(Map<String, Object> body) {
        if (body == null) return Map.of();
        Object limites = body.get("limites");
        if (limites instanceof Map<?, ?> raw) {
            Map<String, Object> out = new LinkedHashMap<>();
            raw.forEach((k, v) -> {
                if (k != null) out.put(String.valueOf(k), v);
            });
            return out;
        }
        return body;
    }

    private int normalizarLimitePdfMb(Object value, String seccion) {
        int parsed = parseLimitePdfMb(value, -1);
        if (parsed < PDF_LIMIT_MIN_MB || parsed > PDF_LIMIT_MAX_MB) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "El limite PDF de " + seccion + " debe estar entre " + PDF_LIMIT_MIN_MB + " y " + PDF_LIMIT_MAX_MB + " MB");
        }
        return parsed;
    }

    private int parseLimitePdfMb(Object value, int fallback) {
        if (value == null) return fallback;
        try {
            if (value instanceof Number n) return n.intValue();
            String raw = String.valueOf(value).trim().replace("MB", "").replace("mb", "").trim();
            if (raw.isBlank()) return fallback;
            return Integer.parseInt(raw);
        } catch (Exception e) {
            return fallback;
        }
    }

    private String normalizarClaveLimitePdf(String key) {
        String clean = key != null ? key.trim() : "";
        return PDF_LIMIT_DEFINITIONS.stream()
                .map(def -> def.get("key"))
                .filter(k -> k.equalsIgnoreCase(clean))
                .findFirst()
                .orElse("perfil.rubros");
    }

    private String claveConfiguracionPdf(String key) {
        String safe = normalizarClaveLimitePdf(key)
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
        return "PDF_MAX_MB_" + safe;
    }

    private long mbToBytes(int mb) {
        return mb * 1024L * 1024L;
    }
    private Map<String, String> defaultsNormalizados() {
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("investigador", normalizarPrefijoConFallback(defaultPrefixInvestigador, "SIIMEX-INV"));
        defaults.put("innovador", normalizarPrefijoConFallback(defaultPrefixInnovador, "SIIMEX-IND"));
        defaults.put("hibrido", normalizarPrefijoConFallback(defaultPrefixHibrido, "SIIMEX-HIB"));
        return defaults;
    }

    private String normalizarPrefijoConFallback(String value, String fallback) {
        String clean = sanitizarPrefijo(value);
        return clean.isBlank() ? fallback : clean;
    }

    private String normalizarPrefijoParaPersistencia(String value, String etiqueta) {
        String clean = sanitizarPrefijo(value);
        if (clean.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El " + etiqueta + " es obligatorio");
        }
        if (clean.length() > 40) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El " + etiqueta + " no puede superar 40 caracteres");
        }
        return clean;
    }

    private String sanitizarPrefijo(String value) {
        String clean = value != null ? value.trim().toUpperCase(Locale.ROOT) : "";
        clean = clean.replaceAll("[^A-Z0-9-]", "");
        clean = clean.replaceAll("-{2,}", "-");
        clean = clean.replaceAll("^-|-$", "");
        return clean;
    }

    private void upsert(String clave, String valor, String descripcion) {
        ConfiguracionSistema row = configuracionSistemaRepository.findByClave(clave)
                .orElseGet(() -> ConfiguracionSistema.builder().clave(clave).build());
        row.setValor(valor);
        row.setDescripcion(descripcion);
        configuracionSistemaRepository.save(row);
    }
}
