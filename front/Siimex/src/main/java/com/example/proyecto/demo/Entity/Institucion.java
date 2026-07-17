package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "instituciones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Institucion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // FK apunta directamente a usuario_id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "clave_oficial", length = 50)
    private String claveOficial;

    @Column(name = "nombre", length = 255, nullable = false)
    private String nombre;

    @Column(name = "tipo_id", length = 10)
    private String tipoId;

    @Column(name = "tipo_nombre", length = 100)
    private String tipoNombre;

    @Column(name = "pais_nombre", length = 100)
    private String paisNombre;

    @Column(name = "entidad_nombre", length = 100)
    private String entidadNombre;

    @Column(name = "municipio_nombre", length = 120)
    private String municipioNombre;

    @Column(name = "nivel_uno_nombre", length = 100)
    private String nivelUnoNombre;

    @Column(name = "nivel_dos_nombre", length = 100)
    private String nivelDosNombre;
}
