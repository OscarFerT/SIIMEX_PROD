package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "articulos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Articulo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "id_externo", length = 50)
    private String idExterno;

    @Column(name = "eje", length = 50)
    private String eje;

    @Column(name = "tipo", length = 50)
    private String tipo;

    @Column(name = "producto_principal")
    private Boolean productoPrincipal;

    @Column(name = "anio")
    private Integer anio;

    @Column(name = "issn", length = 50)
    private String issn;

    @Column(name = "issn_electronico", length = 50)
    private String issnElectronico;

    @Column(name = "doi", length = 255)
    private String doi;

    @Lob
    @Column(name = "nombre_revista", columnDefinition = "LONGTEXT")
    private String nombreRevista;

    @Lob
    @Column(name = "titulo", columnDefinition = "LONGTEXT")
    private String titulo;

    @Column(name = "rol_participacion_nombre", length = 100)
    private String rolParticipacionNombre;

    @Column(name = "estado_nombre", length = 50)
    private String estadoNombre;

    @Column(name = "objetivo_nombre", length = 50)
    private String objetivoNombre;

    @Lob
    @Column(name = "fondo_programa_nombre", columnDefinition = "LONGTEXT")
    private String fondoProgramaNombre;

    // Relación uno a muchos con autores
    @OneToMany(mappedBy = "articulo", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AutorArticulo> autores = new ArrayList<>();
}
