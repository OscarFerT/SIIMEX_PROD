package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Repository.AuthUserRepository;
import com.example.proyecto.demo.Service.AuditLogService;
import com.example.proyecto.demo.Service.ConfiguracionSistemaService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/configuracion")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConfiguracionSistemaAdminController {

    private final ConfiguracionSistemaService configuracionSistemaService;
    private final AuditLogService auditLogService;
    private final AuthUserRepository authUserRepository;

    @GetMapping("/folios-registro")
    public ResponseEntity<Map<String, Object>> obtenerFoliosRegistro() {
        return ResponseEntity.ok(configuracionSistemaService.obtenerPrefijosRegistro());
    }

    @PatchMapping("/folios-registro")
    public ResponseEntity<Map<String, Object>> actualizarFoliosRegistro(@RequestBody Map<String, Object> body,
                                                                        Authentication auth,
                                                                        HttpServletRequest http) {
        Map<String, Object> antes = configuracionSistemaService.obtenerPrefijosRegistro();
        String investigador = body != null && body.get("investigador") != null ? String.valueOf(body.get("investigador")) : null;
        String innovador = body != null && body.get("innovador") != null ? String.valueOf(body.get("innovador")) : null;
        String hibrido = body != null && body.get("hibrido") != null ? String.valueOf(body.get("hibrido")) : null;
        Map<String, Object> despues = configuracionSistemaService.actualizarPrefijosRegistro(investigador, innovador, hibrido);

        auditLogService.registrarAdmin(
                "ACTUALIZAR_FOLIOS_REGISTRO",
                construirDetalleCambios(antes, despues),
                getAdminId(auth),
                getAdminEmail(auth),
                "ConfiguracionSistema",
                null,
                getIp(http)
        );
        return ResponseEntity.ok(despues);
    }

    private String construirDetalleCambios(Map<String, Object> antes, Map<String, Object> despues) {
        String invAntes = valor(antes, "investigador");
        String indAntes = valor(antes, "innovador");
        String hibAntes = valor(antes, "hibrido");

        String invDespues = valor(despues, "investigador");
        String indDespues = valor(despues, "innovador");
        String hibDespues = valor(despues, "hibrido");

        List<String> cambios = new ArrayList<>();
        if (!invAntes.equals(invDespues)) cambios.add("investigador: " + invAntes + " -> " + invDespues);
        if (!indAntes.equals(indDespues)) cambios.add("innovador: " + indAntes + " -> " + indDespues);
        if (!hibAntes.equals(hibDespues)) cambios.add("hibrido: " + hibAntes + " -> " + hibDespues);

        if (cambios.isEmpty()) {
            return "Sin cambios en prefijos de folio de registro.";
        }
        return "Actualización de prefijos de folio de registro (" + String.join("; ", cambios) + ")";
    }

    private String valor(Map<String, Object> map, String key) {
        if (map == null || map.get(key) == null) return "";
        return String.valueOf(map.get(key)).trim();
    }

    private String getIp(HttpServletRequest req) {
        if (req == null) return null;
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    private Long getAdminId(Authentication auth) {
        try {
            return auth != null ? Long.valueOf(auth.getName()) : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String getAdminEmail(Authentication auth) {
        try {
            Long id = auth != null ? Long.valueOf(auth.getName()) : null;
            if (id == null) return auth != null ? auth.getName() : null;
            return authUserRepository.findById(id).map(AuthUser::getEmail).orElse(auth != null ? auth.getName() : null);
        } catch (Exception e) {
            return auth != null ? auth.getName() : null;
        }
    }
}
