package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "intereses_habilidades")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InteresHabilidad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", unique = true, nullable = false)
    private Usuario usuario;

    @Column(name = "foto_uri", length = 500)
    private String fotoUri;

    @Lob
    @Column(name = "interes_descripcion", columnDefinition = "LONGTEXT")
    private String interesDescripcion;

    @Column(name = "habilidad_descripcion", length = 255)
    private String habilidadDescripcion;

    @Column(name = "habilidad_nivel", length = 20)
    private String habilidadNivel;
}
