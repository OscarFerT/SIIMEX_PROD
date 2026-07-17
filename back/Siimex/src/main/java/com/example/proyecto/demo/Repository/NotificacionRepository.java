package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Notificacion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificacionRepository extends JpaRepository<Notificacion, Long> {

    @Query("SELECT n FROM Notificacion n WHERE n.authUser.id = :authUserId ORDER BY n.fechaCreacion DESC")
    List<Notificacion> findByAuthUserId(@Param("authUserId") Long authUserId);

    @Query("SELECT n FROM Notificacion n WHERE n.authUser.id = :authUserId ORDER BY n.fechaCreacion DESC")
    List<Notificacion> findByAuthUserId(@Param("authUserId") Long authUserId, Pageable pageable);

    @Query("SELECT COUNT(n) FROM Notificacion n WHERE n.authUser.id = :authUserId AND n.leida = false")
    long countNoLeidasByAuthUserId(@Param("authUserId") Long authUserId);

    /** Notificaciones admin: authUser es null (broadcast) o del admin específico */
    @Query("SELECT n FROM Notificacion n WHERE n.authUser IS NULL OR n.authUser.id = :authUserId ORDER BY n.fechaCreacion DESC")
    List<Notificacion> findAdminNotificaciones(@Param("authUserId") Long authUserId);

    @Query("SELECT n FROM Notificacion n WHERE n.authUser IS NULL OR n.authUser.id = :authUserId ORDER BY n.fechaCreacion DESC")
    List<Notificacion> findAdminNotificaciones(@Param("authUserId") Long authUserId, Pageable pageable);

    @Query("SELECT COUNT(n) FROM Notificacion n WHERE (n.authUser IS NULL OR n.authUser.id = :authUserId) AND n.leida = false")
    long countNoLeidasAdmin(@Param("authUserId") Long authUserId);

    @Modifying
    @Query("UPDATE Notificacion n SET n.leida = true WHERE n.authUser.id = :authUserId AND n.leida = false")
    int marcarTodasLeidasByAuthUserId(@Param("authUserId") Long authUserId);

    @Modifying
    @Query("UPDATE Notificacion n SET n.leida = true WHERE (n.authUser IS NULL OR n.authUser.id = :authUserId) AND n.leida = false")
    int marcarTodasLeidasAdmin(@Param("authUserId") Long authUserId);
}
