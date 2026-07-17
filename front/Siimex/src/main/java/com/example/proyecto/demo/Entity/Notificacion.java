package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "notificaciones", indexes = {
        @Index(name = "idx_notif_auth_user", columnList = "auth_user_id"),
        @Index(name = "idx_notif_auth_user_fecha", columnList = "auth_user_id,fecha_creacion"),
        @Index(name = "idx_notif_leida", columnList = "leida"),
        @Index(name = "idx_notif_tipo", columnList = "tipo"),
        @Index(name = "idx_notif_fecha", columnList = "fecha_creacion")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Destinatario (null = broadcast admin) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auth_user_id")
    private AuthUser authUser;

    @Column(nullable = false, length = 200)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String mensaje;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TipoNotificacion tipo;

    @Column(nullable = false)
    @Builder.Default
    private boolean leida = false;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    /** Ruta opcional para redirigir al hacer clic */
    @Column(name = "ruta_link", length = 300)
    private String rutaLink;

    @PrePersist
    protected void onCreate() {
        if (fechaCreacion == null) {
            fechaCreacion = LocalDateTime.now();
        }
    }

    public enum TipoNotificacion {
        POSTULACION_ACEPTADA,
        POSTULACION_RECHAZADA,
        NUEVA_CONVOCATORIA,
        NUEVA_POSTULACION,
        NUEVO_REGISTRO,
        SISTEMA
    }
}
