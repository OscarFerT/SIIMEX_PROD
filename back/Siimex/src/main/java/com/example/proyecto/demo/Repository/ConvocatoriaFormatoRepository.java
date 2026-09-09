package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.ConvocatoriaFormato;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConvocatoriaFormatoRepository extends JpaRepository<ConvocatoriaFormato, Long> {
    List<ConvocatoriaFormato> findByConvocatoriaIdOrderByFechaSubidaAsc(Long convocatoriaId);
    List<ConvocatoriaFormato> findByConvocatoriaIdAndUsoIgnoreCaseOrderByFechaSubidaAsc(Long convocatoriaId, String uso);
    Optional<ConvocatoriaFormato> findFirstByConvocatoriaIdAndUsoIgnoreCaseOrderByFechaSubidaDesc(Long convocatoriaId, String uso);
    Optional<ConvocatoriaFormato> findByIdAndConvocatoriaId(Long id, Long convocatoriaId);
    void deleteByConvocatoriaId(Long convocatoriaId);
}

