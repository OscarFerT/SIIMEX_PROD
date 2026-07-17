package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.ListaNegra;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ListaNegraRepository extends JpaRepository<ListaNegra, Long> {

    @Query("SELECT l FROM ListaNegra l LEFT JOIN FETCH l.usuario u LEFT JOIN FETCH u.authUser WHERE l.activa = true ORDER BY l.fechaFin DESC, l.id DESC")
    List<ListaNegra> findActivas();

    @Query("SELECT l FROM ListaNegra l LEFT JOIN FETCH l.usuario u LEFT JOIN FETCH u.authUser ORDER BY l.id DESC")
    List<ListaNegra> findAllWithUsuario();

    @Query("SELECT l FROM ListaNegra l WHERE l.activa = true " +
            "AND (l.fechaInicio IS NULL OR l.fechaInicio <= :hoy) " +
            "AND (l.fechaFin IS NULL OR l.fechaFin >= :hoy) " +
            "AND (" +
            "(:usuarioId IS NOT NULL AND l.usuario IS NOT NULL AND l.usuario.id = :usuarioId) " +
            "OR (:email IS NOT NULL AND :email <> '' AND LOWER(COALESCE(l.email, '')) = LOWER(:email)) " +
            "OR (:curp IS NOT NULL AND :curp <> '' AND UPPER(COALESCE(l.curp, '')) = UPPER(:curp))" +
            ") " +
            "ORDER BY l.fechaFin DESC")
    List<ListaNegra> buscarBloqueosVigentes(
            @Param("usuarioId") Long usuarioId,
            @Param("email") String email,
            @Param("curp") String curp,
            @Param("hoy") LocalDate hoy
    );
}
