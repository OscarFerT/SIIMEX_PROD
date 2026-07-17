package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "postulaciones", indexes = {
        @Index(name = "idx_postulacion_usuario", columnList = "usuario_id"),
        @Index(name = "idx_postulacion_convocatoria", columnList = "convocatoria_id"),
        @Index(name = "idx_postulacion_folio", columnList = "folio")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Postulacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "convocatoria_id", nullable = false)
    private Convocatoria convocatoria;

    @Column(length = 50)
    private String cedula;

    @Column(length = 18)
    private String curp;

    @Column(length = 180, nullable = false)
    private String correo;

    @Column(length = 30)
    private String telefono;

    @Column(length = 80, unique = true)
    private String folio;

    @Column(name = "tipo_apoyo", length = 120)
    private String tipoApoyo;

    @Column(name = "tipo_solicitud", length = 20)
    private String tipoSolicitud;

    @Column(name = "fecha_evento")
    private LocalDate fechaEvento;

    @Column(name = "titulo_proyecto", length = 220)
    private String tituloProyecto;

    @Column(name = "descripcion_proyecto", columnDefinition = "TEXT")
    private String descripcionProyecto;

    @Column(name = "observaciones_revision", columnDefinition = "TEXT")
    private String observacionesRevision;

    @Column(name = "fecha_revision")
    private LocalDateTime fechaRevision;

    @Column(name = "fecha_limite_correccion")
    private LocalDateTime fechaLimiteCorreccion;

    @Column(name = "evaluador_email", length = 180)
    private String evaluadorEmail;

    @Column(name = "fecha_asignacion_evaluador")
    private LocalDateTime fechaAsignacionEvaluador;

    @Column(name = "resultado_evaluacion", length = 20)
    private String resultadoEvaluacion;

    @Column(name = "puntaje_evaluacion")
    private Integer puntajeEvaluacion;

    @Column(name = "comentarios_evaluacion", columnDefinition = "TEXT")
    private String comentariosEvaluacion;

    @Column(name = "fecha_evaluacion")
    private LocalDateTime fechaEvaluacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "carta_evaluador_documento_id")
    private Documento cartaEvaluadorDocumento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dictamen_evaluacion_documento_id")
    private Documento dictamenEvaluacionDocumento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "constancia_evaluador_documento_id")
    private Documento constanciaEvaluadorDocumento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "oficio_aprobacion_documento_id")
    private Documento oficioAprobacionDocumento;

    @Column(name = "fecha_oficio_aprobacion")
    private LocalDateTime fechaOficioAprobacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nombramiento_documento_id")
    private Documento nombramientoDocumento;

    @Column(name = "fecha_nombramiento")
    private LocalDateTime fechaNombramiento;

    @Column(name = "estado_comite", length = 20)
    private String estadoComite;

    @Column(name = "monto_apoyo_asignado", precision = 14, scale = 2)
    private BigDecimal montoApoyoAsignado;

    @Column(name = "observaciones_comite", columnDefinition = "TEXT")
    private String observacionesComite;

    @Column(name = "fecha_comite")
    private LocalDateTime fechaComite;

    @Column(name = "banco", length = 120)
    private String banco;

    @Column(name = "titular_cuenta", length = 180)
    private String titularCuenta;

    @Column(name = "cuenta_bancaria", length = 34)
    private String cuentaBancaria;

    @Column(name = "clabe_interbancaria", length = 18)
    private String clabeInterbancaria;

    @Column(name = "medio_notificacion", length = 50)
    private String medioNotificacion;

    @Column(name = "fecha_actualizacion_bancaria")
    private LocalDateTime fechaActualizacionBancaria;

    @Column(name = "estado_entrega_apoyo", length = 30)
    private String estadoEntregaApoyo;

    @Column(name = "fecha_entrega_apoyo")
    private LocalDateTime fechaEntregaApoyo;

    @Column(name = "observaciones_entrega_apoyo", columnDefinition = "TEXT")
    private String observacionesEntregaApoyo;

    @Column(name = "estado_cotejo", length = 30)
    private String estadoCotejo;

    @Column(name = "observaciones_cotejo", columnDefinition = "TEXT")
    private String observacionesCotejo;

    @Column(name = "fecha_cotejo")
    private LocalDateTime fechaCotejo;

    @Column(name = "estado_informe", length = 30)
    private String estadoInforme;

    @Column(name = "fecha_limite_informe_parcial")
    private LocalDate fechaLimiteInformeParcial;

    @Column(name = "fecha_limite_informe_final")
    private LocalDate fechaLimiteInformeFinal;

    @Column(name = "fecha_informe_parcial")
    private LocalDateTime fechaInformeParcial;

    @Column(name = "fecha_informe_final")
    private LocalDateTime fechaInformeFinal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "informe_parcial_documento_id")
    private Documento informeParcialDocumento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "informe_final_documento_id")
    private Documento informeFinalDocumento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recibo_pago_documento_id")
    private Documento reciboPagoDocumento;

    @Column(name = "estado_recibo_pago", length = 30)
    private String estadoReciboPago;

    @Column(name = "fecha_recibo_pago")
    private LocalDateTime fechaReciboPago;

    @Column(name = "fecha_validacion_recibo_pago")
    private LocalDateTime fechaValidacionReciboPago;

    @Column(name = "observaciones_recibo_pago", columnDefinition = "TEXT")
    private String observacionesReciboPago;

    @Column(name = "observaciones_informe", columnDefinition = "TEXT")
    private String observacionesInforme;

    @Column(name = "motivo_incumplimiento_informe", columnDefinition = "TEXT")
    private String motivoIncumplimientoInforme;

    @Column(name = "estado_renuncia", length = 20)
    private String estadoRenuncia;

    @Column(name = "motivo_renuncia", columnDefinition = "TEXT")
    private String motivoRenuncia;

    @Column(name = "fecha_solicitud_renuncia")
    private LocalDateTime fechaSolicitudRenuncia;

    @Column(name = "fecha_resolucion_renuncia")
    private LocalDateTime fechaResolucionRenuncia;

    @Column(name = "observaciones_renuncia", columnDefinition = "TEXT")
    private String observacionesRenuncia;

    @Column(name = "aviso_privacidad_aceptado", nullable = false)
    @Builder.Default
    private boolean avisoPrivacidadAceptado = false;

    @Column(name = "fecha_aceptacion_aviso_privacidad")
    private LocalDateTime fechaAceptacionAvisoPrivacidad;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    /** Respuestas a criterios dinámicos en JSON */
    @Column(name = "criterios_json", columnDefinition = "TEXT")
    private String criteriosJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "curriculum_documento_id")
    private Documento curriculumDocumento;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(length = 20)
    @Builder.Default
    private String estado = "PENDIENTE";

    @PrePersist
    protected void onCreate() {
        if (fechaCreacion == null) {
            fechaCreacion = LocalDateTime.now();
        }
    }
}
