package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "incidencia_social")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidenciaSocial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    /** Título de la investigación o proyecto de incidencia */
    @Column(name = "titulo", length = 500, nullable = false)
    private String titulo;

    /** Ubicación (lugar, institución, región) */
    @Column(name = "ubicacion", length = 300)
    private String ubicacion;

    /** Descripción o resumen */
    @Lob
    @Column(name = "descripcion", columnDefinition = "LONGTEXT")
    private String descripcion;

    /** Fecha de realización o vigencia */
    @Column(name = "fecha")
    private LocalDate fecha;

    /** Año (alternativo si no se usa fecha exacta) */
    @Column(name = "anio")
    private Integer anio;
}
