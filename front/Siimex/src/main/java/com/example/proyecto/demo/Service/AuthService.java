package com.example.proyecto.demo.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.proyecto.demo.exception.ApiException;
import com.example.proyecto.demo.util.CurpValidator;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Entity.EmailVerificationToken;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.AuthUserRepository;
import com.example.proyecto.demo.Repository.EmailVerificationTokenRepository;
import com.example.proyecto.demo.Repository.Registro1Repository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.dto.LoginRequest;
import com.example.proyecto.demo.dto.LoginStep1Request;
import com.example.proyecto.demo.dto.LoginStep1Response;
import com.example.proyecto.demo.dto.LoginStep2Request;
import com.example.proyecto.demo.dto.LoginStep2Response;
import com.example.proyecto.demo.dto.RegisterRequest;
import com.example.proyecto.demo.dto.RegisterResponse;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.transaction.Transactional;

@Service
public class AuthService {

    private static final int VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
    private static final int REMEMBER_TOKEN_DAYS = 30;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    private final AuthUserRepository authUserRepo;
    private final EmailVerificationTokenRepository emailVerificationTokenRepo;
    private final UsuarioRepository usuarioRepo;
    private final Registro1Repository registro1Repo;
    private final PasswordEncoder encoder;
    private final SecretKey key;
    private final VerificationCodeService verificationCodeService;
    private final MicrosoftGraphEmailService microsoftGraphEmailService;
    private final NotificacionService notificacionService;
    private final ConfiguracionSistemaService configuracionSistemaService;

    public AuthService(AuthUserRepository authUserRepo,
                       EmailVerificationTokenRepository emailVerificationTokenRepo,
                       UsuarioRepository usuarioRepo,
                       Registro1Repository registro1Repo,
                       PasswordEncoder encoder,
                       SecretKey key,
                       VerificationCodeService verificationCodeService,
                       MicrosoftGraphEmailService microsoftGraphEmailService,
                       NotificacionService notificacionService,
                       ConfiguracionSistemaService configuracionSistemaService) {
        this.authUserRepo = authUserRepo;
        this.emailVerificationTokenRepo = emailVerificationTokenRepo;
        this.usuarioRepo = usuarioRepo;
        this.registro1Repo = registro1Repo;
        this.encoder = encoder;
        this.key = key;
        this.verificationCodeService = verificationCodeService;
        this.microsoftGraphEmailService = microsoftGraphEmailService;
        this.notificacionService = notificacionService;
        this.configuracionSistemaService = configuracionSistemaService;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest req) {
        // 1) Validaciones
    if (authUserRepo.existsByEmail(req.email())) {
        throw new ApiException(HttpStatus.CONFLICT, "Email ya registrado");
    }

    if (registro1Repo.existsByCurp(req.registro().curp())) {
        throw new ApiException(HttpStatus.CONFLICT, "CURP ya registrada");
    }

    // Validar formato de CURP
    if (!CurpValidator.validarFormato(req.registro().curp())) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Formato de CURP inválido");
    }

