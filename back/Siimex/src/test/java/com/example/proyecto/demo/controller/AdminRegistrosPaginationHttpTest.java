package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Service.AdminRegistroListadoService;
import com.example.proyecto.demo.Service.AdminDatosBasicosService;
import com.example.proyecto.demo.Service.AdminExportacionService;
import com.example.proyecto.demo.Service.AuditLogService;
import com.example.proyecto.demo.exception.ApiException;
import jakarta.servlet.http.Cookie;
import org.springframework.http.HttpStatus;
import com.example.proyecto.demo.config.RedirectUnauthorizedEntryPoint;
import com.example.proyecto.demo.config.SecurityConfig;
import com.example.proyecto.demo.security.JwtFilter;
import com.example.proyecto.demo.security.RateLimitFilter;
import com.example.proyecto.demo.security.SecurityAuditFilter;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;
import java.nio.file.Files;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitWebConfig(AdminRegistrosPaginationHttpTest.Config.class)
@TestPropertySource(properties = { "app.cors.allowed-origin-patterns=http://localhost", "app.frontend.url=http://localhost" })
class AdminRegistrosPaginationHttpTest {
    @Autowired WebApplicationContext context;
    @Autowired AdminRegistroListadoService service;
    @Autowired AdminExportacionService exportaciones;
    @Autowired AuditLogService auditoria;
    @Autowired AdminDatosBasicosService datosBasicos;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        reset(service, exportaciones, auditoria, datosBasicos);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void exportManagementIsRestrictedToAdmins() throws Exception {
        String base = "/admin/registros/exportaciones";
        String id = UUID.randomUUID().toString();
        mvc.perform(post(base).accept("application/json").contentType("application/json").content("{\"ids\":[1]}"))
                .andExpect(status().isUnauthorized());
        for (String role : List.of("USER", "EVALUADOR")) {
            mvc.perform(post(base).with(user("2").roles(role)).contentType("application/json").content("{\"ids\":[1]}"))
                    .andExpect(status().isForbidden());
            mvc.perform(get(base + "/" + id).with(user("2").roles(role))).andExpect(status().isForbidden());
            mvc.perform(delete(base + "/" + id).with(user("2").roles(role))).andExpect(status().isForbidden());
            mvc.perform(post(base + "/" + id + "/preparar-descarga").with(user("2").roles(role))).andExpect(status().isForbidden());
        }
        verifyNoInteractions(exportaciones);
    }

