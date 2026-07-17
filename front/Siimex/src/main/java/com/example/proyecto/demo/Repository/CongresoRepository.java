package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Congreso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CongresoRepository extends JpaRepository<Congreso, Long> {
    @Query("SELECT c FROM Congreso c WHERE c.usuario.id = :usuarioId")
    List<Congreso> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
