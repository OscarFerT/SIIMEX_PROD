package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.TrayectoriaAcademica;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrayectoriaAcademicaRepository extends JpaRepository<TrayectoriaAcademica, Long> {
    @Query("SELECT t FROM TrayectoriaAcademica t WHERE t.usuario.id = :usuarioId")
    List<TrayectoriaAcademica> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
