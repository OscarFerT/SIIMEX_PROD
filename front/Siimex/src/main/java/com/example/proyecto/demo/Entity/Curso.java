package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "cursos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Curso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Lob
    @Column(name = "nombre", columnDefinition = "LONGTEXT")
    private String nombre;

    @Column(name = "programa", length = 255)
    private String programa;

    @Column(name = "horas_totales")
    private Integer horasTotales;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Column(name = "institucion", length = 255)
    private String institucion;

    @Column(name = "nivel_escolaridad", length = 100)
    private String nivelEscolaridad;
}
