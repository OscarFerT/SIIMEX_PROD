package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "usuarios")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

        @OneToOne
    @JoinColumn(name = "auth_user_id", unique = true)
    private AuthUser authUser;

    @OneToOne(mappedBy = "usuario", cascade = CascadeType.ALL, orphanRemoval = true)
    private Registro1 registro1;
    
    @OneToOne(mappedBy = "usuario", cascade = CascadeType.ALL, orphanRemoval = true)
    private PerfilMigracion perfilMigracion;


    @Column(name = "nombre", nullable = true, length = 120)
    private String nombre;

    @Column(name = "apellido_paterno", nullable = true, length = 120)
    private String apellidoPaterno;

    @Column(name = "apellido_materno", nullable = true, length = 120)
    private String apellidoMaterno;

    /** Visibilidad en el módulo público de investigadoras e investigadores: MINIMA, ESTANDAR, COMPLETA */
    @Column(name = "visibilidad_perfil", length = 20)
    private String visibilidadPerfil;

    /** Consentimiento explícito para publicar información en el directorio público */
    @Column(name = "consentimiento_directorio_publico")
    private Boolean consentimientoDirectorioPublico;

    @Column(name = "semblanza", columnDefinition = "TEXT")
    private String semblanza;

    @Column(name = "registro2_completo")
    private Boolean registro2Completo;

}
