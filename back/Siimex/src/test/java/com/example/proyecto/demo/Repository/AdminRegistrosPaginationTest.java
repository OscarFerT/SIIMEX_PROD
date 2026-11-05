package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Service.AdminRegistroListadoService;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(showSql = false, properties = {
        // All database work is restricted to an in-memory H2 database.
        "spring.config.location=optional:classpath:/isolated-pagination-test.properties",
        "spring.datasource.url=jdbc:h2:mem:admin-pagination;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.hbm2ddl.halt_on_error=true",
        "debug=false", "logging.level.root=WARN", "logging.level.org.hibernate.SQL=OFF",
        "logging.level.org.hibernate.orm.jdbc.bind=OFF",
        "logging.level.org.hibernate.stat=OFF",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(AdminRegistroListadoService.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AdminRegistrosPaginationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @Autowired AdminRegistroListadoService service;
    @Autowired UsuarioRepository usuarios;
    @Autowired DocumentoRepository documentos;
    @Autowired ListaNegraRepository listaNegra;
    @Autowired AdminRegistroRepository adminRegistros;
    Statistics stats;

    @BeforeAll
    void seed1400IsolatedUsers() {
        for (int id = 1; id <= 1400; id++) {
            String email = "prueba" + id + "@example.test";
            jdbc.update("INSERT INTO auth_users (id, username, email, password_hash, enabled, locked, last_login_at) VALUES (?, ?, ?, ?, ?, false, ?)",
                    id, email, email, "not-a-real-password", id != 2, Timestamp.from(Instant.parse("2026-01-01T12:00:00Z")));
            jdbc.update("INSERT INTO auth_user_roles (auth_user_id, role) VALUES (?, ?)", id, id == 1 ? "ROLE_ADMIN" : "ROLE_USER");
            jdbc.update("INSERT INTO usuarios (id, auth_user_id, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, 'Apellido', 'Prueba')",
                    id, id, "Persona " + id);
            jdbc.update("INSERT INTO registro1 (id, curp, fecha_nacimiento, genero, tipo_perfil, entidad_federativa, municipio, telefono) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    id, String.format("TEST%014d", id), Date.valueOf("1990-01-01"), id % 2 == 0 ? "FEMENINO" : "MASCULINO",
                    id % 3 == 0 ? "INNOVADOR" : "INVESTIGADOR", id <= 700 ? "Mexico" : "Puebla",
                    id <= 700 ? "Toluca" : "Municipio remoto", "722 " + String.format("%07d", id));
            jdbc.update("INSERT INTO documentos (id, usuario_id, tipo, nombre_archivo, content_type, size_bytes, contenido, fecha_subida) VALUES (?, ?, 'FOTO_PERFIL', 'foto.png', 'image/png', 4096, ?, ?)",
                    id, id, new byte[4096], Timestamp.from(Instant.now()));
        }
        jdbc.update("INSERT INTO auth_user_roles (auth_user_id, role) VALUES (3, 'ROLE_EVALUADOR')");
        jdbc.update("INSERT INTO usuarios (id, nombre) VALUES (1401, 'Sin cuenta de acceso')");
        // A newer date wins even when the document ID is lower.
        jdbc.update("UPDATE documentos SET fecha_subida = ? WHERE id = 1", Timestamp.from(Instant.parse("2090-01-01T00:00:00Z")));
        jdbc.update("INSERT INTO documentos (id, usuario_id, tipo, nombre_archivo, content_type, size_bytes, contenido, fecha_subida) VALUES (1401, 1, 'FOTO_PERFIL', 'vieja.png', 'image/png', 1, ?, ?)",
                new byte[1], Timestamp.from(Instant.parse("2020-01-01T00:00:00Z")));
        LocalDate hoy = LocalDate.now();
        for (int id = 1; id <= 5; id++) {
            jdbc.update("INSERT INTO lista_negra (id, usuario_id, email, curp, motivo, tipo_sancion, fecha_inicio, fecha_fin, activa, created_at) VALUES (?, ?, ?, ?, 'Prueba', 'ANIO', ?, ?, ?, ?)",
                    id, id == 1 || id >= 4 ? id : null, id == 2 ? "PRUEBA2@EXAMPLE.TEST" : null,
                    id == 3 ? String.format("TEST%014d", 3) : null, Date.valueOf(hoy.minusDays(1)),
                    id == 4 ? Date.valueOf(hoy.minusDays(1)) : null, id != 5, Timestamp.from(Instant.now()));
        }
    }

    @BeforeEach
    void resetStatistics() {
        em.clear();
        stats = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        stats.clear();
    }

    @Test
    void directorioIncluyeFichasAutorizadasAntesDePaginarYNoInfiereSemblanzaMinima() {
        jdbc.update("UPDATE usuarios SET consentimiento_directorio_publico = true, visibilidad_perfil = 'ESTANDAR' WHERE id BETWEEN 3 AND 18");
        jdbc.update("UPDATE usuarios SET consentimiento_directorio_publico = true WHERE id IN (1, 2, 20)");
        jdbc.update("UPDATE auth_users SET locked = true WHERE id = 20");
        var tipos = List.of(com.example.proyecto.demo.Entity.Registro1.TipoPerfil.INVESTIGADOR,
                com.example.proyecto.demo.Entity.Registro1.TipoPerfil.INNOVADOR,
                com.example.proyecto.demo.Entity.Registro1.TipoPerfil.HIBRIDO);
        var first = usuarios.findDirectorioPage(tipos, null, null, null, null, org.springframework.data.domain.PageRequest.of(0, 8));
        var second = usuarios.findDirectorioPage(tipos, null, null, null, null, org.springframework.data.domain.PageRequest.of(1, 8));
        assertThat(first.getTotalElements()).isEqualTo(1397);
        assertThat(first.getContent()).hasSize(8);
        assertThat(second.getContent()).hasSize(8);
        assertThat(usuarios.countDirectorioByTipos(tipos)).isEqualTo(1397);
        jdbc.update("UPDATE usuarios SET semblanza = 'TextoReservadoAuditoria', visibilidad_perfil = 'MINIMA' WHERE id = 3");
        em.clear();
        assertThat(usuarios.findDirectorioPage(tipos, null, null, null, "TextoReservadoAuditoria", org.springframework.data.domain.PageRequest.of(0, 8)).getTotalElements()).isZero();
        jdbc.update("UPDATE usuarios SET visibilidad_perfil = 'ESTANDAR' WHERE id = 3");
        assertThat(usuarios.findDirectorioPage(tipos, null, null, null, "TextoReservadoAuditoria", org.springframework.data.domain.PageRequest.of(0, 8)).getTotalElements()).isEqualTo(1);
    }

    Map<String, Object> page(int page, int size) {
        return service.listar(page, size, "", "", "", "", "", false);
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> rows(Map<String, Object> page) {
        return (List<Map<String, Object>>) page.get("content");
    }

    @Test
    void initialPageHasTenRowsAndNeverHydratesProfilesOrBlobs() {
        long start = System.nanoTime();
        var response = service.listar(0, 10, "", "", "", "", "", true);
        assertThat(rows(response)).hasSize(10);
        assertThat(response.get("totalElements")).isEqualTo(1400L);
        assertThat(response.get("totalPages")).isEqualTo(140);
        assertThat(response.get("totalRegistros")).isEqualTo(1400L);
        assertThat(response.get("entidades")).isEqualTo(List.of("Mexico", "Puebla"));
        assertThat(response.get("municipios")).isEqualTo(List.of("Municipio remoto", "Toluca"));
        assertThat(stats.getEntityLoadCount()).isZero();
        assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(6);
        System.out.printf("PAGINATED_1400: first page 10 rows, %d SQL statements, %d entities, %.1f ms%n",
                stats.getPrepareStatementCount(), stats.getEntityLoadCount(), (System.nanoTime() - start) / 1_000_000.0);
        var first = rows(response).get(0);
        assertThat(first.get("roles")).isEqualTo(List.of("ROLE_ADMIN"));
        assertThat(first.get("fotoDocumentoId")).isEqualTo(1L);
        assertThat(first.get("lastLoginAt")).isEqualTo("2026-01-01T12:00:00Z");
        assertThat(first).doesNotContainKeys("authUserId", "passwordHash", "contenido", "rememberTokenHash");
        assertThat(rows(response).get(1).get("id")).isEqualTo(2L); // Suspended accounts remain manageable.
        assertThat(rows(response).get(2).get("roles")).asList().contains("ROLE_USER", "ROLE_EVALUADOR");
        assertThat(rows(response).subList(0, 3)).allSatisfy(r -> assertThat(r.get("bloqueadoListaNegra")).isEqualTo(true));
        assertThat(rows(response).subList(3, 5)).allSatisfy(r -> assertThat(r.get("bloqueadoListaNegra")).isEqualTo(false));
    }

    @Test
    void traversesAll140PagesWithoutGapsOrDuplicates() {
        Set<Long> ids = new HashSet<>();
        for (int p = 0; p < 140; p++) {
            var content = rows(page(p, 10));
            assertThat(content).hasSize(10);
            for (int i = 0; i < content.size(); i++) {
                long id = (Long) content.get(i).get("id");
                assertThat(id).isEqualTo(p * 10L + i + 1);
                assertThat(ids.add(id)).isTrue();
            }
        }
        assertThat(ids).hasSize(1400);
        assertThat(stats.getEntityLoadCount()).isZero();
    }

    @Test
    void filtersApplyBeforePaginationAcrossTheEntireDataset() {
        var filtered = service.listar(0, 10, "", "INNOVADOR", "FEMENINO", "Puebla", "Municipio remoto", false);
        assertThat(filtered.get("totalElements")).isEqualTo(117L);
        assertThat(rows(filtered)).hasSize(10).allSatisfy(r -> {
            assertThat((Long) r.get("id")).isGreaterThan(700L);
            assertThat(r.get("tipoPerfil")).isEqualTo("INNOVADOR");
            assertThat(r.get("genero")).isEqualTo("FEMENINO");
        });
        var found = service.listar(0, 10, "Persona 1400 Apellido Prueba", "", "", "", "", false);
        assertThat(found.get("totalElements")).isEqualTo(1L);
        assertThat(rows(found).get(0).get("id")).isEqualTo(1400L);
        var phone = service.listar(0, 10, "7220001400", "", "", "", "", false);
        assertThat(rows(phone)).hasSize(1);
    }

    @Test
    void limitsPageSizeEscapesWildcardsAndReturnsEmptyPagesSafely() {
        assertThat(rows(page(-1, 5000))).hasSize(100);
        assertThat(rows(page(0, 0))).hasSize(1);
        assertThat(rows(page(140, 10))).isEmpty();
        assertThat(rows(service.listar(0, 10, "%", "", "", "", "", false))).isEmpty();
        assertThat(rows(service.listar(0, 10, "_", "", "", "", "", false))).isEmpty();
    }

    @Test
    void exportIdsUseGlobalFiltersWithoutLoadingAnyDocument() {
        assertThat(adminRegistros.idsParaExportar("", "", "", "", "", "")).hasSize(1400);
        assertThat(adminRegistros.idsParaExportar("", "", "INNOVADOR", "FEMENINO", "Puebla", "Municipio remoto")).hasSize(117);
        assertThat(adminRegistros.idsExistentes(List.of(1L, 1400L, 1401L))).containsExactly(1L, 1400L);
        assertThat(adminRegistros.contarAdministradorActivo(1L)).isEqualTo(1L);
        assertThat(adminRegistros.contarAdministradorActivo(2L)).isZero();
        assertThat(stats.getEntityLoadCount()).isZero();
    }

    @Test
    void reproducesLegacyWorkWith1400UsersForComparison() {
        long start = System.nanoTime();
        var all = usuarios.findAllWithRelations();
        assertThat(all).hasSize(1400);
        all.forEach(u -> {
            u.getAuthUser().getRoles().size();
            documentos.findAllByUsuarioIdAndTipoOrderByFechaSubidaDescIdDesc(u.getId(), Documento.TipoDocumento.FOTO_PERFIL);
            listaNegra.buscarBloqueosVigentes(u.getId(), u.getAuthUser().getEmail(), u.getRegistro1().getCurp(), LocalDate.now());
        });
        assertThat(stats.getPrepareStatementCount()).isGreaterThan(2800);
        assertThat(stats.getEntityLoadCount()).isGreaterThan(1400);
        System.out.printf("LEGACY_1400: %d SQL statements, %d entities, %.1f ms%n",
                stats.getPrepareStatementCount(), stats.getEntityLoadCount(), (System.nanoTime() - start) / 1_000_000.0);
    }
}
