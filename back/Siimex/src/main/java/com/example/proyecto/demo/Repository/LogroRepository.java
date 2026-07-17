package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Logro;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogroRepository extends JpaRepository<Logro, Long> {
    @Query("SELECT l FROM Logro l WHERE l.usuario.id = :usuarioId")
    List<Logro> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
