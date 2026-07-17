package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Feriado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface FeriadoRepository extends JpaRepository<Feriado, Long> {
    boolean existsByFecha(LocalDate fecha);
    List<Feriado> findByActivoTrueOrderByFechaAsc();
    long countByActivoTrueAndFechaBetween(LocalDate from, LocalDate to);
}
