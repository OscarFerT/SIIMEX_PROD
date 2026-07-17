package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "catalog_options",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_catalog_type_scope_clave", columnNames = {"catalog_type", "scope_key", "clave"})
        },
        indexes = {
                @Index(name = "idx_catalog_type", columnList = "catalog_type"),
                @Index(name = "idx_catalog_type_parent", columnList = "catalog_type,parent_key"),
                @Index(name = "idx_catalog_type_scope", columnList = "catalog_type,scope_key"),
                @Index(name = "idx_catalog_type_nombre", columnList = "catalog_type,nombre")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CatalogOption {

    public enum CatalogType {
        ENTIDAD_FEDERATIVA,
        MUNICIPIO,
        LOCALIDAD,
        NACIONALIDAD,
        ESTADO_CIVIL,
        IDENTIFICACION_OFICIAL,
        RED_SOCIAL,
        TIPO_INSTITUCION,
        GRADO_ESTUDIOS,
        CARRERA
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "catalog_type", nullable = false, length = 50)
    private CatalogType catalogType;

    @Column(nullable = false, length = 40)
    private String clave;

    @Column(nullable = false, length = 255)
    private String nombre;

    @Column(name = "parent_key", length = 40)
    private String parentKey;

    @Column(name = "scope_key", length = 120)
    private String scopeKey;

    @Column(name = "extra_1", length = 120)
    private String extra1;

    @Column(name = "extra_2", length = 255)
    private String extra2;

    @Column(name = "extra_3", length = 120)
    private String extra3;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    @Column(name = "sort_order")
    private Integer sortOrder;
}



