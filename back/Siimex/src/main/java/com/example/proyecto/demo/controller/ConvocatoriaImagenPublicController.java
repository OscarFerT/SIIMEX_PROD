package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.util.FileSecurityUtils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;

@RestController
@RequestMapping("/convocatorias-imagenes")
@CrossOrigin(origins = "*")
public class ConvocatoriaImagenPublicController {

    @Value("${app.upload.directory}")
    private String uploadBaseDirectory;

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> servirImagen(@PathVariable String filename) {
        try {
            String safeFilename = FileSecurityUtils.sanitizeFilename(filename, "imagen");
            Path dir = Path.of(uploadBaseDirectory, "convocatorias-imagenes").toAbsolutePath().normalize();
            Path file = FileSecurityUtils.resolveInside(dir, safeFilename);
            if (!file.toFile().exists()) {
                return ResponseEntity.notFound().build();
            }
            Resource resource = new UrlResource(file.toUri());
            String contentType = FileSecurityUtils.safeContentTypeForFilename(safeFilename);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeFilename + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

}
