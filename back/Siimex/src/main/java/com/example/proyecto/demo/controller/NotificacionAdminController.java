package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Service.NotificacionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/notificaciones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class NotificacionAdminController {

    private final NotificacionService notificacionService;

    @GetMapping
    public ResponseEntity<?> listar(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        List<Map<String, Object>> items = notificacionService.listarAdmin(authUserId);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/recientes")
    public ResponseEntity<?> listarRecientes(
            @RequestParam(name = "limit", required = false) Integer limit,
            Authentication auth
    ) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        List<Map<String, Object>> items = notificacionService.listarAdminRecientes(authUserId, limit);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/count")
    public ResponseEntity<?> contarNoLeidas(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        long count = notificacionService.contarNoLeidasAdmin(authUserId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PatchMapping("/{id}/leer")
    public ResponseEntity<?> marcarLeida(@PathVariable Long id, Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        notificacionService.marcarLeida(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PatchMapping("/leer-todas")
    public ResponseEntity<?> marcarTodasLeidas(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        notificacionService.marcarTodasLeidasAdmin(authUserId);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
