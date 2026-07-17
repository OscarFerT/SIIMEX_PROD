package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "autores_articulos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AutorArticulo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "articulo_id", nullable = false)
    private Articulo articulo;

    @Column(name = "nombre_completo", length = 255)
    private String nombreCompleto;

    @Column(name = "orcid", length = 50)
    private String orcid;

    @Column(name = "orden")
    private Integer orden;
}
