package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "estancias")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Estancia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Lob
    @Column(name = "nombre_proyecto", columnDefinition = "LONGTEXT")
    private String nombreProyecto;

    @Column(name = "tipo_nombre", length = 100)
    private String tipoNombre;

    @Lob
    @Column(name = "logros", columnDefinition = "LONGTEXT")
    private String logros;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Column(name = "institucion_receptora", length = 255)
    private String institucionReceptora;
}
