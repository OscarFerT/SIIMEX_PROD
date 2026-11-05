package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.*;
import com.example.proyecto.demo.Repository.*;
import com.example.proyecto.demo.dto.AdminDatosBasicos.*;
import com.example.proyecto.demo.exception.ApiException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest(showSql = false)
@Import(AdminDatosBasicosService.class)
class AdminDatosBasicosServiceTest {
    @Autowired AdminDatosBasicosService service;
    @Autowired AuthUserRepository cuentas;
    @Autowired UsuarioRepository usuarios;
    @Autowired Registro1Repository registros;
    @Autowired AuditLogRepository auditoria;
    @Autowired EmailVerificationTokenRepository tokens;
    @Autowired EntityManager em;
    AuthUser admin;
    Usuario usuario;

    @BeforeEach
    void seed() {
        admin = cuenta("admin@example.test", "ROLE_ADMIN");
        AuthUser cuenta = cuenta("persona@example.test", "ROLE_USER");
        cuenta.setRememberTokenHash("old-device");
        cuenta.setRememberTokenExpiry(Instant.now().plusSeconds(600));
        usuario = usuarios.saveAndFlush(Usuario.builder().authUser(cuenta).nombre("Ana Cecilia")
                .apellidoPaterno("Franco").apellidoMaterno("De la Rosa").visibilidadPerfil("MINIMA")
                .consentimientoDirectorioPublico(false).registro2Completo(true).build());
        Registro1 registro = Registro1.builder().usuario(usuario).curp("FARA900101MMCRSN00")
                .fechaNacimiento(LocalDate.of(1990, 1, 1)).genero(Registro1.Genero.FEMENINO)
                .entidadFederativa("Estado de Mexico").tipoPerfil(Registro1.TipoPerfil.INVESTIGADOR)
                .rfc("FARA900101").telefono("7221000001").build();
        registros.saveAndFlush(registro);
        usuario.setRegistro1(registro);
        em.flush();
    }

