package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Service.AdminDatosBasicosService;
import com.example.proyecto.demo.dto.AdminDatosBasicos.*;
import com.example.proyecto.demo.exception.ApiException;
import com.example.proyecto.demo.security.ClientAddress;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/registros/{id}/datos-basicos")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminDatosBasicosController {
    private final AdminDatosBasicosService service;

    @GetMapping
    public ResponseEntity<Datos> consultar(@PathVariable Long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.consultar(id));
    }

    @PatchMapping
    public ResponseEntity<Datos> actualizar(@PathVariable Long id, @Valid @RequestBody Cambio cambio,
                                            Authentication auth, HttpServletRequest request) {
        try {
            return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                    .body(service.actualizar(id, cambio, Long.valueOf(auth.getName()), ClientAddress.remote(request)));
        } catch (DataIntegrityViolationException ex) {
            // The database also protects against two concurrent requests claiming the same identity.
            throw new ApiException(HttpStatus.CONFLICT, "No se pudo guardar: el correo o la CURP ya estan en uso. Recarga y verifica los datos.");
        }
    }
}
