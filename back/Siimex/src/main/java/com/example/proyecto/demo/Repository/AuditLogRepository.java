package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findAllByOrderByFechaDesc(Pageable pageable);

    Page<AuditLog> findByCategoriaOrderByFechaDesc(AuditLog.Categoria categoria, Pageable pageable);

    Page<AuditLog> findByUsuarioEmailContainingIgnoreCaseOrderByFechaDesc(String email, Pageable pageable);

    Page<AuditLog> findByFechaBetweenOrderByFechaDesc(Instant desde, Instant hasta, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE " +
           "(:categoria IS NULL OR a.categoria = :categoria) AND " +
           "(:email IS NULL OR LOWER(a.usuarioEmail) LIKE LOWER(CONCAT('%', :email, '%'))) AND " +
           "(:accion IS NULL OR LOWER(a.accion) LIKE LOWER(CONCAT('%', :accion, '%'))) AND " +
           "(:desde IS NULL OR a.fecha >= :desde) AND " +
           "(:hasta IS NULL OR a.fecha <= :hasta) " +
           "ORDER BY a.fecha DESC")
    Page<AuditLog> buscarConFiltros(
            @Param("categoria") AuditLog.Categoria categoria,
            @Param("email") String email,
            @Param("accion") String accion,
            @Param("desde") Instant desde,
            @Param("hasta") Instant hasta,
            Pageable pageable);

    @Query("SELECT a.accion AS accion, COUNT(a) AS total FROM AuditLog a " +
           "WHERE a.fecha >= :desde GROUP BY a.accion ORDER BY total DESC")
    List<Object[]> contarPorAccionDesde(@Param("desde") Instant desde);

    @Query("SELECT a.categoria AS categoria, COUNT(a) AS total FROM AuditLog a " +
           "WHERE a.fecha >= :desde GROUP BY a.categoria ORDER BY total DESC")
    List<Object[]> contarPorCategoriaDesde(@Param("desde") Instant desde);

    long countByFechaAfter(Instant desde);

    List<AuditLog> findTop10ByOrderByFechaDesc();
}