    // Validar que los datos del CURP coincidan con los datos del usuario
    String generoStr = req.registro().genero().name();
    Optional<String> errorCurp = CurpValidator.validarCoincidenciaDatosConMensaje(
            req.registro().curp(),
            req.registro().apellidoPaterno(),
            req.registro().apellidoMaterno(),
            req.registro().nombre(),
            req.registro().fechaNacimiento(),
            generoStr,
            req.registro().entidadFederativa());
    if (errorCurp.isPresent()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, errorCurp.get());
    }

    // 2) Crear AuthUser (enabled=false hasta que verifique su correo)
    AuthUser au = AuthUser.builder()
            .email(req.email().trim().toLowerCase())
            .username(req.email().trim().toLowerCase())
            .passwordHash(encoder.encode(req.password()))
            .enabled(false)
            .roles(new HashSet<>(List.of("ROLE_USER")))
            .build();

    // 3) Crear Usuario y setear AuthUser
    Usuario u = Usuario.builder()
            .nombre(req.registro().nombre().trim())
            .apellidoPaterno(req.registro().apellidoPaterno().trim())
            .apellidoMaterno(req.registro().apellidoMaterno().trim())
            .build();

    // 5) Crear Registro1 y asociar con Usuario
    Registro1.TipoPerfil tipoPerfil = req.registro().tipoPerfil() != null
            ? Registro1.TipoPerfil.valueOf(req.registro().tipoPerfil().name())
            : Registro1.TipoPerfil.INVESTIGADOR;
    Registro1 reg = Registro1.builder()
            .curp(req.registro().curp().trim().toUpperCase())
            .rfc(req.registro().rfc().trim().toUpperCase())
            .fechaNacimiento(req.registro().fechaNacimiento())
            .genero(Registro1.Genero.valueOf(req.registro().genero().name()))
            .nacionalidad(req.registro().nacionalidad().trim())
            .paisNacimiento(req.registro().paisNacimiento().trim())
            .entidadFederativa(req.registro().entidadFederativa().trim())
            .municipio(req.registro().municipio().trim())
            .estadoCivil(Registro1.EstadoCivil.valueOf(req.registro().estadoCivil().name()))
            .tipoPerfil(tipoPerfil)
            .telefono(req.telefono() != null && !req.telefono().isBlank() ? req.telefono().trim() : null)
            .usuario(u)
            .build();
            

        // 4) Asociar Usuario con AuthUser
        au.setUsuario(u);
        u.setAuthUser(au);

        // 5) Asociar Registro1 con Usuario
        u.setRegistro1(reg);
        reg.setUsuario(u);

        // 6) Guardar AuthUser (Hibernate hará cascade de Usuario y Registro1)
        authUserRepo.save(au);
        String folioRegistro = generarFolioRegistro(tipoPerfil, au.getId());

        // 7) Generar token de verificación y enviar correo
        String verificationToken = UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(VERIFICATION_TOKEN_EXPIRY_HOURS * 3600L);
        EmailVerificationToken evt = EmailVerificationToken.builder()
                .authUser(au)
                .token(verificationToken)
                .expiresAt(expiresAt)
                .createdAt(now)
                .build();
        emailVerificationTokenRepo.save(evt);

        String verificationLink = frontendUrl.replaceAll("/$", "") + "/verificar-email?token=" + verificationToken;
        String nombreUsuario = req.registro().nombre() != null ? req.registro().nombre().trim() : null;
        microsoftGraphEmailService.sendRegistrationVerificationEmail(req.email().trim().toLowerCase(), verificationLink, nombreUsuario, folioRegistro);

        try {
            String nombre = req.registro().nombre() != null ? req.registro().nombre().trim() : "";
            String ap = req.registro().apellidoPaterno() != null ? req.registro().apellidoPaterno().trim() : "";
            notificacionService.crearParaAdmins(
                    "Nuevo registro de usuario",
                    (nombre + " " + ap).trim() + " se registró en la plataforma.",
                    com.example.proyecto.demo.Entity.Notificacion.TipoNotificacion.NUEVO_REGISTRO,
                    "/admin/registros");
        } catch (Exception ignored) { }

        return new RegisterResponse(true, req.email().trim().toLowerCase(),
                "Revisa tu correo electrónico para activar tu cuenta. Te enviamos un enlace de verificación.", folioRegistro);
    }

    private String generarFolioRegistro(Registro1.TipoPerfil tipoPerfil, Long authUserId) {
        Registro1.TipoPerfil perfil = tipoPerfil != null ? tipoPerfil : Registro1.TipoPerfil.INVESTIGADOR;
        String limpio = configuracionSistemaService.resolverPrefijoRegistro(perfil);
        long numero = authUserId != null ? authUserId : 0L;
        return limpio + "-" + String.format("%03d", numero);
    }

    /**
     * Verifica el correo del usuario mediante el token enviado por email.
     * Activa la cuenta (enabled=true) y elimina el token.
     */
    @Transactional
    public void verifyEmail(String token) {
        if (token == null || token.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Token de verificación inválido o faltante.");
        }
        EmailVerificationToken evt = emailVerificationTokenRepo.findByToken(token.trim())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "El enlace de verificación no es válido o ya fue utilizado."));
        if (evt.isExpired()) {
            emailVerificationTokenRepo.delete(evt);
            throw new ApiException(HttpStatus.BAD_REQUEST, "El enlace de verificación ha expirado. Regístrate nuevamente para recibir un nuevo correo.");
        }
        AuthUser au = evt.getAuthUser();
        au.setEnabled(true);
        authUserRepo.save(au);
        emailVerificationTokenRepo.delete(evt);
    }


    public String login(LoginRequest req) {
        AuthUser au = authUserRepo.findByEmail(req.email())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));
        if (!encoder.matches(req.password(), au.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }
        if (!au.isEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.");
        }
        au.setLastLoginAt(Instant.now());
        authUserRepo.save(au);

        String token = Jwts.builder()
                .subject(String.valueOf(au.getId()))
                .claim("username", au.getUsername())
                .claim("roles", au.getRoles())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600_000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
        return token;
    }

    /**
     * Paso 1 del login 2FA: valida credenciales.
     * Si se envía un rememberToken válido, devuelve JWT directamente (sin 2FA).
     * Si no, genera código y lo envía por correo.
     */
    public LoginStep1Response loginStep1RequestCode(LoginStep1Request req) {
        AuthUser au = authUserRepo.findByEmail(req.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));
        if (!encoder.matches(req.getPassword(), au.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }
        if (!au.isEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.");
        }
        boolean adminOnly = Boolean.TRUE.equals(req.getAdminOnly());
        if (adminOnly && !au.getRoles().contains("ROLE_ADMIN")) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acceso solo para administradores");
        }

        // Si envía rememberToken válido -> login directo sin 2FA
        if (req.getRememberToken() != null && !req.getRememberToken().isBlank()) {
            if (isRememberTokenValid(au, req.getRememberToken())) {
                au.setLastLoginAt(Instant.now());
                // Renovar el token de confianza
                String newRawToken = generateRememberToken(au);
                authUserRepo.save(au);
                String jwt = buildJwt(au);
                LoginStep1Response resp = new LoginStep1Response();
                resp.setRequiresVerification(false);
                resp.setEmail(au.getEmail());
                resp.setToken(jwt);
                resp.setRememberToken(newRawToken);
                return resp;
            }
        }

        String email = au.getEmail();
        String code = verificationCodeService.generateAndStore(email);
        microsoftGraphEmailService.sendVerificationCode(email, code);
        return new LoginStep1Response(true, email);
    }

    /**
     * Endpoint de diagnóstico para enviar código de prueba al correo indicado.
     * Solo debe usarse por administradores.
     */
    public void sendTestVerificationCode(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email requerido");
        }
        String normalized = email.trim().toLowerCase();
        String code = verificationCodeService.generateAndStore(normalized);
        microsoftGraphEmailService.sendVerificationCode(normalized, code);
    }

    /**
     * Paso 2 del login 2FA: verifica el código y devuelve el token JWT.
     * Si remember=true, genera un token de confianza para futuros logins sin 2FA.
     */
    public LoginStep2Response loginStep2VerifyCode(LoginStep2Request req) {
        String email = req.getEmail().trim().toLowerCase();
        if (!verificationCodeService.verify(email, req.getCode())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Código inválido o expirado. Solicita uno nuevo.");
        }
        AuthUser au = authUserRepo.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));
        boolean adminOnly = Boolean.TRUE.equals(req.getAdminOnly());
        if (adminOnly && !au.getRoles().contains("ROLE_ADMIN")) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acceso solo para administradores");
        }
        au.setLastLoginAt(Instant.now());

        String rememberToken = null;
        if (req.isRemember()) {
            rememberToken = generateRememberToken(au);
        }
        authUserRepo.save(au);

        return new LoginStep2Response(buildJwt(au), rememberToken);
    }

    /**
     * Login exclusivo para administradores. Valida credenciales y que el usuario tenga ROLE_ADMIN.
     */
    public String loginAdmin(LoginRequest req) {
        AuthUser au = authUserRepo.findByEmail(req.email().trim().toLowerCase())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));
        if (!encoder.matches(req.password(), au.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }
        if (!au.getRoles().contains("ROLE_ADMIN")) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acceso solo para administradores");
        }
        au.setLastLoginAt(Instant.now());
        authUserRepo.save(au);
        return Jwts.builder()
                .subject(String.valueOf(au.getId()))
                .claim("username", au.getUsername())
                .claim("roles", au.getRoles())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600_000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    @Transactional
    public void resetPassword(com.example.proyecto.demo.dto.ResetPasswordRequest req) {
        // Validar que tenga al menos 2 identificadores
        if (!req.hasEnoughIdentifiers()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                "Debe proporcionar al menos 2 identificadores válidos (email, CURP o RFC)");
        }

        // Buscar usuario por los identificadores proporcionados
        Usuario usuario = null;
        int matches = 0;
        ArrayList<Usuario> candidatos = new ArrayList<>();

        // Buscar por email
        if (req.email() != null && !req.email().trim().isEmpty()) {
            Optional<Usuario> usuarioPorEmail = usuarioRepo.findByAuthUser_Email(req.email().trim().toLowerCase());
            if (usuarioPorEmail.isPresent()) {
                candidatos.add(usuarioPorEmail.get());
            }
        }

        // Buscar por CURP
        if (req.curp() != null && !req.curp().trim().isEmpty()) {
            Optional<com.example.proyecto.demo.Entity.Registro1> registroPorCurp = 
                registro1Repo.findByCurp(req.curp().trim().toUpperCase());
            if (registroPorCurp.isPresent()) {
                candidatos.add(registroPorCurp.get().getUsuario());
            }
        }

        // Buscar por RFC
        if (req.rfc() != null && !req.rfc().trim().isEmpty()) {
            Optional<com.example.proyecto.demo.Entity.Registro1> registroPorRfc = 
                registro1Repo.findByRfc(req.rfc().trim().toUpperCase());
            if (registroPorRfc.isPresent()) {
                candidatos.add(registroPorRfc.get().getUsuario());
            }
        }

        // Verificar que todos los candidatos sean el mismo usuario
        if (candidatos.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, 
                "No se encontró un usuario con los identificadores proporcionados");
        }

        // Verificar que todos los candidatos sean el mismo usuario
        Long usuarioId = candidatos.get(0).getId();
        boolean todosIguales = candidatos.stream().allMatch(u -> u.getId().equals(usuarioId));
        
        if (!todosIguales) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                "Los identificadores proporcionados no corresponden al mismo usuario");
        }

        // Contar cuántos identificadores coincidieron
        matches = candidatos.size();
        if (matches < 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                "Debe proporcionar al menos 2 identificadores válidos que coincidan con el mismo usuario");
        }

        usuario = candidatos.get(0);

        // Validar que el usuario tenga AuthUser
        if (usuario.getAuthUser() == null) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, 
                "El usuario no tiene una cuenta de autenticación asociada");
        }

        // Actualizar la contraseña
        AuthUser authUser = usuario.getAuthUser();
        authUser.setPasswordHash(encoder.encode(req.newPassword()));
        authUserRepo.save(authUser);
    }

    // ===== Helpers para JWT y Remember Token =====

    private String buildJwt(AuthUser au) {
        return Jwts.builder()
                .subject(String.valueOf(au.getId()))
                .claim("username", au.getUsername())
                .claim("roles", au.getRoles())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600_000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    private String generateRememberToken(AuthUser au) {
        String rawToken = UUID.randomUUID().toString().replace("-", "");
        au.setRememberTokenHash(sha256(rawToken));
        au.setRememberTokenExpiry(Instant.now().plus(REMEMBER_TOKEN_DAYS, ChronoUnit.DAYS));
        return rawToken;
    }

    private boolean isRememberTokenValid(AuthUser au, String rawToken) {
        if (au.getRememberTokenHash() == null || au.getRememberTokenExpiry() == null) return false;
        if (Instant.now().isAfter(au.getRememberTokenExpiry())) {
            au.setRememberTokenHash(null);
            au.setRememberTokenExpiry(null);
            return false;
        }
        return au.getRememberTokenHash().equals(sha256(rawToken));
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
