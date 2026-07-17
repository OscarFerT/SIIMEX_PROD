package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.IncidenciaSocial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidenciaSocialRepository extends JpaRepository<IncidenciaSocial, Long> {

    @Query("SELECT i FROM IncidenciaSocial i WHERE i.usuario.id = :usuarioId ORDER BY i.id DESC")
    List<IncidenciaSocial> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
