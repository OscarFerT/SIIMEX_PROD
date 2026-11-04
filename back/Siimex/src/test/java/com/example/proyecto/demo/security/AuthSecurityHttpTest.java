package com.example.proyecto.demo.security;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Repository.*;
import com.example.proyecto.demo.Service.*;
import com.example.proyecto.demo.config.*;
import com.example.proyecto.demo.controller.AuthController;
import com.example.proyecto.demo.controller.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitWebConfig(AuthSecurityHttpTest.Config.class)
@TestPropertySource(properties = {"app.cors.allowed-origin-patterns=http://localhost", "app.frontend.url=http://localhost", "security.jwt.expiration-ms=60000", "azure.save-to-sent-items=false"})
class AuthSecurityHttpTest {
    @Autowired WebApplicationContext context;
    @Autowired AuthUserRepository accounts;
    @Autowired AuthService auth;
    @Autowired VerificationCodeService codes;
    @Autowired MicrosoftGraphEmailService mail;
    MockMvc mvc;
    AuthUser account;
    final ObjectMapper json = new ObjectMapper();

    @BeforeEach void setup() {
        reset(accounts, mail);
        account = AuthUser.builder().id(42L).email("http-audit@example.test").username("http-audit@example.test")
                .enabled(true).roles(new HashSet<>(Set.of("ROLE_ADMIN"))).passwordHash("synthetic-hash").build();
        when(accounts.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        when(accounts.findById(account.getId())).thenReturn(Optional.of(account));
        doAnswer(inv -> { account.revokeSessions(); return 1; }).when(accounts).revokeSessions(account.getId());
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test void actualHttpTwoFactorLoginProtectedAccessAndLogout() throws Exception {
        mvc.perform(post("/auth/login").contentType("application/json").content("{\"email\":\"http-audit@example.test\",\"password\":\"TestPassword123\"}"))
                .andExpect(status().isGone());
        mvc.perform(post("/auth/login/request-code").contentType("application/json")
                .content("{\"email\":\"http-audit@example.test\",\"password\":\"TestPassword123\",\"adminOnly\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.requiresVerification").value(true));
        var code = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendVerificationCode(eq(account.getEmail()), code.capture());
        var login = mvc.perform(post("/auth/login/verify-code").secure(true).contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", account.getEmail(), "code", code.getValue(), "adminOnly", true))))
                .andExpect(status().isOk()).andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Secure"))).andReturn();
        String token = json.readTree(login.getResponse().getContentAsString()).get("token").asText();
        mvc.perform(get("/admin/security-test").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(post("/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(get("/admin/security-test").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void resetCannotRunWithoutCodeAndResetCodesCannotLogIn() throws Exception {
        mvc.perform(post("/auth/reset-password").contentType("application/json")
                .content("{\"email\":\"http-audit@example.test\",\"curp\":\"TEST900101HMCRRR00\",\"newPassword\":\"TestPassword123\"}"))
                .andExpect(status().isBadRequest());
        assertThat(account.getPasswordHash()).isEqualTo("synthetic-hash");
        mvc.perform(post("/auth/reset-password/request-code").contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", account.getEmail()))))
                .andExpect(status().isOk());
        var code = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordResetCode(eq(account.getEmail()), code.capture());
        mvc.perform(post("/auth/login/verify-code").contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", account.getEmail(), "code", code.getValue(), "adminOnly", true))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/auth/reset-password").contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", account.getEmail(), "code", code.getValue(), "newPassword", "ChangedTestPassword123"))))
                .andExpect(status().isOk());
        assertThat(account.getPasswordHash()).isEqualTo("updated-synthetic-hash");
    }

    @Configuration @EnableWebMvc @EnableWebSecurity
    @Import({SecurityConfig.class, AuthController.class, GlobalExceptionHandler.class, CookieRequestGuard.class, TestResource.class})
    static class Config {
        @Bean AuthUserRepository accounts() { return mock(AuthUserRepository.class); }
        @Bean MicrosoftGraphEmailService mail() { return mock(MicrosoftGraphEmailService.class); }
        @Bean AuditLogService auditLog() { return mock(AuditLogService.class); }
        @Bean SecretKey key() { return Keys.hmacShaKeyFor("synthetic-http-test-key-never-use-in-production-123456".getBytes(StandardCharsets.UTF_8)); }
        @Bean VerificationCodeService codes() { return new VerificationCodeService(); }
        @Bean AuthService auth(AuthUserRepository accounts, MicrosoftGraphEmailService mail, SecretKey key, VerificationCodeService codes) {
            var encoder = mock(PasswordEncoder.class);
            when(encoder.matches(eq("TestPassword123"), anyString())).thenReturn(true);
            when(encoder.encode(anyString())).thenReturn("updated-synthetic-hash");
            var service = new AuthService(accounts, mock(EmailVerificationTokenRepository.class), mock(UsuarioRepository.class), mock(Registro1Repository.class),
                    encoder, key, codes, mail, mock(NotificacionService.class), mock(ConfiguracionSistemaService.class), new AuthAttemptService(5, 15));
            ReflectionTestUtils.setField(service, "jwtExpirationMs", 60000L);
            return service;
        }
        @Bean JwtFilter jwtFilter(SecretKey key, AuthUserRepository accounts) { return new JwtFilter(new JwtVerifier(key, accounts)); }
        @Bean RateLimitFilter rateLimit() { return new RateLimitFilter(1000, 60); }
        @Bean SecurityAuditFilter auditFilter(AuditLogService audit) { return new SecurityAuditFilter(audit); }
        @Bean RedirectUnauthorizedEntryPoint unauthorized() { return new RedirectUnauthorizedEntryPoint(); }
    }

    @RestController static class TestResource {
        @GetMapping("/admin/security-test") Map<String, Boolean> resource() { return Map.of("ok", true); }
    }
}
