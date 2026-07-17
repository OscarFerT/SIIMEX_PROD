package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface Registro1Repository extends JpaRepository<Registro1, Long> {

    Optional<Registro1> findByUsuario(Usuario usuario);

    boolean existsByCurp(String curp);

    boolean existsByRfc(String rfc);

    Optional<Registro1> findByCurp(String curp);

    Optional<Registro1> findByRfc(String rfc);
}
