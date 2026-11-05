package com.example.proyecto.demo.security;

import com.example.proyecto.demo.Entity.*;
import com.example.proyecto.demo.Repository.*;
import com.example.proyecto.demo.Service.*;
import com.example.proyecto.demo.controller.DocumentoController;
import com.example.proyecto.demo.dto.*;
import com.example.proyecto.demo.exception.ApiException;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SecurityRegressionTest {
    AuthUserRepository accounts;
    VerificationCodeService codes;
    MicrosoftGraphEmailService mail;
    PasswordEncoder encoder;
    AuthService auth;
    AuthUser account;
    SecretKey key;

    @BeforeEach void setup() {
        accounts = mock(AuthUserRepository.class);
        codes = new VerificationCodeService();
        mail = mock(MicrosoftGraphEmailService.class);
        encoder = mock(PasswordEncoder.class);
        key = Keys.hmacShaKeyFor("synthetic-security-regression-key-not-a-real-secret-123".getBytes(StandardCharsets.UTF_8));
        auth = new AuthService(accounts, mock(EmailVerificationTokenRepository.class), mock(UsuarioRepository.class),
                mock(Registro1Repository.class), encoder, key, codes, mail, mock(NotificacionService.class),
                mock(ConfiguracionSistemaService.class), new AuthAttemptService(5, 15));
        ReflectionTestUtils.setField(auth, "jwtExpirationMs", 60000L);
        account = AuthUser.builder().id(42L).email("audit@example.test").username("audit@example.test")
                .passwordHash("old-synthetic-hash").roles(new HashSet<>(Set.of("ROLE_ADMIN"))).enabled(true).locked(false).build();
        when(accounts.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        when(accounts.findById(account.getId())).thenReturn(Optional.of(account));
        when(encoder.matches("TestPassword123", account.getPasswordHash())).thenReturn(true);
        when(encoder.encode(anyString())).thenReturn("new-synthetic-hash");
    }

    String requestLoginCode() {
        auth.loginStep1RequestCode(new LoginStep1Request(account.getEmail(), "TestPassword123", null, true));
        var capture = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendVerificationCode(eq(account.getEmail()), capture.capture());
        return capture.getValue();
    }

    String login() {
        return auth.loginStep2VerifyCode(new LoginStep2Request(account.getEmail(), requestLoginCode(), false, true)).token();
    }

    @Test void publicIdentifiersWithoutCodeCannotResetAnyPassword() {
        assertThatThrownBy(() -> auth.resetPassword(new ResetPasswordRequest(account.getEmail(), "TEST900101HMCRRR00", null, "NewTestPassword123", null)))
                .isInstanceOf(ApiException.class);
        assertThat(account.getPasswordHash()).isEqualTo("old-synthetic-hash");
        verify(accounts, never()).save(any());
    }

    @Test void resetRequiresEmailedCodeAndRevokesSessionsAndRememberedDevices() {
        String oldJwt = login();
        account.setRememberTokenHash("old-remember-hash");
        auth.requestPasswordResetCode(account.getEmail());
        var capture = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordResetCode(eq(account.getEmail()), capture.capture());
        var request = new ResetPasswordRequest(account.getEmail(), null, null, "NewTestPassword123", capture.getValue());
        auth.resetPassword(request);
        assertThat(account.getPasswordHash()).isEqualTo("new-synthetic-hash");
        assertThat(account.getRememberTokenHash()).isNull();
        assertThatThrownBy(() -> new JwtVerifier(key, accounts).verifyAndParse(oldJwt)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> auth.resetPassword(request)).isInstanceOf(ApiException.class);
    }

    @Test void loginCodeCannotBeReusedAsRecoveryAuthorization() {
        String code = requestLoginCode();
        assertThatThrownBy(() -> auth.resetPassword(new ResetPasswordRequest(account.getEmail(), null, null, "NewTestPassword123", code)))
                .isInstanceOf(ApiException.class);
        assertThat(account.getPasswordHash()).isEqualTo("old-synthetic-hash");
    }

    @Test void oldPasswordOnlyRoutesNeverIssueJwt() {
        var req = new LoginRequest(account.getEmail(), "TestPassword123");
        assertThatThrownBy(() -> auth.login(req)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> auth.loginAdmin(req)).isInstanceOf(ApiException.class);
    }

    @Test void accountStateIsCheckedAgainBetweenLoginSteps() {
        String code = requestLoginCode();
        account.setLocked(true);
        assertThatThrownBy(() -> auth.loginStep2VerifyCode(new LoginStep2Request(account.getEmail(), code, false, true)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> auth.loginStep1RequestCode(new LoginStep1Request(account.getEmail(), "TestPassword123", "remembered", true)))
                .isInstanceOf(ApiException.class);
    }

    @Test void freshJwtWorksButSuspensionRolesPasswordAndLogoutInvalidateIt() {
        String jwt = login();
        var verifier = new JwtVerifier(key, accounts);
        assertThat(verifier.verifyAndParse(jwt).roles()).contains("ROLE_ADMIN");
        account.setEnabled(false);
        assertThatThrownBy(() -> verifier.verifyAndParse(jwt)).isInstanceOf(ApiException.class);
        account.setEnabled(true);
        account.getRoles().clear();
        assertThatThrownBy(() -> verifier.verifyAndParse(jwt)).isInstanceOf(IllegalArgumentException.class);
        account.getRoles().add("ROLE_ADMIN");
        account.setPasswordHash("changed-elsewhere");
        assertThatThrownBy(() -> verifier.verifyAndParse(jwt)).isInstanceOf(IllegalArgumentException.class);
        account.setPasswordHash("old-synthetic-hash");
        doAnswer(inv -> { account.revokeSessions(); return 1; }).when(accounts).revokeSessions(account.getId());
        auth.logout(account.getId());
        assertThatThrownBy(() -> verifier.verifyAndParse(jwt)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void codesAreSingleUseEvenUnderConcurrentRequests() throws Exception {
        String code = codes.generateAndStore("concurrency-test");
        ExecutorService executor = Executors.newFixedThreadPool(4);
        try {
            List<Callable<Boolean>> calls = new ArrayList<>();
            for (int i = 0; i < 20; i++) calls.add(() -> codes.verify("concurrency-test", code));
            int successes = 0;
            for (var result : executor.invokeAll(calls)) if (result.get()) successes++;
            assertThat(successes).isEqualTo(1);
        } finally { executor.shutdownNow(); }
    }

    @Test void wrongCodesExhaustTheChallengeAndResendsHaveCooldown() {
        String code = codes.generateAndStore("attempt-test");
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) assertThat(codes.verify("attempt-test", wrong)).isFalse();
        assertThat(codes.verify("attempt-test", code)).isFalse();
        codes.generateAndStore("cooldown-test");
        assertThatThrownBy(() -> codes.generateAndStore("cooldown-test")).isInstanceOf(ApiException.class);
    }

    @Test void publicCvRequiresActiveNonAdminProfileAndCompleteVisibility() {
        account.getRoles().clear();
        account.getRoles().add("ROLE_USER");
        Usuario user = Usuario.builder().id(7L).authUser(account).visibilidadPerfil("COMPLETA").consentimientoDirectorioPublico(true).build();
        user.setRegistro1(Registro1.builder().usuario(user).tipoPerfil(Registro1.TipoPerfil.INVESTIGADOR).build());
        Documento document = Documento.builder().id(8L).usuario(user).tipo(Documento.TipoDocumento.CV)
                .nombreArchivo("audit.pdf").contentType("application/pdf").contenido(new byte[]{1}).build();
        var docs = mock(DocumentoService.class);
        when(docs.obtenerDocumento(8L)).thenReturn(Optional.of(document));
        var controller = new DocumentoController(docs, mock(UsuarioRepository.class), mock(ConfiguracionSistemaService.class));
        assertThat(controller.descargarDocumentoPublico(8L).getStatusCode().value()).isEqualTo(200);
        for (String visibility : List.of("MINIMA", "ESTANDAR", "INVALID")) {
            user.setVisibilidadPerfil(visibility);
            assertThatThrownBy(() -> controller.descargarDocumentoPublico(8L)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        }
        user.setVisibilidadPerfil("COMPLETA");
        user.setConsentimientoDirectorioPublico(false);
        assertThat(controller.descargarDocumentoPublico(8L).getStatusCode().value()).isEqualTo(200);
        user.setConsentimientoDirectorioPublico(null);
        assertThat(controller.descargarDocumentoPublico(8L).getStatusCode().value()).isEqualTo(200);
        user.setConsentimientoDirectorioPublico(true);
        account.setLocked(true);
        assertThat(PublicProfilePolicy.canPublish(user)).isFalse();
        account.setLocked(false);
        account.getRoles().add("ROLE_ADMIN");
        assertThat(PublicProfilePolicy.canPublish(user)).isFalse();
    }

    @Test void forwardedHeadersCannotBypassTheRateLimit() throws Exception {
        var filter = new RateLimitFilter(1, 60);
        for (int i = 1; i <= 2; i++) {
            var request = new MockHttpServletRequest("POST", "/auth/login");
            request.setRemoteAddr("203.0.113.1");
            request.addHeader("X-Forwarded-For", "198.51.100." + i);
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, (req, res) -> {});
            assertThat(response.getStatus()).isEqualTo(i == 1 ? 200 : 429);
        }
    }

    @Test void cookieOnlyMutationRequiresNonSimpleHeader() throws Exception {
        var filter = new CookieRequestGuard();
        var request = new MockHttpServletRequest("POST", "/auth/logout");
        request.setCookies(new jakarta.servlet.http.Cookie("COMECYT_AUTH", "synthetic-token"));
        var denied = new MockHttpServletResponse();
        filter.doFilter(request, denied, (req, res) -> { throw new AssertionError("CSRF accepted"); });
        assertThat(denied.getStatus()).isEqualTo(403);
        request.addHeader("X-SIIMEX-Request", "1");
        var allowed = new MockHttpServletResponse();
        filter.doFilter(request, allowed, (req, res) -> {});
        assertThat(allowed.getStatus()).isEqualTo(200);
    }
}
