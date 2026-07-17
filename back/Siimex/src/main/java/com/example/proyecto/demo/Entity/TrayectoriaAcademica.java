package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "trayectorias_academicas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrayectoriaAcademica {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "nivel_nombre", length = 50)
    private String nivelNombre;

    @Column(name = "titulo", length = 255)
    private String titulo;

    @Column(name = "estatus_nombre", length = 50)
    private String estatusNombre;

    @Column(name = "cedula_profesional", length = 50)
    private String cedulaProfesional;

    @Column(name = "opcion_titulacion", length = 255)
    private String opcionTitulacion;

    @Lob
    @Column(name = "titulo_tesis", columnDefinition = "LONGTEXT")
    private String tituloTesis;

    @Column(name = "fecha_obtencion")
    private LocalDate fechaObtencion;

    @Column(name = "institucion", length = 255)
    private String institucion;

    @Column(name = "es_perfil_snii")
    private Boolean esPerfilSnii;
}
