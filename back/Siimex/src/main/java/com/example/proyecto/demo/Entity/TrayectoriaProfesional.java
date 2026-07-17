package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "trayectorias_profesionales")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrayectoriaProfesional {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "nombramiento", length = 255)
    private String nombramiento;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Column(name = "es_actual")
    private Boolean esActual;

    @Lob
    @Column(name = "logros", columnDefinition = "LONGTEXT")
    private String logros;

    @Column(name = "institucion", length = 255)
    private String institucion;
}
