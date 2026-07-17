package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "perfiles_migracion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PerfilMigracion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 🔗 RELACIÓN CON USUARIO - COMPARTEN EL MISMO ID
    // Cuando hay Usuario, ambos comparten el mismo ID (se maneja en el servicio)
    // Cuando no hay Usuario (solo migración), el ID se genera automáticamente
    @OneToOne
    @JoinColumn(name = "usuario_id", unique = true)  // FK a usuario_id
    private Usuario usuario;

    // Si no hay usuario, usamos migracionId como identificador alternativo
    @Column(name = "migracion_id", length = 50, unique = true)
    private String migracionId;

    @Column(name = "cvu", length = 20)
    private String cvu;

    @Column(name = "login", length = 150)
    private String login;

    @Column(name = "correo_alterno", length = 150)
    private String correoAlterno;

    @Column(name = "nivel_academico", length = 50)
    private String nivelAcademico;

    @Column(name = "titulo_tratamiento", length = 20)
    private String tituloTratamiento;

    @Column(name = "filtro", length = 50)
    private String filtro;

    @Column(name = "institucion_receptora", length = 255)
    private String institucionReceptora;

    @Column(name = "created_date")
    private LocalDateTime createdDate;

    @Column(name = "last_modified_date")
    private LocalDateTime lastModifiedDate;

    @PrePersist
    protected void onCreate() {
        if (createdDate == null) {
            createdDate = LocalDateTime.now();
        }
        if (lastModifiedDate == null) {
            lastModifiedDate = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        lastModifiedDate = LocalDateTime.now();
    }
}
