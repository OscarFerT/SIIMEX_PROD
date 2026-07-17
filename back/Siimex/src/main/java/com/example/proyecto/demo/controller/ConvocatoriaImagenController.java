package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.util.FileSecurityUtils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/convocatorias")
@CrossOrigin(origins = "*")
public class ConvocatoriaImagenController {

    @Value("${app.upload.directory}")
    private String uploadBaseDirectory;

    private static final String CONVOCATORIAS_IMAGENES = "convocatorias-imagenes";
    private static final long MAX_SIZE = 2 * 1024 * 1024; // 2MB

    @PostMapping(value = "/imagen", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirImagen(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "No se envió ningún archivo"));
            }
            if (file.getSize() > MAX_SIZE) {
                return ResponseEntity.badRequest().body(Map.of("message", "La imagen no debe superar 2 MB"));
            }
            if (!FileSecurityUtils.isAllowedImage(file)) {
                return ResponseEntity.badRequest().body(Map.of("message", "El archivo debe ser una imagen válida PNG, JPG, GIF o WEBP"));
            }

            Path dir = Path.of(uploadBaseDirectory, CONVOCATORIAS_IMAGENES).toAbsolutePath().normalize();
            if (!Files.exists(dir)) {
                Files.createDirectories(dir);
            }

            String ext = FileSecurityUtils.extensionOf(file.getOriginalFilename());
            String nombre = UUID.randomUUID() + "." + ext;
            Path dest = FileSecurityUtils.resolveInside(dir, nombre);
            Files.write(dest, FileSecurityUtils.stripImageMetadata(file.getBytes(), nombre));

            String url = "/convocatorias-imagenes/" + nombre;
            return ResponseEntity.ok(Map.of("url", url, "filename", nombre));

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error al guardar la imagen"));
        }
    }

}
