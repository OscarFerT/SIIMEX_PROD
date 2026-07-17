package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "areas_conocimiento")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AreaConocimiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // FK apunta directamente a usuario_id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "area_id", length = 10)
    private String areaId;

    @Column(name = "area_nombre", length = 255)
    private String areaNombre;

    @Column(name = "area_clave", length = 10)
    private String areaClave;

    @Column(name = "area_version", length = 10)
    private String areaVersion;

    @Column(name = "campo_id", length = 10)
    private String campoId;

    @Column(name = "campo_nombre", length = 255)
    private String campoNombre;

    @Column(name = "campo_clave", length = 10)
    private String campoClave;

    @Column(name = "disciplina_id", length = 10)
    private String disciplinaId;

    @Column(name = "disciplina_nombre", length = 255)
    private String disciplinaNombre;

    @Column(name = "disciplina_clave", length = 10)
    private String disciplinaClave;

    @Column(name = "subdisciplina_id", length = 10)
    private String subdisciplinaId;

    @Column(name = "subdisciplina_nombre", length = 255)
    private String subdisciplinaNombre;

    @Column(name = "subdisciplina_clave", length = 10)
    private String subdisciplinaClave;
}