    @Test
    void startsBackgroundExportAndAuditsTheAdmin() throws Exception {
        UUID id = UUID.randomUUID();
        var estado = new AdminExportacionService.Estado(id, "EN_COLA", 0, 1400, 0, 0, 0, 0, 0, "En cola", "expedientes.zip", Instant.now().plusSeconds(1800));
        when(exportaciones.iniciar(eq("10"), any())).thenReturn(estado);
        mvc.perform(post("/admin/registros/exportaciones").with(user("10").roles("ADMIN"))
                        .contentType("application/json").content("{\"perfil\":\"INVESTIGADOR\"}"))
                .andExpect(status().isAccepted()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.totalUsuarios").value(1400)).andExpect(jsonPath("$.porcentaje").value(0));
        verify(auditoria).registrarAdmin(eq("EXPORTAR_EXPEDIENTES"), anyString(), eq(10L), isNull(), eq("Usuario"), isNull(), anyString());
    }

    @Test
    void invalidUserIdsAreRejectedBeforeStartingTheExport() throws Exception {
        mvc.perform(post("/admin/registros/exportaciones").with(user("10").roles("ADMIN"))
                        .contentType("application/json").content("{\"ids\":[0,null]}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(exportaciones);
    }

    @Test
    void downloadAuthorizationUsesHttpOnlyShortLivedCookieNotAJwtInTheUrl() throws Exception {
        UUID id = UUID.randomUUID();
        when(exportaciones.prepararDescarga("10", id)).thenReturn("single-use-ticket");
        mvc.perform(post("/api/admin/registros/exportaciones/" + id + "/preparar-descarga").contextPath("/api")
                        .secure(true).with(user("10").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(cookie().httpOnly("siimex_export", true))
                .andExpect(cookie().secure("siimex_export", true)).andExpect(cookie().maxAge("siimex_export", 90))
                .andExpect(cookie().path("siimex_export", "/api/admin/registros/exportaciones/" + id + "/archivo"));
    }

    @Test
    void nativeDownloadWithoutTheExportTicketIsDenied() throws Exception {
        UUID id = UUID.randomUUID();
        when(exportaciones.abrirDescarga(id, null)).thenThrow(new ApiException(HttpStatus.FORBIDDEN, "Descarga no autorizada"));
        mvc.perform(get("/admin/registros/exportaciones/" + id + "/archivo")).andExpect(status().isForbidden());
        verify(exportaciones).abrirDescarga(id, null);
    }

    @Test
    void nativeDownloadStreamsTheFileAndClearsTheCookie() throws Exception {
        UUID id = UUID.randomUUID();
        var file = Files.createTempFile("siimex-http-export-test-", ".zip");
        byte[] bytes = new byte[]{80, 75, 3, 4};
        Files.write(file, bytes);
        try {
            when(exportaciones.abrirDescarga(id, "ticket")).thenReturn(new AdminExportacionService.Descarga(file, "expedientes.zip", bytes.length));
            mvc.perform(get("/admin/registros/exportaciones/" + id + "/archivo").cookie(new Cookie("siimex_export", "ticket")))
                    .andExpect(status().isOk()).andExpect(content().bytes(bytes)).andExpect(content().contentType("application/zip"))
                    .andExpect(header().string("Content-Length", "4")).andExpect(header().string("Cache-Control", "no-store, private"))
                    .andExpect(cookie().maxAge("siimex_export", 0));
            verify(exportaciones).cerrarDescarga(id);
        } finally { Files.deleteIfExists(file); }
    }

    @Test
    void anonymousCannotReadTheListing() throws Exception {
        mvc.perform(get("/admin/registros/paginado").accept("application/json")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    private String cambioValido() {
        return """
                {"nombre":"Ana Cecilia","apellidoPaterno":"Franco","apellidoMaterno":"De la Rosa",
                 "email":"corregido@example.test","curp":"FARA900101MMCRSN00","telefono":"7221000001",
                 "fechaNacimiento":"1990-01-01","genero":"FEMENINO","entidadFederativa":"Estado de Mexico",
                 "revision":"%s","motivo":"Correccion cotejada"}
                """.formatted("a".repeat(64));
    }

    @Test void datosBasicosExclusivosDeAdministradores() throws Exception {
        String url = "/admin/registros/1/datos-basicos";
        mvc.perform(get(url).accept("application/json")).andExpect(status().isUnauthorized());
        mvc.perform(patch(url).accept("application/json").contentType("application/json").content(cambioValido()))
                .andExpect(status().isUnauthorized());
        for (String role : List.of("USER", "EVALUADOR")) {
            mvc.perform(get(url).with(user("2").roles(role))).andExpect(status().isForbidden());
            mvc.perform(patch(url).with(user("2").roles(role)).contentType("application/json").content(cambioValido()))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(datosBasicos);
    }

    @Test void adminPuedeConsultarYGuardarSinExponerDatosDeSeguridad() throws Exception {
        var datos = new com.example.proyecto.demo.dto.AdminDatosBasicos.Datos(1L, "Ana Cecilia", "Franco", "De la Rosa",
                "corregido@example.test", "FARA900101MMCRSN00", "7221000001", java.time.LocalDate.of(1990,1,1),
                "FEMENINO", "Estado de Mexico", "a".repeat(64));
        when(datosBasicos.consultar(1L)).thenReturn(datos);
        when(datosBasicos.actualizar(eq(1L), any(), eq(10L), anyString())).thenReturn(datos);
        mvc.perform(get("/admin/registros/1/datos-basicos").with(user("10").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.revision").value("a".repeat(64))).andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(patch("/admin/registros/1/datos-basicos").with(user("10").roles("ADMIN"))
                        .header("X-Forwarded-For", "spoofed-ip").contentType("application/json").content(cambioValido()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.email").value("corregido@example.test"));
        verify(datosBasicos).actualizar(eq(1L), any(), eq(10L), eq("127.0.0.1"));
    }

    @Test void validaCorreoCurpMotivoFechaYRevisionAntesDeGuardar() throws Exception {
        for (String body : List.of(cambioValido().replace("corregido@example.test", "no-es-correo"),
                cambioValido().replace("FARA900101MMCRSN00", "corta"),
                cambioValido().replace("Correccion cotejada", "  "),
                cambioValido().replace("1990-01-01", "2990-01-01"),
                cambioValido().replace("1990-01-01", "no-es-fecha"),
                cambioValido().replace("a".repeat(64), "sin-revision"))) {
            mvc.perform(patch("/admin/registros/1/datos-basicos").with(user("10").roles("ADMIN"))
                            .contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(datosBasicos);
    }

    @Test void unaColisionConcurrenteDeBaseSeDevuelveComo409() throws Exception {
        when(datosBasicos.actualizar(anyLong(), any(), anyLong(), anyString()))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("private SQL details"));
        mvc.perform(patch("/admin/registros/1/datos-basicos").with(user("10").roles("ADMIN"))
                        .contentType("application/json").content(cambioValido()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("correo o la CURP")));
    }

    @Test
    void ordinaryUsersAndEvaluatorsCannotReadTheListing() throws Exception {
        mvc.perform(get("/admin/registros/paginado").with(user("normal").roles("USER")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/admin/registros/paginado").with(user("evaluador").roles("EVALUADOR")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void adminGetsPaginatedJsonAndFiltersReachTheService() throws Exception {
        when(service.listar(3, 10, "Persona", "INNOVADOR", "FEMENINO", "Puebla", "Toluca", true))
                .thenReturn(Map.of("content", List.of(Map.of("id", 31L)), "totalElements", 1400, "totalPages", 140));
        mvc.perform(get("/admin/registros/paginado").with(user("admin").roles("ADMIN"))
                        .param("page", "3").param("busqueda", "Persona").param("perfil", "INNOVADOR")
                        .param("sexo", "FEMENINO").param("entidad", "Puebla").param("municipio", "Toluca")
                        .param("incluirOpciones", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(31))
                .andExpect(jsonPath("$.totalPages").value(140));
        verify(service).listar(3, 10, "Persona", "INNOVADOR", "FEMENINO", "Puebla", "Toluca", true);
    }

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import({SecurityConfig.class, RedirectUnauthorizedEntryPoint.class, GlobalExceptionHandler.class})
    static class Config {
        @Bean AdminRegistroListadoService service() { return mock(AdminRegistroListadoService.class); }
        @Bean AdminExportacionService exportaciones() { return mock(AdminExportacionService.class); }
        @Bean AuditLogService auditoria() { return mock(AuditLogService.class); }
        @Bean AdminDatosBasicosService datosBasicos() { return mock(AdminDatosBasicosService.class); }
        @Bean AdminDatosBasicosController datosController(AdminDatosBasicosService service) { return new AdminDatosBasicosController(service); }
        @Bean AdminExportacionController exportacionController(AdminExportacionService exportaciones, AuditLogService auditoria) {
            return new AdminExportacionController(exportaciones, auditoria);
        }
        @Bean AdminController controller(AdminRegistroListadoService service) {
            // Exercise the real mapping without constructing unrelated services or connecting to a database.
            AdminController controller = mock(AdminController.class, CALLS_REAL_METHODS);
            ReflectionTestUtils.setField(controller, "adminRegistroListadoService", service);
            return controller;
        }
        @Bean JwtFilter jwtFilter() throws Exception { return passthrough(JwtFilter.class); }
        @Bean RateLimitFilter rateLimitFilter() throws Exception { return passthrough(RateLimitFilter.class); }
        @Bean com.example.proyecto.demo.security.CookieRequestGuard cookieRequestGuard() { return new com.example.proyecto.demo.security.CookieRequestGuard(); }
        @Bean SecurityAuditFilter securityAuditFilter() throws Exception { return passthrough(SecurityAuditFilter.class); }
        private <T extends Filter> T passthrough(Class<T> type) throws Exception {
            T filter = mock(type);
            doAnswer(invocation -> {
                FilterChain chain = invocation.getArgument(2);
                chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
                return null;
            }).when(filter).doFilter(any(), any(), any());
            return filter;
        }
    }
}
