package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.InstitucionEducativa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InstitucionEducativaRepository extends JpaRepository<InstitucionEducativa, Long> {
    boolean existsByCctIgnoreCase(String cct);
    Optional<InstitucionEducativa> findByCctIgnoreCase(String cct);
    List<InstitucionEducativa> findByEstadoOrderByNombreAsc(InstitucionEducativa.EstadoInstitucion estado);

    @Query("SELECT i FROM InstitucionEducativa i WHERE " +
            "(:q IS NULL OR :q = '' OR LOWER(i.nombre) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(COALESCE(i.municipio, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(COALESCE(i.entidadFederativa, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(COALESCE(i.cct, '')) LIKE LOWER(CONCAT('%', :q, '%'))) " +
            "ORDER BY i.nombre ASC")
    List<InstitucionEducativa> buscar(@Param("q") String q);
}
