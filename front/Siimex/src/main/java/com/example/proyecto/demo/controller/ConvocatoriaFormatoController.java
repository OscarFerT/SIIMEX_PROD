package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.ConvocatoriaFormato;
import com.example.proyecto.demo.Service.ConvocatoriaFormatoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConvocatoriaFormatoController {

    private final ConvocatoriaFormatoService formatoService;

    @GetMapping("/convocatorias/{convocatoriaId}/formatos")
    public ResponseEntity<List<Map<String, Object>>> listarPublicos(@PathVariable Long convocatoriaId) {
        return ResponseEntity.ok(formatoService.listar(convocatoriaId));
    }

    @GetMapping("/convocatorias/{convocatoriaId}/formatos/{formatoId}")
    public ResponseEntity<byte[]> descargar(@PathVariable Long convocatoriaId, @PathVariable Long formatoId) {
        ConvocatoriaFormato formato = formatoService.obtener(convocatoriaId, formatoId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(formato.getNombreArchivo()))
                .contentType(MediaType.parseMediaType(formato.getContentType()))
                .body(formato.getContenido());
    }

    @GetMapping("/admin/convocatorias/{convocatoriaId}/formatos")
    public ResponseEntity<List<Map<String, Object>>> listarAdmin(@PathVariable Long convocatoriaId) {
        return ResponseEntity.ok(formatoService.listar(convocatoriaId));
    }

    @PostMapping(value = "/admin/convocatorias/{convocatoriaId}/formatos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> subirAdmin(
            @PathVariable Long convocatoriaId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "nombre", required = false) String nombre,
            @RequestParam(value = "descripcion", required = false) String descripcion) throws IOException {
        return ResponseEntity.ok(formatoService.guardar(convocatoriaId, file, nombre, descripcion));
    }

    @DeleteMapping("/admin/convocatorias/{convocatoriaId}/formatos/{formatoId}")
    public ResponseEntity<Void> eliminarAdmin(@PathVariable Long convocatoriaId, @PathVariable Long formatoId) {
        formatoService.eliminar(convocatoriaId, formatoId);
        return ResponseEntity.noContent().build();
    }

    private String contentDisposition(String nombreArchivo) {
        String nombre = nombreArchivo != null && !nombreArchivo.isBlank() ? nombreArchivo.trim() : "formato";
        String ascii = nombre.replaceAll("[\\r\\n\"]", "_");
        String encoded = java.net.URLEncoder.encode(nombre, StandardCharsets.UTF_8).replace("+", "%20");
        return "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + encoded;
    }
}
