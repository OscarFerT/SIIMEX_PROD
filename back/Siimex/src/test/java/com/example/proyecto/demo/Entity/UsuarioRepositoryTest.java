package com.example.proyecto.demo.Entity;

import com.example.proyecto.demo.Repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
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
