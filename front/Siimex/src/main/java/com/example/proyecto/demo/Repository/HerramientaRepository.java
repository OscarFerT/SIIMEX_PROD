package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Herramienta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HerramientaRepository extends JpaRepository<Herramienta, Long> {
    @Query("SELECT h FROM Herramienta h WHERE h.usuario.id = :usuarioId ORDER BY h.nombre")
    List<Herramienta> findByUsuarioId(@Param("usuarioId") Long usuarioId);
    
    @Query("SELECT h FROM Herramienta h WHERE h.usuario.id = :usuarioId AND h.nombre = :nombre")
    java.util.Optional<Herramienta> findByUsuarioIdAndNombre(@Param("usuarioId") Long usuarioId, @Param("nombre") String nombre);
}
