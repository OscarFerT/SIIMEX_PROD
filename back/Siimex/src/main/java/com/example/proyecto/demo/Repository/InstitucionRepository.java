package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Institucion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InstitucionRepository extends JpaRepository<Institucion, Long> {
    @Query("SELECT i FROM Institucion i WHERE i.usuario.id = :usuarioId")
    List<Institucion> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
