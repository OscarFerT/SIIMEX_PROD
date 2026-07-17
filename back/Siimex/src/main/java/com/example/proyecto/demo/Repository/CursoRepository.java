package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Curso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CursoRepository extends JpaRepository<Curso, Long> {
    @Query("SELECT c FROM Curso c WHERE c.usuario.id = :usuarioId")
    List<Curso> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
