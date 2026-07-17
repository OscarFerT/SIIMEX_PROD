package com.example.proyecto.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ConvocatoriaRequest {

    @NotBlank(message = "El título es obligatorio")
    private String titulo;

    private String descripcion;
    private String resumen;
    private String requisitos;

    private LocalDate fechaApertura;

    @NotNull(message = "La fecha de cierre es obligatoria")
    private LocalDate fechaCierre;

    private String area;
    private String folioConvocatoria;
    private String folioPrefijo;
    private String keywords;
    private String imagenUrl;
    private String iconoUrl;

    private Boolean vigente = true;
    private Boolean visibilidadPublica = true;

    /** JSON: criterios del formulario de postulación (campos dinámicos con peso para compatibilidad) */
    private String criteriosFormulario;

    /** Límite de postulaciones aceptadas (null = sin límite) */
    private Integer limiteAceptados;

    /** JSON: requisitos de documentos [{"clave","etiqueta","requerido"}] */
    private String requisitosDocumentos;

    /** JSON: tipos de apoyo de la convocatoria ["Profesor participante", ...] */
    private String tiposApoyo;

    /** JSON: reglas personalizadas de convocatoria [{"clave","valor","descripcion"}]. */
    private String reglasConfigurables;

    /** Maximo de puntaje en evaluacion por convocatoria. */
    private Integer puntajeMaximoEvaluacion;

    /** Ventana editable de anticipación de evento para postulaciones. */
    private Integer diasMinAnticipacion;
    private Integer diasMaxAnticipacion;

    /** Aviso de privacidad configurable por convocatoria. */
    private Boolean avisoPrivacidadObligatorio;
    private String avisoPrivacidadTexto;
    private String avisoPrivacidadUrl;
}
