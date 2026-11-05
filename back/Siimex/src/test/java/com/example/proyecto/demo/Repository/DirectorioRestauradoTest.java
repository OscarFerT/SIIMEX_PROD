package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.security.PublicProfilePolicy;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(showSql = false, properties = {
        "spring.datasource.url=jdbc:h2:mem:directorio-restaurado;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "logging.level.org.springframework.jdbc.core.JdbcTemplate=OFF"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DirectorioRestauradoTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired UsuarioRepository usuarios;
    @Autowired EntityManager em;
    private final List<Registro1.TipoPerfil> investigadores = List.of(Registro1.TipoPerfil.INVESTIGADOR, Registro1.TipoPerfil.HIBRIDO);

    @BeforeAll void preparar1406PerfilesYExclusiones() {
        for (int id = 1; id <= 1409; id++) {
            String email = "directorio" + id + "@example.test";
            jdbc.update("INSERT INTO auth_users (id, username, email, password_hash, enabled, locked) VALUES (?, ?, ?, 'synthetic-only', ?, ?)",
                    id, email, email, id != 1409, id == 1408);
            jdbc.update("INSERT INTO auth_user_roles (auth_user_id, role) VALUES (?, ?)", id, id == 1407 ? "ROLE_ADMIN" : "ROLE_USER");
            Boolean consentimiento = id <= 306 || id > 1406 ? Boolean.TRUE : id <= 856 ? Boolean.FALSE : null;
            jdbc.update("INSERT INTO usuarios (id, auth_user_id, nombre, apellido_paterno, consentimiento_directorio_publico, visibilidad_perfil) VALUES (?, ?, ?, 'Prueba', ?, 'ESTANDAR')",
                    id, id, "Persona " + id, consentimiento);
            jdbc.update("INSERT INTO registro1 (id, curp, fecha_nacimiento, genero, tipo_perfil) VALUES (?, ?, ?, 'FEMENINO', ?)",
                    id, String.format("TEST%014d", id), Date.valueOf("1990-01-01"), id == 1406 ? "HIBRIDO" : "INVESTIGADOR");
            jdbc.update("INSERT INTO trayectorias_academicas (usuario_id, nivel_nombre) VALUES (?, ?)", id, id % 2 == 0 ? "Maestria" : "Doctorado");
            jdbc.update("INSERT INTO areas_conocimiento (usuario_id, area_nombre) VALUES (?, ?)", id, id == 1405 ? "Area remota" : "Area general");
        }
    }

    @Test void recupera1406SinOtorgarConsentimientoYExcluyeAdminBloqueadoSuspendido() {
        var primera = usuarios.findDirectorioPage(investigadores, null, null, null, null, PageRequest.of(0, 8, Sort.by("id")));
        assertThat(primera.getTotalElements()).isEqualTo(1406);
        assertThat(primera.getTotalPages()).isEqualTo(176);
        assertThat(primera.getContent()).hasSize(8).allMatch(PublicProfilePolicy::canPublish);
        assertThat(usuarios.countDirectorioByTipos(investigadores)).isEqualTo(1406);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuarios WHERE id <= 1406 AND consentimiento_directorio_publico = true", Long.class)).isEqualTo(306);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuarios WHERE consentimiento_directorio_publico = false", Long.class)).isEqualTo(550);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuarios WHERE consentimiento_directorio_publico IS NULL", Long.class)).isEqualTo(550);
        assertThat(usuarios.countDirectorioByTipos(List.of(Registro1.TipoPerfil.INNOVADOR, Registro1.TipoPerfil.HIBRIDO))).isEqualTo(1);
        System.out.println("DIRECTORIO_RESTAURADO: 1406 fichas, 306 con consentimiento y 1100 sin consentimiento, 176 paginas");
    }

    @Test void mantienePaginasLlenasYOrdenadasTambienFueraDeLos306Iniciales() {
        var segunda = usuarios.findDirectorioPage(investigadores, null, null, null, null, PageRequest.of(1, 8, Sort.by("id")));
        var remota = usuarios.findDirectorioPage(investigadores, null, null, null, null, PageRequest.of(100, 8, Sort.by("id")));
        var ultima = usuarios.findDirectorioPage(investigadores, null, null, null, null, PageRequest.of(175, 8, Sort.by("id")));
        assertThat(segunda.getContent()).extracting(u -> u.getId()).containsExactly(9L, 10L, 11L, 12L, 13L, 14L, 15L, 16L);
        assertThat(remota.getContent()).hasSize(8).allMatch(u -> u.getId() >= 801 && u.getId() <= 808);
        assertThat(ultima.getContent()).extracting(u -> u.getId()).containsExactly(1401L, 1402L, 1403L, 1404L, 1405L, 1406L);
        assertThat(ultima.isLast()).isTrue();
    }

    @Test void filtraGradoYAreaAntesDePaginarEnTodosLosPerfiles() {
        var grados = usuarios.findDirectorioPage(investigadores, null, "Doctorado", null, null, PageRequest.of(0, 8));
        var combinado = usuarios.findDirectorioPage(investigadores, null, "Doctorado", "Area remota", null, PageRequest.of(0, 8));
        assertThat(grados.getTotalElements()).isEqualTo(703);
        assertThat(grados.getContent()).hasSize(8);
        assertThat(combinado.getTotalElements()).isEqualTo(1);
        assertThat(combinado.getContent()).singleElement().satisfies(u -> assertThat(u.getId()).isEqualTo(1405));
        assertThat(usuarios.findDirectorioGradosByTipos(investigadores)).containsExactly("Doctorado", "Maestria");
        assertThat(usuarios.findDirectorioAreasByTipos(investigadores)).containsExactly("Area general", "Area remota");
    }

    @Test void palabrasClaveRespetanVisibilidadIndependientementeDelConsentimiento() {
        jdbc.update("UPDATE usuarios SET semblanza='DatoReservadoPrueba', visibilidad_perfil='MINIMA' WHERE id=1405");
        em.clear();
        assertThat(usuarios.findDirectorioPage(investigadores, null, null, null, "DatoReservadoPrueba", PageRequest.of(0,8)).getTotalElements()).isZero();
        jdbc.update("UPDATE usuarios SET visibilidad_perfil='COMPLETA' WHERE id=1405");
        em.clear();
        assertThat(usuarios.findDirectorioPage(investigadores, null, null, null, "DatoReservadoPrueba", PageRequest.of(0,8)).getTotalElements()).isEqualTo(1);
    }
}
