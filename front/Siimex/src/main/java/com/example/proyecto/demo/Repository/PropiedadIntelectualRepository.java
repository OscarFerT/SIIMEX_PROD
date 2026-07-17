package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.PropiedadIntelectual;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PropiedadIntelectualRepository extends JpaRepository<PropiedadIntelectual, Long> {
    @Query("SELECT p FROM PropiedadIntelectual p WHERE p.usuario.id = :usuarioId")
    List<PropiedadIntelectual> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
