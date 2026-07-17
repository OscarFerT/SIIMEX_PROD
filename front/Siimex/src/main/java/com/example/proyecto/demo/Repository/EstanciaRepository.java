package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Estancia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EstanciaRepository extends JpaRepository<Estancia, Long> {
    @Query("SELECT e FROM Estancia e WHERE e.usuario.id = :usuarioId")
    List<Estancia> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