    private AuthUser cuenta(String email, String rol) {
        return cuentas.saveAndFlush(AuthUser.builder().username(email).email(email).passwordHash("synthetic-not-a-password")
                .enabled(true).locked(false).roles(new HashSet<>(Set.of(rol))).build());
    }
    private Cambio cambio(String email, String curp, String telefono, String revision) {
        Datos d = service.consultar(usuario.getId());
        return new Cambio(d.nombre(), d.apellidoPaterno(), d.apellidoMaterno(), email, curp, telefono,
                d.fechaNacimiento(), d.genero(), d.entidadFederativa(), revision, "Correccion cotejada");
    }
    private Datos datos() { return service.consultar(usuario.getId()); }
    private Datos guardar(Cambio c) { return service.actualizar(usuario.getId(), c, admin.getId(), "127.0.0.1"); }
    private void falla(Cambio c, HttpStatus status) {
        assertThatThrownBy(() -> guardar(c)).isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(status));
    }

    @Test void consultaSoloIncluyeLosDatosEditablesYRevision() {
        assertThat(datos().revision()).matches("[a-f0-9]{64}");
        assertThat(datos().apellidoMaterno()).isEqualTo("De la Rosa");
    }

    @Test void cambiaCorreoYUsuarioDeAccesoRevocandoSesionesYTokensSinCambiarPermisos() {
        AuthUser cuenta = usuario.getAuthUser();
        tokens.saveAndFlush(EmailVerificationToken.builder().authUser(cuenta).token("old-mail-link")
                .createdAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600)).build());
        Datos d = datos();
        Datos resultado = guardar(cambio("  CORREGIDO@example.test  ", d.curp(), d.telefono(), d.revision()));
        em.clear();
        AuthUser actual = cuentas.findById(cuenta.getId()).orElseThrow();
        assertThat(resultado.email()).isEqualTo("corregido@example.test");
        assertThat(actual.getEmail()).isEqualTo("corregido@example.test");
        assertThat(actual.getUsername()).isEqualTo(actual.getEmail());
        assertThat(actual.getSessionVersion()).isEqualTo(1);
        assertThat(actual.getRememberTokenHash()).isNull();
        assertThat(actual.getRememberTokenExpiry()).isNull();
        assertThat(actual.getRoles()).containsExactly("ROLE_USER");
        assertThat(actual.getPasswordHash()).isEqualTo("synthetic-not-a-password");
        assertThat(tokens.findByToken("old-mail-link")).isEmpty();
        Usuario perfil = usuarios.findById(usuario.getId()).orElseThrow();
        assertThat(perfil.getConsentimientoDirectorioPublico()).isFalse();
        assertThat(perfil.getVisibilidadPerfil()).isEqualTo("MINIMA");
        assertThat(perfil.getRegistro1().getRfc()).isEqualTo("FARA900101");
        assertThat(perfil.getRegistro1().getTipoPerfil()).isEqualTo(Registro1.TipoPerfil.INVESTIGADOR);
        assertThat(auditoria.findAll()).singleElement().satisfies(a -> {
            assertThat(a.getAccion()).isEqualTo("EDITAR_DATOS_BASICOS");
            assertThat(a.getUsuarioId()).isEqualTo(admin.getId());
            assertThat(a.getDetalle()).contains("email", "Correccion cotejada").doesNotContain(d.curp());
        });
    }

    @Test void correccionDeCurpAdmiteApellidosCompuestosYConservaId() {
        Datos d = datos();
        Datos result = guardar(cambio(d.email(), "fara900101mmcrsn01", d.telefono(), d.revision()));
        assertThat(result.curp()).isEqualTo("FARA900101MMCRSN01");
        assertThat(result.id()).isEqualTo(usuario.getId());
        assertThat(usuario.getAuthUser().getSessionVersion()).isEqualTo(1);
    }

    @Test void contactoNoExigeCorregirUnaCurpHistoricaInconsistente() {
        usuario.getRegistro1().setCurp("DEMO900101MMCXXX01"); em.flush();
        Datos d = datos();
        assertThat(guardar(cambio("nuevo@example.test", d.curp(), d.telefono(), d.revision())).email()).isEqualTo("nuevo@example.test");
    }

    @Test void rechazaCurpQueNoCoincideConLaPersona() {
        Datos d = datos(); falla(cambio(d.email(), "FADA900101MMCRSN00", d.telefono(), d.revision()), HttpStatus.BAD_REQUEST);
        assertThat(usuario.getRegistro1().getCurp()).isEqualTo(d.curp());
        assertThat(auditoria.count()).isZero();
    }

    @Test void rechazaCurpConEntidadInexistente() {
        Datos d = datos(); falla(cambio(d.email(), "FARA900101MZZRSN00", d.telefono(), d.revision()), HttpStatus.BAD_REQUEST);
    }

    @Test void rechazaCorreoDuplicadoSinCambiarNada() {
        cuenta("ocupado@example.test", "ROLE_USER");
        Datos d = datos(); falla(cambio("OCUPADO@example.test", d.curp(), d.telefono(), d.revision()), HttpStatus.CONFLICT);
        assertThat(usuario.getAuthUser().getEmail()).isEqualTo(d.email());
        assertThat(auditoria.count()).isZero();
    }

    @Test void rechazaColisionConUnUsernameDiferenteAlCorreo() {
        AuthUser otra = cuenta("otra@example.test", "ROLE_USER"); otra.setUsername("ocupado@example.test"); em.flush();
        Datos d = datos(); falla(cambio("ocupado@example.test", d.curp(), d.telefono(), d.revision()), HttpStatus.CONFLICT);
    }

    @Test void rechazaCurpDuplicada() {
        Usuario otro = usuarios.saveAndFlush(Usuario.builder().nombre("Otra").build());
        registros.saveAndFlush(Registro1.builder().usuario(otro).curp("FARA900101MMCRSN01")
                .fechaNacimiento(LocalDate.of(1990,1,1)).genero(Registro1.Genero.FEMENINO).build());
        Datos d = datos(); falla(cambio(d.email(), "FARA900101MMCRSN01", d.telefono(), d.revision()), HttpStatus.CONFLICT);
    }

    @Test void evitaSobrescribirCorreccionesDeOtroAdministrador() {
        Datos d = datos(); guardar(cambio(d.email(), d.curp(), "7221000002", d.revision()));
        falla(cambio("otro@example.test", d.curp(), "7221000003", d.revision()), HttpStatus.PRECONDITION_FAILED);
        assertThat(datos().telefono()).isEqualTo("7221000002");
    }

    @Test void noRevocaSesionesPorUnCambioSoloDeTelefono() {
        Datos d = datos(); guardar(cambio(d.email(), d.curp(), "7221000002", d.revision()));
        assertThat(usuario.getAuthUser().getSessionVersion()).isZero();
    }

    @Test void noModificaEstadosDeUnaCuentaSuspendida() {
        usuario.getAuthUser().setEnabled(false); usuario.getAuthUser().setLocked(true); em.flush();
        Datos d = datos(); guardar(cambio("nuevo@example.test", d.curp(), d.telefono(), d.revision()));
        assertThat(usuario.getAuthUser().isEnabled()).isFalse(); assertThat(usuario.getAuthUser().isLocked()).isTrue();
    }

    @Test void conservaUnUsernamePersonalizado() {
        usuario.getAuthUser().setUsername("usuario-personalizado"); em.flush();
        Datos d = datos(); guardar(cambio("nuevo@example.test", d.curp(), d.telefono(), d.revision()));
        assertThat(usuario.getAuthUser().getUsername()).isEqualTo("usuario-personalizado");
    }

    @Test void noGuardaSiElCorreoExcedeLaColumnaDelUsuarioDeAcceso() {
        Datos d = datos(); falla(cambio("a".repeat(60) + "@longdomain.example.test", d.curp(), d.telefono(), d.revision()), HttpStatus.BAD_REQUEST);
    }

    @Test void unUsuarioGeneralNoPuedeInvocarLaCorreccion() {
        Datos d = datos(); Cambio c = cambio("nuevo@example.test", d.curp(), d.telefono(), d.revision());
        assertThatThrownBy(() -> service.actualizar(usuario.getId(), c, usuario.getAuthUser().getId(), "127.0.0.1"))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test void unAdminBloqueadoNoPuedeCorregir() {
        admin.setLocked(true); em.flush(); Datos d = datos();
        falla(cambio("nuevo@example.test", d.curp(), d.telefono(), d.revision()), HttpStatus.FORBIDDEN);
    }

    @Test void noHaceCambiosNiAuditaUnEnvioIdentico() {
        Datos d = datos(); assertThat(guardar(cambio(d.email(), d.curp(), d.telefono(), d.revision()))).isEqualTo(d);
        assertThat(auditoria.count()).isZero(); assertThat(usuario.getAuthUser().getSessionVersion()).isZero();
    }

    @Test void usuarioInexistenteDevuelve404() {
        assertThatThrownBy(() -> service.consultar(Long.MAX_VALUE)).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
