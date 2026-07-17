package com.example.proyecto.demo.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.proyecto.demo.Entity.Convocatoria;
import com.example.proyecto.demo.Service.ConvocatoriaService;
import com.example.proyecto.demo.dto.ConvocatoriaRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/admin/convocatorias")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConvocatoriaAdminController {

    private final ConvocatoriaService convocatoriaService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listarTodas() {
        return ResponseEntity.ok(convocatoriaService.listarTodasConCupo());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Convocatoria> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(convocatoriaService.obtenerPorId(id));
    }

    @GetMapping("/{id}/folio")
    public ResponseEntity<Map<String, Object>> obtenerResumenFolio(@PathVariable Long id) {
        Convocatoria c = convocatoriaService.obtenerPorId(id);
        List<Map<String, Object>> lista = convocatoriaService.listarTodasConCupo();
        Map<String, Object> map = lista.stream()
                .filter(x -> String.valueOf(x.get("id")).equals(String.valueOf(c.getId())))
                .findFirst()
                .orElse(Map.of());
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("id", c.getId());
        response.put("folioConvocatoria", map.getOrDefault("folioConvocatoria", c.getFolioConvocatoria()));
        response.put("titulo", c.getTitulo());
        response.put("fechaApertura", c.getFechaApertura() != null ? c.getFechaApertura().toString() : null);
        response.put("fechaCierre", c.getFechaCierre() != null ? c.getFechaCierre().toString() : null);
        response.put("feriadosEnVigencia", map.getOrDefault("feriadosEnVigencia", 0));
        response.put("diasNaturalesVigencia", map.getOrDefault("diasNaturalesVigencia", 0));
        response.put("diasSinFeriadosVigencia", map.getOrDefault("diasSinFeriadosVigencia", 0));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/operacion-siimex")
    public ResponseEntity<Map<String, Object>> obtenerOperacionSiimex(@PathVariable Long id) {
        return ResponseEntity.ok(convocatoriaService.obtenerOperacionSiimex(id));
    }

    @PostMapping
    public ResponseEntity<Convocatoria> crear(@Valid @RequestBody ConvocatoriaRequest request) {
        return ResponseEntity.ok(convocatoriaService.crear(request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Convocatoria> actualizar(@PathVariable Long id, @Valid @RequestBody ConvocatoriaRequest request) {
        return ResponseEntity.ok(convocatoriaService.actualizar(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        convocatoriaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/duplicar")
    public ResponseEntity<Convocatoria> duplicar(@PathVariable Long id) {
        return ResponseEntity.ok(convocatoriaService.duplicar(id));
    }

    @PostMapping("/{id}/publicar")
    public ResponseEntity<Convocatoria> publicar(@PathVariable Long id) {
        return ResponseEntity.ok(convocatoriaService.publicar(id));
    }

    @PostMapping("/{id}/retirar-publicacion")
    public ResponseEntity<Convocatoria> retirarPublicacion(@PathVariable Long id) {
        return ResponseEntity.ok(convocatoriaService.retirarPublicacion(id));
    }
}
