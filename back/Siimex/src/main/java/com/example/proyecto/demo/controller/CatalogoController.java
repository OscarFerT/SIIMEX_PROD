package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.CatalogOption.CatalogType;
import com.example.proyecto.demo.Service.CatalogOptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/catalogos")
@RequiredArgsConstructor
public class CatalogoController {

    private final CatalogOptionService catalogOptionService;

    @GetMapping("/entidades-federativas")
    public ResponseEntity<List<Map<String, Object>>> entidadesFederativas(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.ENTIDAD_FEDERATIVA, null, q, null));
    }

    @GetMapping("/nacionalidades")
    public ResponseEntity<List<Map<String, Object>>> nacionalidades(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.NACIONALIDAD, null, q, null));
    }

    @GetMapping("/estados-civiles")
    public ResponseEntity<List<Map<String, Object>>> estadosCiviles(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.ESTADO_CIVIL, null, q, null));
    }

    @GetMapping("/identificaciones-oficiales")
    public ResponseEntity<List<Map<String, Object>>> identificaciones(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.IDENTIFICACION_OFICIAL, null, q, null));
    }

    @GetMapping("/redes-sociales")
    public ResponseEntity<List<Map<String, Object>>> redesSociales(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.RED_SOCIAL, null, q, null));
    }

    @GetMapping("/municipios")
    public ResponseEntity<List<Map<String, Object>>> municipios(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.MUNICIPIO, null, q, null));
    }

    @GetMapping("/localidades")
    public ResponseEntity<List<Map<String, Object>>> localidades(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "municipioClave", required = false) String municipioClave,
            @RequestParam(value = "codigoPostal", required = false) String codigoPostal) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.LOCALIDAD, municipioClave, q, codigoPostal));
    }

    @GetMapping("/tipos-institucion")
    public ResponseEntity<List<Map<String, Object>>> tiposInstitucion(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.TIPO_INSTITUCION, null, q, null));
    }

    @GetMapping("/grados-estudios")
    public ResponseEntity<List<Map<String, Object>>> gradosEstudios(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.GRADO_ESTUDIOS, null, q, null));
    }

    @GetMapping("/carreras")
    public ResponseEntity<List<Map<String, Object>>> carreras(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(catalogOptionService.listar(CatalogType.CARRERA, null, q, null));
    }
}
