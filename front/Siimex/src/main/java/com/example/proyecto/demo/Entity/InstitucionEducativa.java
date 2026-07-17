package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "instituciones_educativas", indexes = {
        @Index(name = "idx_inst_edu_cct", columnList = "cct", unique = true),
        @Index(name = "idx_inst_edu_estado", columnList = "estado")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitucionEducativa {

    public enum EstadoInstitucion {
        PENDIENTE_VALIDACION,
        ACTIVA,
        RECHAZADA
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 25, unique = true)
    private String cct;

    @Column(nullable = false, length = 220)
    private String nombre;

    @Column(length = 250)
    private String domicilio;

    @Column(length = 180)
    private String colonia;

    @Column(length = 10)
    private String codigoPostal;

    @Column(length = 120)
    private String municipio;

    @Column(length = 120)
    private String entidadFederativa;

    @Column(length = 30)
    private String telefono;

    @Column(length = 180)
    private String director;

    @Column(length = 180)
    private String correo;

    @Column(length = 120)
    private String nivelEducativo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private EstadoInstitucion estado = EstadoInstitucion.PENDIENTE_VALIDACION;

    @Column(name = "solicitud_usuario_id")
    private Long solicitudUsuarioId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
