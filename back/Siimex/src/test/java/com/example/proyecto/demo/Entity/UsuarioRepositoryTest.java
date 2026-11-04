package com.example.proyecto.demo.Entity;

import com.example.proyecto.demo.Repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.example.proyecto.demo.config.CatalogSeedRunner;
import com.example.proyecto.demo.config.InstitucionEducativaSeedRunner;
import com.example.proyecto.demo.config.ConvocatoriaDateTimeSchemaFixer;
import com.example.proyecto.demo.Service.MicrosoftGraphEmailService;
import com.example.proyecto.demo.Service.MicrosoftGraphTokenService;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@Transactional
@MockitoBean(types = {CatalogSeedRunner.class, InstitucionEducativaSeedRunner.class,
        ConvocatoriaDateTimeSchemaFixer.class, MicrosoftGraphEmailService.class, MicrosoftGraphTokenService.class})
class UsuarioRepositoryTest {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    void testCrearUsuario() {
        Usuario usuario = Usuario.builder()
                .nombre("Carlos")
                .apellidoPaterno("Ramírez")
                .apellidoMaterno("Piña")
                .build();

        Usuario guardado = usuarioRepository.save(usuario);
        assertNotNull(guardado.getId());
    }
}
