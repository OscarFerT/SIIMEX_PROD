package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.InstitucionEducativa;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.Service.InstitucionEducativaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InstitucionEducativaController {

    private final InstitucionEducativaService institucionEducativaService;
    private final UsuarioRepository usuarioRepository;

    @GetMapping("/admin/instituciones-educativas")
    public ResponseEntity<List<Map<String, Object>>> listarAdmin(@RequestParam(name = "q", required = false) String q) {
        return ResponseEntity.ok(institucionEducativaService.listar(q).stream().map(institucionEducativaService::toMap).toList());
    }

    @PostMapping("/admin/instituciones-educativas")
    public ResponseEntity<Map<String, Object>> crearAdmin(@RequestBody Map<String, Object> body) {
        InstitucionEducativa i = institucionEducativaService.crear(body, null, false);
        return ResponseEntity.ok(institucionEducativaService.toMap(i));
    }

    @PatchMapping("/admin/instituciones-educativas/{id}")
    public ResponseEntity<Map<String, Object>> actualizarAdmin(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        InstitucionEducativa i = institucionEducativaService.actualizar(id, body);
        return ResponseEntity.ok(institucionEducativaService.toMap(i));
    }

    @DeleteMapping("/admin/instituciones-educativas/{id}")
    public ResponseEntity<Void> eliminarAdmin(@PathVariable Long id) {
        institucionEducativaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/instituciones-educativas/plantilla")
    public ResponseEntity<byte[]> descargarPlantilla() {
        byte[] content = institucionEducativaService.generarPlantillaExcel();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=plantilla_instituciones_educativas.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(content);
    }

    @PostMapping(value = "/admin/instituciones-educativas/importar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> importar(@RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(institucionEducativaService.importarDesdeArchivo(file));
    }

    @GetMapping("/instituciones-educativas/activas")
    public ResponseEntity<List<Map<String, Object>>> listarActivas() {
        return ResponseEntity.ok(institucionEducativaService.listarActivas().stream().map(institucionEducativaService::toMap).toList());
    }

    @PostMapping("/instituciones-educativas/notificar-falta")
    public ResponseEntity<Map<String, Object>> notificarFalta(@RequestBody Map<String, Object> body, Authentication auth) {
        Long authUserId = auth != null && auth.getPrincipal() instanceof Long ? (Long) auth.getPrincipal() : null;
        Long usuarioId = null;
        if (authUserId != null) {
            Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId).orElse(null);
            if (usuario != null) {
                usuarioId = usuario.getId();
            }
        }
        InstitucionEducativa i = institucionEducativaService.crear(body, usuarioId, true);
        return ResponseEntity.ok(Map.of(
                "message", "Solicitud de institución enviada para validación",
                "institucion", institucionEducativaService.toMap(i)
        ));
    }
}
