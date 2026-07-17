package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "lista_negra", indexes = {
        @Index(name = "idx_lista_negra_activa", columnList = "activa"),
        @Index(name = "idx_lista_negra_usuario", columnList = "usuario_id"),
        @Index(name = "idx_lista_negra_fecha_fin", columnList = "fecha_fin")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ListaNegra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(length = 180)
    private String email;

    @Column(length = 18)
    private String curp;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String motivo;

    @Column(name = "tipo_sancion", nullable = false, length = 24)
    @Builder.Default
    private String tipoSancion = "ANIO";

    @Column(name = "nombre_programa", length = 220)
    private String nombrePrograma;

    @Column(name = "folio_referencia", length = 120)
    private String folioReferencia;

    @Column(name = "nombre_referencia", length = 220)
    private String nombreReferencia;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Column(nullable = false)
    @Builder.Default
    private boolean activa = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "levantada_por_usuario_id")
    private Long levantadaPorUsuarioId;

    @Column(name = "fecha_levantamiento")
    private LocalDateTime fechaLevantamiento;

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
