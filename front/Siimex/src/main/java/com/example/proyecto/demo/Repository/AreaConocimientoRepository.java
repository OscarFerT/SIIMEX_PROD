package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.AreaConocimiento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AreaConocimientoRepository extends JpaRepository<AreaConocimiento, Long> {
    @Query("SELECT a FROM AreaConocimiento a WHERE a.usuario.id = :usuarioId")
    List<AreaConocimiento> findByUsuarioId(@Param("usuarioId") Long usuarioId);

    @Query("SELECT a FROM AreaConocimiento a WHERE a.usuario.id IN :usuarioIds")
    List<AreaConocimiento> findByUsuarioIdIn(@Param("usuarioIds") List<Long> usuarioIds);
}
