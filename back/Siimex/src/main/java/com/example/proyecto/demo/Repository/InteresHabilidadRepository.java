package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.InteresHabilidad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InteresHabilidadRepository extends JpaRepository<InteresHabilidad, Long> {
    @Query("SELECT i FROM InteresHabilidad i WHERE i.usuario.id = :usuarioId")
    Optional<InteresHabilidad> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
