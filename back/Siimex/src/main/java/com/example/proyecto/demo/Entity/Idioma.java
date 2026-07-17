package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "idiomas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Idioma {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "nombre", length = 100, nullable = false)
    private String nombre;

    @Column(name = "dominio_nombre", length = 50)
    private String dominioNombre;

    @Column(name = "conversacion", length = 50)
    private String conversacion;

    @Column(name = "lectura", length = 50)
    private String lectura;

    @Column(name = "escritura", length = 50)
    private String escritura;

    @Column(name = "es_certificado")
    private Boolean esCertificado;

    @Column(name = "cert_institucion", length = 255)
    private String certInstitucion;

    @Column(name = "cert_puntuacion", length = 20)
    private String certPuntuacion;

    @Column(name = "vigencia_fin")
    private LocalDate vigenciaFin;
}
