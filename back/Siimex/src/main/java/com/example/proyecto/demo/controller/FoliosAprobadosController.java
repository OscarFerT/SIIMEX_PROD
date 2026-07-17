package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.Postulacion;
import com.example.proyecto.demo.Repository.PostulacionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/folios-aprobados")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FoliosAprobadosController {

    private final PostulacionRepository postulacionRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> listar(
            @RequestParam(required = false) Long convocatoriaId,
            @RequestParam(required = false) String q) {
        String query = normalizar(q);
        List<Postulacion> aprobadas = postulacionRepository.findBeneficiariasAprobadas();
        List<Map<String, Object>> items = aprobadas.stream()
                .filter(p -> convocatoriaId == null || (p.getConvocatoria() != null && convocatoriaId.equals(p.getConvocatoria().getId())))
                .filter(p -> query.isBlank() || normalizar(textoBusquedaPublico(p)).contains(query))
                .map(this::mapFolioPublico)
                .toList();

        LocalDateTime fechaCorte = aprobadas.stream()
                .map(this::fechaAprobacion)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("total", items.size());
        response.put("fechaCorte", fechaCorte != null ? fechaCorte.toString() : null);
        response.put("convocatorias", convocatoriasConAprobadas(aprobadas));
        response.put("items", items);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> mapFolioPublico(Postulacion p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("folio", p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId());
        m.put("convocatoriaId", p.getConvocatoria() != null ? p.getConvocatoria().getId() : null);
        m.put("convocatoriaTitulo", p.getConvocatoria() != null ? p.getConvocatoria().getTitulo() : null);
        m.put("folioConvocatoria", p.getConvocatoria() != null ? p.getConvocatoria().getFolioConvocatoria() : null);
        m.put("area", p.getConvocatoria() != null ? p.getConvocatoria().getArea() : null);
        LocalDateTime fechaAprobacion = fechaAprobacion(p);
        m.put("fechaAprobacion", fechaAprobacion != null ? fechaAprobacion.toString() : null);
        m.put("estatus", "APROBADA");
        return m;
    }

    private List<Map<String, Object>> convocatoriasConAprobadas(List<Postulacion> aprobadas) {
        return aprobadas.stream()
                .filter(p -> p.getConvocatoria() != null && p.getConvocatoria().getId() != null)
                .collect(Collectors.groupingBy(
                        p -> p.getConvocatoria().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ))
                .values()
                .stream()
                .map(lista -> {
                    Postulacion p = lista.get(0);
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", p.getConvocatoria().getId());
                    m.put("titulo", p.getConvocatoria().getTitulo());
                    m.put("folioConvocatoria", p.getConvocatoria().getFolioConvocatoria());
                    m.put("area", p.getConvocatoria().getArea());
                    m.put("totalAprobados", lista.size());
                    return m;
                })
                .toList();
    }

    private LocalDateTime fechaAprobacion(Postulacion p) {
        if (p.getFechaComite() != null) return p.getFechaComite();
        if (p.getFechaRevision() != null) return p.getFechaRevision();
        return p.getFechaCreacion();
    }

    private String textoBusquedaPublico(Postulacion p) {
        return (p.getFolio() != null ? p.getFolio() : "")
                + " " + (p.getConvocatoria() != null && p.getConvocatoria().getTitulo() != null ? p.getConvocatoria().getTitulo() : "")
                + " " + (p.getConvocatoria() != null && p.getConvocatoria().getFolioConvocatoria() != null ? p.getConvocatoria().getFolioConvocatoria() : "");
    }

    private String normalizar(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
