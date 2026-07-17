package com.example.proyecto.demo.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/convocatorias")
@CrossOrigin(origins = "*")
public class ConvocatoriaImagenController {

    @Value("${app.upload.directory:usuarios}")
    private String uploadBaseDirectory;

    private static final String CONVOCATORIAS_IMAGENES = "convocatorias-imagenes";
    private static final long MAX_SIZE = 2 * 1024 * 1024; // 2MB

    @PostMapping(value = "/imagen", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirImagen(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "No se envió ningún archivo"));
            }
            if (!file.getContentType().startsWith("image/")) {
                return ResponseEntity.badRequest().body(Map.of("message", "El archivo debe ser una imagen (PNG, JPG, etc.)"));
            }
            if (file.getSize() > MAX_SIZE) {
                return ResponseEntity.badRequest().body(Map.of("message", "La imagen no debe superar 2 MB"));
            }

            Path dir = Paths.get(uploadBaseDirectory, CONVOCATORIAS_IMAGENES);
            if (!Files.exists(dir)) {
                Files.createDirectories(dir);
            }

            String ext = getExtension(file.getOriginalFilename());
            String nombre = UUID.randomUUID().toString() + (ext != null ? "." + ext : ".png");
            Path dest = dir.resolve(nombre);
            Files.copy(file.getInputStream(), dest);

            String url = "/convocatorias-imagenes/" + nombre;
            return ResponseEntity.ok(Map.of("url", url, "filename", nombre));

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error al guardar la imagen: " + e.getMessage()));
        }
    }

    private String getExtension(String filename) {
        if (filename == null) return null;
        int i = filename.lastIndexOf('.');
        return i > 0 ? filename.substring(i + 1).toLowerCase() : null;
    }
}
