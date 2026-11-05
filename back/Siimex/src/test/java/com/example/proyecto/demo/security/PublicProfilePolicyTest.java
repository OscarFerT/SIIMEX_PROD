package com.example.proyecto.demo.security;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Entity.Usuario;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PublicProfilePolicyTest {
    private Usuario perfil(Boolean consentimiento) {
        Usuario usuario = Usuario.builder().consentimientoDirectorioPublico(consentimiento).build();
        usuario.setAuthUser(AuthUser.builder().enabled(true).locked(false).roles(new HashSet<>(Set.of("ROLE_USER"))).build());
        usuario.setRegistro1(Registro1.builder().tipoPerfil(Registro1.TipoPerfil.INVESTIGADOR).build());
        return usuario;
    }

    @ParameterizedTest @NullSource @ValueSource(booleans = {true, false})
    void sePublicaConOSinConsentimientoRespetandoElNivel(Boolean consentimiento) {
        Usuario u = perfil(consentimiento);
        assertThat(PublicProfilePolicy.canPublish(u)).isTrue();
        for (String nivel : List.of("MINIMA", "ESTANDAR", "COMPLETA")) {
            u.setVisibilidadPerfil(nivel);
            assertThat(PublicProfilePolicy.visibility(u)).isEqualTo(nivel);
        }
        u.setVisibilidadPerfil(null);
        assertThat(PublicProfilePolicy.visibility(u)).isEqualTo("MINIMA");
        u.setVisibilidadPerfil("no-reconocida");
        assertThat(PublicProfilePolicy.visibility(u)).isEqualTo("MINIMA");
    }

    @Test void noPublicaAdministradoresNiCuentasSuspendidasBloqueadasOIncompletas() {
        Usuario u = perfil(false);
        u.getAuthUser().setEnabled(false); assertThat(PublicProfilePolicy.canPublish(u)).isFalse();
        u.getAuthUser().setEnabled(true); u.getAuthUser().setLocked(true); assertThat(PublicProfilePolicy.canPublish(u)).isFalse();
        u.getAuthUser().setLocked(false); u.getAuthUser().getRoles().add("ROLE_ADMIN"); assertThat(PublicProfilePolicy.canPublish(u)).isFalse();
        u.getAuthUser().getRoles().remove("ROLE_ADMIN"); u.getRegistro1().setTipoPerfil(null); assertThat(PublicProfilePolicy.canPublish(u)).isFalse();
        u.setRegistro1(null); assertThat(PublicProfilePolicy.canPublish(u)).isFalse();
        u.setAuthUser(null); assertThat(PublicProfilePolicy.canPublish(u)).isFalse();
        assertThat(PublicProfilePolicy.canPublish(null)).isFalse();
    }
}
