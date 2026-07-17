package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Idioma;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IdiomaRepository extends JpaRepository<Idioma, Long> {
    @Query("SELECT i FROM Idioma i WHERE i.usuario.id = :usuarioId")
    List<Idioma> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
