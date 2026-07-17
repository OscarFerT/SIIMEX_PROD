package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "divulgaciones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Divulgacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Lob
    @Column(name = "titulo", columnDefinition = "LONGTEXT")
    private String titulo;

    @Column(name = "tipo_divulgacion_nombre", length = 100)
    private String tipoDivulgacionNombre;

    @Column(name = "medio_nombre", length = 100)
    private String medioNombre;

    @Column(name = "dirigido_a", length = 100)
    private String dirigidoA;

    @Column(name = "producto_obtenido_nombre", length = 100)
    private String productoObtenidoNombre;

    @Column(name = "fecha")
    private LocalDate fecha;

    @Column(name = "institucion_organizadora", length = 255)
    private String institucionOrganizadora;

    @Column(name = "evidencia_tipo", length = 20)
    private String evidenciaTipo;

    @Lob
    @Column(name = "evidencia_link", columnDefinition = "LONGTEXT")
    private String evidenciaLink;

    @Column(name = "evidencia_archivo_nombre", length = 255)
    private String evidenciaArchivoNombre;
}
