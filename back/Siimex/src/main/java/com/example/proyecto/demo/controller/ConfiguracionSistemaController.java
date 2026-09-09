package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Service.ConfiguracionSistemaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/configuracion")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConfiguracionSistemaController {

    private final ConfiguracionSistemaService configuracionSistemaService;

    @GetMapping("/limites-pdf")
    public ResponseEntity<Map<String, Object>> obtenerLimitesPdf() {
        return ResponseEntity.ok(configuracionSistemaService.obtenerLimitesPdf());
    }
}