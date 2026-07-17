package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "convocatorias", indexes = {
        @Index(name = "idx_convocatoria_vigente", columnList = "vigente"),
        @Index(name = "idx_convocatoria_fecha_cierre", columnList = "fecha_cierre"),
        @Index(name = "idx_convocatoria_visibilidad", columnList = "visibilidad_publica"),
        @Index(name = "idx_convocatoria_folio", columnList = "folio_convocatoria")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Convocatoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String titulo;

    /** Descripción corta para la tarjeta (card) */
    @Column(length = 500)
    private String descripcion;

    /** Resumen detallado para el modal */
    @Column(columnDefinition = "TEXT")
    private String resumen;

    /** Requisitos (texto con saltos de línea o lista) */
    @Column(columnDefinition = "TEXT")
    private String requisitos;

    @Column(name = "fecha_apertura")
    private LocalDate fechaApertura;

    @Column(name = "fecha_cierre", nullable = false)
    private LocalDate fechaCierre;

    /** Área o categoría: Energías, Educación, Tecnología, etc. */
    @Column(length = 80)
    private String area;

    /** Folio único de la convocatoria. */
    @Column(name = "folio_convocatoria", length = 40, unique = true)
    private String folioConvocatoria;

    /** Prefijo configurable para folios de solicitudes de revisión (ej. PROY, EST, INT). */
    @Column(name = "folio_prefijo", length = 30)
    private String folioPrefijo;

    /** Palabras clave para búsqueda (separadas por espacio) */
    @Column(length = 300)
    private String keywords;

    /** URL o ruta de imagen/icono opcional */
    @Column(name = "imagen_url", length = 500)
    private String imagenUrl;

    /** URL o ruta del ícono de la convocatoria (seleccionable en admin) */
    @Column(name = "icono_url", length = 500)
    private String iconoUrl;

    /** Si está activa y visible para los usuarios */
    @Column(nullable = false)
    @Builder.Default
    private boolean vigente = true;

    /** Visibilidad pública: true=visible en frontend público, false=no visible. */
    @Column(name = "visibilidad_publica", nullable = false)
    @Builder.Default
    private boolean visibilidadPublica = true;

    /** Fecha en la que se publicó formalmente en el micrositio/sistema. */
    @Column(name = "fecha_publicacion")
    private LocalDateTime fechaPublicacion;

    /**
     * Criterios del formulario de postulación (JSON).
     * Estructura: [{"clave":"grado_academico","etiqueta":"Grado académico","tipo":"select","opciones":["Licenciatura","Maestría","Doctorado"],"peso":25,"requerido":true},...]
     * Usados para: 1) Renderizar el formulario dinámico al postularse, 2) Calcular % de compatibilidad.
     */
    @Column(name = "criterios_formulario", columnDefinition = "TEXT")
    private String criteriosFormulario;

    /** Límite de postulaciones aceptadas (null = sin límite). */
    @Column(name = "limite_aceptados")
    private Integer limiteAceptados;

    /**
     * Requisitos de documentos configurables por convocatoria (JSON).
     * Estructura: [{"clave":"identificacion_oficial","etiqueta":"Identificación oficial","requerido":true},...]
     */
    @Column(name = "requisitos_documentos", columnDefinition = "TEXT")
    private String requisitosDocumentos;

    /**
     * Tipos de apoyo configurables por convocatoria (JSON).
     * Estructura: ["Profesor participante","Profesor asesor","Estudiante en concurso"].
     */
    @Column(name = "tipos_apoyo", columnDefinition = "TEXT")
    private String tiposApoyo;

    /**
     * Reglas personalizadas configurables por convocatoria (JSON).
     * Estructura: [{"clave":"x","valor":"y","descripcion":"..."}].
     */
    @Column(name = "reglas_configurables", columnDefinition = "TEXT")
    private String reglasConfigurables;

    /** Puntaje maximo permitido en evaluacion (default 100). */
    @Column(name = "puntaje_maximo_evaluacion")
    private Integer puntajeMaximoEvaluacion;

    /** Días mínimos de anticipación para la fecha de evento en la postulación. */
    @Column(name = "dias_min_anticipacion")
    @Builder.Default
    private Integer diasMinAnticipacion = 20;

    /** Días máximos de anticipación para la fecha de evento en la postulación. */
    @Column(name = "dias_max_anticipacion")
    @Builder.Default
    private Integer diasMaxAnticipacion = 60;

    /** Si true, exige aceptación de aviso de privacidad al postularse. */
    @Column(name = "aviso_privacidad_obligatorio", nullable = false)
    @Builder.Default
    private boolean avisoPrivacidadObligatorio = false;

    /** Texto del aviso de privacidad configurable por convocatoria. */
    @Column(name = "aviso_privacidad_texto", columnDefinition = "TEXT")
    private String avisoPrivacidadTexto;

    /** URL opcional al aviso de privacidad completo. */
    @Column(name = "aviso_privacidad_url", length = 500)
    private String avisoPrivacidadUrl;
}
