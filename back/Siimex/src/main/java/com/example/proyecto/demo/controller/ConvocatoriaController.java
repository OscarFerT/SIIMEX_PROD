package com.example.proyecto.demo.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.example.proyecto.demo.Entity.Convocatoria;
import com.example.proyecto.demo.Service.CompatibilidadService;
import com.example.proyecto.demo.Service.ConvocatoriaService;

import lombok.RequiredArgsConstructor;

/**
 * API de convocatorias vigentes (para usuarios autenticados).
 */
@RestController
@RequestMapping("/convocatorias")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConvocatoriaController {

    private final ConvocatoriaService convocatoriaService;
    private final CompatibilidadService compatibilidadService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listarVigentes() {
        return ResponseEntity.ok(convocatoriaService.listarVigentesConCupo());
    }

    @GetMapping("/{id}/compatibilidad")
    public ResponseEntity<Map<String, Integer>> obtenerCompatibilidad(
            @PathVariable Long id,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.ok(Map.of("porcentaje", 0));
        }
        Long authUserId = (Long) auth.getPrincipal();
        int porcentaje = compatibilidadService.calcularCompatibilidad(authUserId, id);
        return ResponseEntity.ok(Map.of("porcentaje", porcentaje));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Convocatoria> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(convocatoriaService.obtenerPorId(id));
    }
}
