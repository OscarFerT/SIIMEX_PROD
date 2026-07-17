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

    private final ConfiguracionSistemaRepository configuracionSistemaRepository;

    @Value("${app.registro.folio.prefix.investigador:SIIMEX-INV}")
    private String defaultPrefixInvestigador;
    @Value("${app.registro.folio.prefix.innovador:SIIMEX-IND}")
    private String defaultPrefixInnovador;
    @Value("${app.registro.folio.prefix.hibrido:SIIMEX-HIB}")
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
