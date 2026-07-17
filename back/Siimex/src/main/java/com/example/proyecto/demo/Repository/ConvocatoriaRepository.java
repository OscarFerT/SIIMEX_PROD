package com.example.proyecto.demo.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.proyecto.demo.Entity.Convocatoria;

public interface ConvocatoriaRepository extends JpaRepository<Convocatoria, Long> {

    List<Convocatoria> findByVigenteOrderByFechaCierreAsc(boolean vigente);
    List<Convocatoria> findByVigenteTrueAndVisibilidadPublicaTrueOrderByFechaCierreAsc();
    boolean existsByFolioConvocatoriaIgnoreCase(String folioConvocatoria);
}
