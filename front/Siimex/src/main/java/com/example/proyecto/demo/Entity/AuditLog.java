package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_fecha", columnList = "fecha"),
        @Index(name = "idx_audit_usuario", columnList = "usuario_email"),
        @Index(name = "idx_audit_accion", columnList = "accion"),
        @Index(name = "idx_audit_categoria", columnList = "categoria")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(name = "usuario_email", length = 180)
    private String usuarioEmail;

    @Column(name = "usuario_nombre", length = 200)
    private String usuarioNombre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Categoria categoria;

    @Column(nullable = false, length = 80)
    private String accion;

    @Column(columnDefinition = "TEXT")
    private String detalle;

    @Column(name = "entidad_tipo", length = 60)
    private String entidadTipo;

    @Column(name = "entidad_id")
    private Long entidadId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(nullable = false)
    private Instant fecha;

    @PrePersist
    protected void onCreate() {
        if (fecha == null) {
            fecha = Instant.now();
        }
    }

    public enum Categoria {
        AUTENTICACION,
        USUARIO,
        ADMIN,
        CONVOCATORIA,
        POSTULACION,
        DOCUMENTO,
        SISTEMA
    }
}
