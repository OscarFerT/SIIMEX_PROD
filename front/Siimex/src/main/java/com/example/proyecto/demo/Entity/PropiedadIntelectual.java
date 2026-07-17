package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "propiedad_intelectual")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PropiedadIntelectual {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", length = 50, nullable = false)
    private Tipo tipo;

    @Column(name = "titulo", length = 500, nullable = false)
    private String titulo;

    @Column(name = "numero_registro", length = 100)
    private String numeroRegistro;

    @Column(name = "institucion_oficina", length = 255)
    private String institucionOficina;

    @Column(name = "pais", length = 100)
    private String pais;

    @Column(name = "fecha_registro")
    private LocalDate fechaRegistro;

    @Column(name = "anio")
    private Integer anio;

    @Lob
    @Column(name = "descripcion", columnDefinition = "TEXT")
    private String descripcion;

    @Column(name = "documento_id")
    private Long documentoId;

    public enum Tipo {
        PATENTE,
        MARCA,
        DISENO_INDUSTRIAL,
        DERECHO_AUTOR,
        SECRETO_INDUSTRIAL,
        OTRO
    }
}
