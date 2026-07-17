package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.TrayectoriaProfesional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrayectoriaProfesionalRepository extends JpaRepository<TrayectoriaProfesional, Long> {
    @Query("SELECT t FROM TrayectoriaProfesional t WHERE t.usuario.id = :usuarioId")
    List<TrayectoriaProfesional> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
