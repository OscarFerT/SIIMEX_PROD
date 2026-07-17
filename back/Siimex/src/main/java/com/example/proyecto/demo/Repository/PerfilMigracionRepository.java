package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.PerfilMigracion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PerfilMigracionRepository extends JpaRepository<PerfilMigracion, Long> {
    Optional<PerfilMigracion> findByMigracionId(String migracionId);
    
    @Query("SELECT p FROM PerfilMigracion p WHERE p.usuario.id = :usuarioId")
    Optional<PerfilMigracion> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
