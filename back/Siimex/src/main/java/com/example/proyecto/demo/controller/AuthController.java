package com.example.proyecto.demo.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import com.example.proyecto.demo.Service.AuthService;
import com.example.proyecto.demo.dto.JwtResponse;
import com.example.proyecto.demo.dto.LoginRequest;
import com.example.proyecto.demo.dto.LoginStep1Request;
import com.example.proyecto.demo.dto.LoginStep1Response;
import com.example.proyecto.demo.dto.LoginStep2Request;
import com.example.proyecto.demo.dto.LoginStep2Response;
import com.example.proyecto.demo.dto.RegisterRequest;
import com.example.proyecto.demo.dto.RegisterResponse;

import com.example.proyecto.demo.Service.AuditLogService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuditLogService auditLogService;

    @Value("${security.jwt.expiration-ms}")
    private long jwtExpirationMs;

    @Value("${app.security.require-https:false}")
    private boolean secureCookies;

    // --- Endpoints de Autenticación ---

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        RegisterResponse response = authService.register(request);
        auditLogService.registrarAuth("REGISTRO", "Nuevo usuario registrado: " + request.email(), request.email(), getIp(http));
        return ResponseEntity.ok(response);
    }

    /** Verifica el correo del usuario mediante el token recibido por email. */
    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestParam("token") String token) {
        authService.verifyEmail(token);
        return ResponseEntity.ok(java.util.Map.of(
                "success", true,
                "message", "Tu cuenta ha sido verificada. Ya puedes iniciar sesión."
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<JwtResponse> login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        String token = authService.login(req);
        auditLogService.registrarAuth("LOGIN", "Inicio de sesión exitoso", req.email(), getIp(http));
        return withAuthCookie(new JwtResponse(token), token);
    }

    @PostMapping("/login-admin")
    public ResponseEntity<JwtResponse> loginAdmin(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        String token = authService.loginAdmin(request);
        auditLogService.registrarAuth("LOGIN_ADMIN", "Inicio de sesión de administrador", request.email(), getIp(http));
        return withAuthCookie(new JwtResponse(token), token);
    }

    @PostMapping("/login/request-code")
    public ResponseEntity<LoginStep1Response> loginRequestCode(@Valid @RequestBody LoginStep1Request request, HttpServletRequest http) {
        LoginStep1Response response = authService.loginStep1RequestCode(request);
        if (response.getToken() != null) {
            auditLogService.registrarAuth("LOGIN_2FA_SKIP", "Login con token de confianza (sin 2FA)", request.getEmail(), getIp(http));
        } else {
            auditLogService.registrarAuth("LOGIN_2FA_CODIGO", "Código 2FA solicitado", request.getEmail(), getIp(http));
        }
        if (response.getToken() != null) {
            return withAuthCookie(response, response.getToken());
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login/verify-code")
    public ResponseEntity<LoginStep2Response> loginVerifyCode(@Valid @RequestBody LoginStep2Request request, HttpServletRequest http) {
        LoginStep2Response resp = authService.loginStep2VerifyCode(request);
        auditLogService.registrarAuth("LOGIN_2FA_OK", "Verificación 2FA exitosa", request.getEmail(), getIp(http));
        return withAuthCookie(resp, resp.token());
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        ResponseCookie cookie = ResponseCookie.from("COMECYT_AUTH", "")
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("success", true));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody com.example.proyecto.demo.dto.ResetPasswordRequest request, HttpServletRequest http) {
        try {
            authService.resetPassword(request);
            auditLogService.registrarAuth("RESET_PASSWORD", "Contraseña restablecida por usuario", request.email(), getIp(http));
            return ResponseEntity.ok().body(java.util.Map.of(
                "success", true,
                "message", "Contraseña actualizada correctamente"
            ));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            auditLogService.registrarAuth("RESET_PASSWORD_FALLIDO", "Intento fallido de restablecer contraseña: " + e.getReason(), request.email(), getIp(http));
            return ResponseEntity.status(e.getStatusCode()).body(java.util.Map.of(
                "success", false,
                "message", e.getReason()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR).body(java.util.Map.of(
                "success", false,
                "message", "Error interno del servidor"
            ));
        }
    }

    @PostMapping("/debug/send-test-code")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> sendTestCode(@RequestBody Map<String, String> body) {
        String email = body != null ? body.get("email") : null;
        authService.sendTestVerificationCode(email);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Código de prueba enviado"
        ));
    }

    private String getIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    private <T> ResponseEntity<T> withAuthCookie(T body, String token) {
        ResponseCookie cookie = ResponseCookie.from("COMECYT_AUTH", token)
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(Math.max(1, jwtExpirationMs / 1000))
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(body);
    }
}
