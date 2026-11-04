package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Repository.AdminRegistroRepository;
import com.example.proyecto.demo.dto.AdminExportacionRequest;
import com.example.proyecto.demo.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.stream.LongStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@JdbcTest(properties = {
        "spring.config.location=optional:classpath:/isolated-export-test.properties",
        "spring.datasource.url=jdbc:h2:mem:export-test;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
        "debug=false", "logging.level.root=WARN"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({AdminExpedienteDatosService.class, AdminExportacionService.class, ObjectMapper.class})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AdminExportacionServiceTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired AdminExportacionService service;
    @MockitoSpyBean AdminExpedienteDatosService datos;
    @MockitoBean AdminRegistroRepository repository;
    private static final Path TEMP = temp();
    private static Path temp() {
        try { return Files.createTempDirectory("siimex-export-test-"); } catch (IOException ex) { throw new UncheckedIOException(ex); }
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry props) {
        props.add("app.admin.exportaciones.directorio", TEMP::toString);
        props.add("app.admin.exportaciones.max-bytes", () -> 20L * 1024 * 1024 * 1024);
        props.add("app.admin.exportaciones.retencion-minutos", () -> 30);
    }

    @BeforeAll void seed() {
        assertThat(jdbc.queryForObject("SELECT H2VERSION()", String.class)).isNotBlank();
        jdbc.execute("CREATE TABLE usuarios (id BIGINT PRIMARY KEY, auth_user_id BIGINT, nombre VARCHAR(200), apellido_paterno VARCHAR(100), apellido_materno VARCHAR(100), visibilidad_perfil VARCHAR(20), consentimiento_directorio_publico BOOLEAN, semblanza CLOB, registro2_completo BOOLEAN)");
        jdbc.execute("CREATE TABLE auth_users (id BIGINT PRIMARY KEY, email VARCHAR(200), username VARCHAR(200), enabled BOOLEAN, locked BOOLEAN, last_login_at TIMESTAMP, password_hash VARCHAR(100), remember_token_hash VARCHAR(100))");
        jdbc.execute("CREATE TABLE auth_user_roles (auth_user_id BIGINT, role VARCHAR(40))");
        jdbc.execute("CREATE TABLE registro1 (id BIGINT, curp VARCHAR(18), telefono VARCHAR(20))");
        jdbc.execute("CREATE TABLE documentos (id BIGINT PRIMARY KEY, usuario_id BIGINT, tipo VARCHAR(40), nombre_archivo VARCHAR(255), size_bytes BIGINT, contenido BLOB)");
        for (String table : List.of("instituciones", "areas_conocimiento", "intereses_habilidades", "perfiles_migracion",
                "trayectorias_academicas", "trayectorias_profesionales", "estancias", "congresos", "divulgaciones", "articulos",
                "cursos", "idiomas", "logros", "herramientas", "incidencia_social", "propiedad_intelectual")) {
            jdbc.execute("CREATE TABLE " + table + " (id BIGINT, usuario_id BIGINT, descripcion CLOB)");
        }
        jdbc.execute("CREATE TABLE autores_articulos (id BIGINT, articulo_id BIGINT, orden INT, nombre_completo VARCHAR(200))");
        for (int id = 1; id <= 1400; id++) {
            jdbc.update("INSERT INTO usuarios VALUES (?, ?, ?, 'Prueba', '', 'MINIMA', false, ?, true)",
                    id, id, "Persona " + id, "<script>alert('xss')</script>");
            jdbc.update("INSERT INTO auth_users VALUES (?, ?, ?, true, false, CURRENT_TIMESTAMP, 'HASH_SECRETO', 'TOKEN_SECRETO')",
                    id, "prueba" + id + "@example.test", "prueba" + id);
            jdbc.update("INSERT INTO auth_user_roles VALUES (?, 'ROLE_USER')", id);
            jdbc.update("INSERT INTO registro1 VALUES (?, ?, '7221000000')", id, String.format("TEST%014d", id));
            jdbc.update("INSERT INTO documentos VALUES (?, ?, 'CV', '../../informe.pdf', 9, ?)", id, id, "%PDF-test".getBytes(StandardCharsets.UTF_8));
        }
        jdbc.update("INSERT INTO documentos VALUES (1401, 1, 'CV', '../../informe.pdf', 9, ?)", "%PDF-otro".getBytes(StandardCharsets.UTF_8));
        jdbc.update("INSERT INTO cursos VALUES (1, 1, 'Curso de prueba completo')");
    }

    @BeforeEach void mocks() {
        reset(repository, datos);
        when(repository.idsExistentes(anyList())).thenAnswer(inv -> ((List<Long>) inv.getArgument(0)).stream().distinct().sorted().toList());
        when(repository.idsParaExportar(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(LongStream.rangeClosed(1, 1400).boxed().toList());
        when(repository.contarAdministradorActivo(anyLong())).thenReturn(1L);
    }

    private AdminExportacionRequest selected(Long... ids) {
        return new AdminExportacionRequest(List.of(ids), null, null, null, null, null);
    }
    private AdminExportacionService.Estado listo(String owner, AdminExportacionRequest request) {
        var start = service.iniciar(owner, request);
        await().atMost(Duration.ofSeconds(120)).until(() -> !List.of("EN_COLA", "PREPARANDO").contains(service.consultar(owner, start.id()).estado()));
        var result = service.consultar(owner, start.id());
        assertThat(result.estado()).withFailMessage(result.mensaje()).isEqualTo("LISTO");
        return result;
    }

    @Test void zipContieneDatosCompletosDocumentosOriginalesYNombresSegurosSinCredenciales() throws Exception {
        var ready = listo("10", selected(1L));
        assertThat(ready.porcentaje()).isEqualTo(100);
        assertThat(ready.documentosProcesados()).isEqualTo(2);
        assertThatThrownBy(() -> service.consultar("20", ready.id())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.abrirDescarga(ready.id(), null)).isInstanceOf(ApiException.class);
        String ticket = service.prepararDescarga("10", ready.id());
        var file = service.abrirDescarga(ready.id(), ticket);
        Set<String> paths = new HashSet<>();
        String json = "", html = "";
        int pdfs = 0;
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(file.archivo()))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                assertThat(entry.getName()).doesNotContain("..").doesNotStartWith("/").doesNotStartWith("\\");
                assertThat(paths.add(entry.getName())).isTrue();
                byte[] bytes = zip.readAllBytes();
                String text = new String(bytes, StandardCharsets.UTF_8);
                assertThat(text).doesNotContain("HASH_SECRETO", "TOKEN_SECRETO", "password_hash", "remember_token_hash");
                if (entry.getName().endsWith("datos.json")) json = text;
                if (entry.getName().endsWith("ficha.html")) html = text;
                if (entry.getName().endsWith(".pdf")) {
                    assertThat(text).isIn("%PDF-test", "%PDF-otro");
                    pdfs++;
                }
            }
        } finally { service.cerrarDescarga(ready.id()); }
        assertThat(pdfs).isEqualTo(2);
        assertThat(json).contains("Curso de prueba completo", "TEST00000000000001", "prueba1@example.test");
        assertThat(html).contains("&lt;script&gt;").doesNotContain("<script>");
        assertThatThrownBy(() -> service.abrirDescarga(ready.id(), ticket)).isInstanceOf(ApiException.class);
        assertThat(paths).contains("indice.csv", "LEEME.txt");
        service.cancelar("10", ready.id());
        assertThat(file.archivo()).doesNotExist();
    }

    @Test void exportaLos1400UsuariosSinLimitarseALaPaginaVisible() throws Exception {
        var ready = listo("30", new AdminExportacionRequest(null, "", "", "", "", ""));
        assertThat(ready.totalUsuarios()).isEqualTo(1400);
        assertThat(ready.usuariosProcesados()).isEqualTo(1400);
        assertThat(ready.documentosProcesados()).isEqualTo(1401);
        var file = service.abrirDescarga(ready.id(), service.prepararDescarga("30", ready.id()));
        int perfiles = 0, docs = 0;
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(file.archivo()))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().endsWith("datos.json")) perfiles++;
                if (entry.getName().endsWith(".pdf")) docs++;
            }
        } finally { service.cerrarDescarga(ready.id()); }
        assertThat(perfiles).isEqualTo(1400);
        assertThat(docs).isEqualTo(1401);
        System.out.printf("ZIP_1400: %d usuarios, %d documentos, %d bytes, progreso 100%%%n", perfiles, docs, ready.tamanoBytes());
        service.cancelar("30", ready.id());
    }

    @Test void filtrosSeAplicanATodoElConjuntoYLaSeleccionPuedeSuperar10() {
        var ready = listo("40", new AdminExportacionRequest(LongStream.rangeClosed(1, 25).boxed().toList(), null, null, null, null, null));
        assertThat(ready.usuariosProcesados()).isEqualTo(25);
        service.cancelar("40", ready.id());
        when(repository.idsParaExportar(anyString(), anyString(), anyString(), anyString(), anyString(), anyString())).thenReturn(List.of(1400L));
        ready = listo("40", new AdminExportacionRequest(null, "Persona 1400", "INNOVADOR", "FEMENINO", "Puebla", "Toluca"));
        verify(repository).idsParaExportar("%persona 1400%", "%persona1400%", "INNOVADOR", "FEMENINO", "Puebla", "Toluca");
        assertThat(ready.totalUsuarios()).isEqualTo(1);
        service.cancelar("40", ready.id());
    }

    @Test void cancelacionYProgresoSonRealesYNoSeEntregaUnZipIncompleto() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        doAnswer(inv -> { started.countDown(); Thread.sleep(30000); return inv.callRealMethod(); })
                .when(datos).copiarDocumento(any(), any(), any());
        var start = service.iniciar("50", selected(1L));
        assertThat(started.await(10, TimeUnit.SECONDS)).isTrue();
        var during = service.consultar("50", start.id());
        assertThat(during.estado()).isEqualTo("PREPARANDO");
        assertThat(during.porcentaje()).isLessThan(100);
        assertThatThrownBy(() -> service.iniciar("50", selected(2L))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.prepararDescarga("50", start.id())).isInstanceOf(ApiException.class);
        service.cancelar("50", start.id());
        await().atMost(Duration.ofSeconds(5)).until(() -> !Files.exists(TEMP.resolve(start.id() + ".zip")));
        assertThat(service.consultar("50", start.id()).estado()).isEqualTo("CANCELADO");
    }

    @Test void unLimiteDeEspacioProduceErrorExplicitoYEliminaElArchivoParcial() {
        ReflectionTestUtils.setField(service, "maxBytes", 100L);
        try {
            var start = service.iniciar("60", selected(2L));
            await().atMost(Duration.ofSeconds(10)).until(() -> service.consultar("60", start.id()).estado().equals("ERROR"));
            assertThat(service.consultar("60", start.id()).mensaje()).contains("limite");
            await().atMost(Duration.ofSeconds(5)).until(() -> !Files.exists(TEMP.resolve(start.id() + ".zip")));
        } finally { ReflectionTestUtils.setField(service, "maxBytes", 20L * 1024 * 1024 * 1024); }
    }

    @Test void permisosVigentesYTiqueteSeValidanAlDescargar() {
        var ready = listo("70", selected(2L));
        String ticket = service.prepararDescarga("70", ready.id());
        when(repository.contarAdministradorActivo(70L)).thenReturn(0L);
        assertThatThrownBy(() -> service.abrirDescarga(ready.id(), ticket)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.abrirDescarga(ready.id(), "invalido")).isInstanceOf(ApiException.class);
        service.cancelar("70", ready.id());
    }

    @Test void ticketsCaducadosYExportacionesVencidasNoDanAccesoYSeLimpian() {
        var ready = listo("80", selected(2L));
        String ticket = service.prepararDescarga("80", ready.id());
        Map<?, ?> jobs = (Map<?, ?>) ReflectionTestUtils.getField(service, "trabajos");
        Object job = jobs.get(ready.id());
        ReflectionTestUtils.setField(job, "ticketVence", Instant.now().minusSeconds(1));
        assertThatThrownBy(() -> service.abrirDescarga(ready.id(), ticket)).isInstanceOf(ApiException.class);
        ReflectionTestUtils.setField(job, "vence", Instant.now().minusSeconds(1));
        assertThatThrownBy(() -> service.consultar("80", ready.id())).isInstanceOf(ApiException.class);
        service.limpiarCaducados();
        assertThat(TEMP.resolve(ready.id() + ".zip")).doesNotExist();
        assertThatThrownBy(() -> service.consultar("80", ready.id())).isInstanceOf(ApiException.class);
    }

    @Test void unaSeleccionInvalidaNoEliminaUnZipQueYaEstabaListo() {
        var ready = listo("90", selected(2L));
        assertThatThrownBy(() -> service.iniciar("90", selected())).isInstanceOf(ApiException.class);
        assertThat(service.consultar("90", ready.id()).estado()).isEqualTo("LISTO");
        service.cancelar("90", ready.id());
    }

    @AfterAll void cleanup() throws IOException {
        service.cerrar();
        try (var files = Files.list(TEMP)) { assertThat(files.count()).isZero(); }
        Files.deleteIfExists(TEMP);
    }
}
