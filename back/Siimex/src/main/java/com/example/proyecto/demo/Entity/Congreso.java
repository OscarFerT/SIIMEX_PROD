package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "congresos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Congreso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    // FK apunta directamente a usuario_id
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Lob
    @Column(name = "nombre_evento", columnDefinition = "LONGTEXT")
    private String nombreEvento;

    @Lob
    @Column(name = "titulo_trabajo", columnDefinition = "LONGTEXT")
    private String tituloTrabajo;

    @Column(name = "tipo_participacion_nombre", length = 100)
    private String tipoParticipacionNombre;

    @Column(name = "fecha")
    private LocalDate fecha;

    @Column(name = "pais_sede", length = 100)
    private String paisSede;
}
