package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Service.MicrosoftGraphEmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/contacto")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ContactController {

    private final MicrosoftGraphEmailService emailService;

    /**
     * Recibe el formulario de contacto y envía un correo al buzón institucional.
     * Ruta pública (sin autenticación).
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> enviarContacto(@RequestBody Map<String, String> body) {
        String nombre = body.get("name");
        String email = body.get("email");
        String asunto = body.get("subject");
        String telefono = body.getOrDefault("phone", "");
        String mensaje = body.get("message");

        if (nombre == null || nombre.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre es obligatorio");
        }
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El correo es obligatorio");
        }
        if (mensaje == null || mensaje.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El mensaje es obligatorio");
        }

        try {
            emailService.sendContactFormEmail(nombre, email, asunto, telefono, mensaje);
            return ResponseEntity.ok(Map.of("status", "ok", "message", "Mensaje enviado correctamente"));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No se pudo enviar el mensaje. Intenta más tarde o contacta por otro medio.");
        }
    }
}
