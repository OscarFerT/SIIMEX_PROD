package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.ListaNegra;
import com.example.proyecto.demo.Service.ListaNegraService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/lista-negra")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ListaNegraAdminController {

    private final ListaNegraService listaNegraService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listar(
            @RequestParam(name = "soloActivas", defaultValue = "true") boolean soloActivas) {
        return ResponseEntity.ok(listaNegraService.listar(soloActivas).stream().map(listaNegraService::toMap).toList());
    }

    @PostMapping("/sancionar")
    public ResponseEntity<Map<String, Object>> sancionar(@RequestBody Map<String, Object> body) {
        Long usuarioId = parseLong(body != null ? body.get("usuarioId") : null);
        String email = body != null && body.get("email") != null ? String.valueOf(body.get("email")) : null;
        String curp = body != null && body.get("curp") != null ? String.valueOf(body.get("curp")) : null;
        String motivo = body != null && body.get("motivo") != null ? String.valueOf(body.get("motivo")) : null;
        Integer meses = parseInt(body != null ? body.get("meses") : null);
        String tipoSancion = body != null && body.get("tipoSancion") != null ? String.valueOf(body.get("tipoSancion")) : null;
        String nombrePrograma = body != null && body.get("nombrePrograma") != null ? String.valueOf(body.get("nombrePrograma")) : null;
        String folioReferencia = body != null && body.get("folioReferencia") != null ? String.valueOf(body.get("folioReferencia")) : null;
        String nombreReferencia = body != null && body.get("nombreReferencia") != null ? String.valueOf(body.get("nombreReferencia")) : null;

        ListaNegra l = listaNegraService.sancionar(
                usuarioId, email, curp, motivo, meses,
                tipoSancion, nombrePrograma, folioReferencia, nombreReferencia
        );
        return ResponseEntity.ok(listaNegraService.toMap(l));
    }

    @PostMapping("/importar")
    public ResponseEntity<Map<String, Object>> importar(@RequestBody Map<String, Object> body) {
        String tipoSancion = body != null && body.get("tipoSancion") != null ? String.valueOf(body.get("tipoSancion")) : null;
        Object rowsObj = body != null ? body.get("rows") : null;
        if (!(rowsObj instanceof List<?> rows) || rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No se recibieron filas para importar"));
        }

        java.util.List<Map<String, Object>> errores = new java.util.ArrayList<>();
        java.util.List<Map<String, Object>> creados = new java.util.ArrayList<>();
        int idx = 0;

        for (Object rowObj : rows) {
            idx++;
            if (!(rowObj instanceof Map<?, ?> raw)) {
                errores.add(Map.of("fila", idx, "message", "Formato de fila inválido"));
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> row = (Map<String, Object>) raw;

            String nombrePrograma = row.get("nombrePrograma") != null ? String.valueOf(row.get("nombrePrograma")) : null;
            String folioReferencia = row.get("folioReferencia") != null ? String.valueOf(row.get("folioReferencia")) : null;
            String nombreReferencia = row.get("nombreReferencia") != null ? String.valueOf(row.get("nombreReferencia")) : null;
            String curp = row.get("curp") != null ? String.valueOf(row.get("curp")) : null;
            String motivo = row.get("motivo") != null ? String.valueOf(row.get("motivo")) : null;

            try {
                ListaNegra creado = listaNegraService.sancionar(
                        null,
                        null,
                        curp,
                        motivo,
                        null,
                        tipoSancion,
                        nombrePrograma,
                        folioReferencia,
                        nombreReferencia
                );
                creados.add(listaNegraService.toMap(creado));
            } catch (Exception ex) {
                String msg = ex.getMessage() != null ? ex.getMessage() : "No se pudo importar la fila";
                errores.add(Map.of("fila", idx, "curp", curp != null ? curp : "", "message", msg));
            }
        }

        java.util.Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("total", rows.size());
        response.put("importados", creados.size());
        response.put("erroresCount", errores.size());
        response.put("errores", errores);
        response.put("items", creados);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/levantar")
    public ResponseEntity<Map<String, Object>> levantar(@PathVariable Long id, Authentication auth) {
        Long adminAuthUserId = auth != null && auth.getPrincipal() instanceof Long ? (Long) auth.getPrincipal() : null;
        ListaNegra l = listaNegraService.levantar(id, adminAuthUserId);
        return ResponseEntity.ok(listaNegraService.toMap(l));
    }

    private Long parseLong(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    private Integer parseInt(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }
}
