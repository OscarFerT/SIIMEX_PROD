package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Repository.*;
import com.example.proyecto.demo.dto.RegisterRequest;
import com.example.proyecto.demo.dto.Registro1Request;
import com.example.proyecto.demo.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import javax.crypto.SecretKey;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceCurpTest {
    @Mock AuthUserRepository authUserRepo;
    @Mock EmailVerificationTokenRepository emailVerificationTokenRepo;
    @Mock UsuarioRepository usuarioRepo;
    @Mock Registro1Repository registro1Repo;
    @Mock PasswordEncoder encoder;
    @Mock SecretKey key;
    @Mock VerificationCodeService verificationCodeService;
    @Mock MicrosoftGraphEmailService microsoftGraphEmailService;
    @Mock NotificacionService notificacionService;
    @Mock ConfiguracionSistemaService configuracionSistemaService;
    @Mock AuthAttemptService authAttemptService;
    @InjectMocks AuthService service;

    @BeforeEach void setup() { ReflectionTestUtils.setField(service, "frontendUrl", "https://siimex.example.test"); }

    private RegisterRequest request(String paterno, String materno, String prefix, LocalDate fecha) {
        return new RegisterRequest("prueba.curp@example.test", "ClavePrueba123", "7221000000",
                new Registro1Request("Ana Cecilia", paterno, materno, prefix + "900101MMCRSN00", prefix + "900101ABC",
                        fecha, Registro1Request.Genero.FEMENINO, "MEXICANA", "MEXICO", "MEXICO", "Toluca",
                        Registro1Request.EstadoCivil.SOLTERO, Registro1Request.TipoPerfil.INVESTIGADOR));
    }

    @ParameterizedTest
    @CsvSource({"Franco,De la Rosa,FARA", "Del Rio,De la Rosa,RIRA", "De la Cruz,De los Santos,CUSA", "Lopez,Garcia,LOGA"})
    void registroCompletoMantieneApellidosRolesFolioYVerificacion(String paterno, String materno, String prefix) {
        when(encoder.encode(anyString())).thenReturn("HASH_SOLO_PRUEBAS");
        when(configuracionSistemaService.resolverPrefijoRegistro(Registro1.TipoPerfil.INVESTIGADOR)).thenReturn("SIIMEX-INV");
        when(authUserRepo.save(any(AuthUser.class))).thenAnswer(inv -> {
            AuthUser saved = inv.getArgument(0);
            saved.setId(10L);
            saved.getUsuario().setId(1L);
            return saved;
        });
        var response = service.register(request(paterno, materno, prefix, LocalDate.of(1990, 1, 1)));
        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getFolioRegistro()).isEqualTo("SIIMEX-INV-001");
        ArgumentCaptor<AuthUser> capture = ArgumentCaptor.forClass(AuthUser.class);
        verify(authUserRepo).save(capture.capture());
        AuthUser saved = capture.getValue();
        assertThat(saved.getUsuario().getApellidoPaterno()).isEqualTo(paterno);
        assertThat(saved.getUsuario().getApellidoMaterno()).isEqualTo(materno);
        assertThat(saved.getUsuario().getRegistro1().getCurp()).isEqualTo(prefix + "900101MMCRSN00");
        assertThat(saved.getRoles()).containsExactly("ROLE_USER");
        assertThat(saved.isEnabled()).isFalse();
        verify(emailVerificationTokenRepo).save(any());
        verify(microsoftGraphEmailService).sendRegistrationVerificationEmail(eq("prueba.curp@example.test"),
                contains("/verificar-email?token="), eq("Ana Cecilia"), eq("SIIMEX-INV-001"));
    }

    @Test void fechaIncorrectaNoGuardaCuentaNiEnviaCorreo() {
        assertThatThrownBy(() -> service.register(request("Franco", "De la Rosa", "FARA", LocalDate.of(1990, 1, 2))))
                .isInstanceOf(ApiException.class).hasMessageContaining("fecha de nacimiento");
        verify(authUserRepo, never()).save(any());
        verifyNoInteractions(encoder, microsoftGraphEmailService, emailVerificationTokenRepo);
    }

    @Test void apellidoQueNoCoincideSigueBloqueadoSinPedirQueSeAbrevie() {
        assertThatThrownBy(() -> service.register(request("Franco", "De la Rosa", "FADA", LocalDate.of(1990, 1, 1))))
                .isInstanceOf(ApiException.class).hasMessageContaining("apellido completo");
        verify(authUserRepo, never()).save(any());
        verifyNoInteractions(microsoftGraphEmailService);
    }

    @Test void curpDuplicadaSigueRechazada() {
        when(registro1Repo.existsByCurp("FARA900101MMCRSN00")).thenReturn(true);
        assertThatThrownBy(() -> service.register(request("Franco", "De la Rosa", "FARA", LocalDate.of(1990, 1, 1))))
                .isInstanceOf(ApiException.class).hasMessageContaining("CURP ya registrada");
        verify(authUserRepo, never()).save(any());
        verifyNoInteractions(microsoftGraphEmailService);
    }
}
