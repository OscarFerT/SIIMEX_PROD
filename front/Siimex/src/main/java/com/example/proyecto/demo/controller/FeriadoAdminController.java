package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.Feriado;
import com.example.proyecto.demo.Service.FeriadoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/feriados")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FeriadoAdminController {

    private final FeriadoService feriadoService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listar() {
        return ResponseEntity.ok(feriadoService.listarTodos().stream().map(feriadoService::toMap).toList());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> crear(@RequestBody Map<String, Object> body) {
        LocalDate fecha = parseDate(body != null ? body.get("fecha") : null);
        String nombre = body != null && body.get("nombre") != null ? String.valueOf(body.get("nombre")) : null;
        Boolean activo = body != null && body.get("activo") != null ? Boolean.valueOf(String.valueOf(body.get("activo"))) : null;
        Feriado f = feriadoService.crear(fecha, nombre, activo);
        return ResponseEntity.ok(feriadoService.toMap(f));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Map<String, Object>> actualizar(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        LocalDate fecha = parseDate(body != null ? body.get("fecha") : null);
        String nombre = body != null && body.get("nombre") != null ? String.valueOf(body.get("nombre")) : null;
        Boolean activo = body != null && body.get("activo") != null ? Boolean.valueOf(String.valueOf(body.get("activo"))) : null;
        Feriado f = feriadoService.actualizar(id, fecha, nombre, activo);
        return ResponseEntity.ok(feriadoService.toMap(f));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        feriadoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    private LocalDate parseDate(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        return LocalDate.parse(String.valueOf(value));
    }
}
