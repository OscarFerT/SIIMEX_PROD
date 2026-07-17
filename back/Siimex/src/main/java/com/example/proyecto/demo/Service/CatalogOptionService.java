package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.CatalogOption;
import com.example.proyecto.demo.Entity.CatalogOption.CatalogType;
import com.example.proyecto.demo.Repository.CatalogOptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CatalogOptionService {

    private final CatalogOptionRepository catalogOptionRepository;

    public List<Map<String, Object>> listar(CatalogType type, String parentKey, String query, String extra1) {
        List<CatalogOption> items;
        if (parentKey != null && !parentKey.isBlank()) {
            items = catalogOptionRepository.findByCatalogTypeAndParentKeyIgnoreCaseAndActivoTrueOrderBySortOrderAscNombreAsc(type, parentKey.trim());
        } else {
            items = catalogOptionRepository.findByCatalogTypeAndActivoTrueOrderBySortOrderAscNombreAsc(type);
        }

        return items.stream()
                .filter(item -> coincideExtra1(item, extra1))
                .filter(item -> coincideBusqueda(item, query))
                .sorted(Comparator.comparing((CatalogOption item) -> item.getSortOrder() != null ? item.getSortOrder() : Integer.MAX_VALUE)
                        .thenComparing(CatalogOption::getNombre, String.CASE_INSENSITIVE_ORDER))
                .map(this::toMap)
                .collect(Collectors.toList());
    }

    private boolean coincideExtra1(CatalogOption item, String extra1) {
        if (extra1 == null || extra1.isBlank()) {
            return true;
        }
        return normalizar(item.getExtra1()).equals(normalizar(extra1));
    }

    private boolean coincideBusqueda(CatalogOption item, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String q = normalizar(query);
        return normalizar(item.getClave()).contains(q)
                || normalizar(item.getNombre()).contains(q)
                || normalizar(item.getExtra1()).contains(q)
                || normalizar(item.getExtra2()).contains(q);
    }

    private String normalizar(String value) {
        return value == null ? "" : java.text.Normalizer.normalize(value.toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim();
    }

    private Map<String, Object> toMap(CatalogOption item) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", item.getId());
        map.put("clave", item.getClave());
        map.put("nombre", item.getNombre());
        map.put("parentKey", item.getParentKey());
        map.put("extra1", item.getExtra1());
        map.put("extra2", item.getExtra2());
        map.put("extra3", item.getExtra3());
        map.put("activo", item.getActivo());
        return map;
    }
}



