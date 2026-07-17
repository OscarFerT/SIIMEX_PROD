package com.example.proyecto.demo.Entity;

import com.example.proyecto.demo.Entity.Usuario;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "documentos",
        indexes = {
            @Index(name = "idx_documentos_usuario", columnList = "usuario_id")
        })
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Documento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", length = 30, nullable = false)
    private TipoDocumento tipo;

    @NotBlank
    @Column(name = "nombre_archivo", length = 255, nullable = false)
    private String nombreArchivo;

    @NotBlank
    @Column(name = "content_type", length = 100, nullable = false)
    private String contentType;

    @Positive
    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    // Guardar el archivo como BLOB en la BD
    // FetchType.LAZY: Solo carga el contenido cuando se accede explícitamente
    // Esto mejora el rendimiento al listar documentos sin necesidad de cargar los bytes
    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "contenido", columnDefinition = "LONGBLOB", nullable = false)
    private byte[] contenido;

    // Relación con Usuario (obligatoria)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "fecha_subida")
    private LocalDateTime fechaSubida;

    @PrePersist
    protected void onCreate() {
        if (fechaSubida == null) {
            fechaSubida = LocalDateTime.now();
        }
    }

    public enum TipoDocumento {
        CV,
        CURRICULUM,
        FOTO_PERFIL,
        FISCAL_PDF,
        DOMICILIO,
        CERTIFICADO_1,
        CERTIFICADO_2,
        CERTIFICACION_IDIOMA,
        ESTANCIA_INVESTIGACION,
        CONSTANCIA_SNII,
        DIVULGACION,
        CV_POSTULACION,
        CURP,
        ACTA_NACIMIENTO,
        INE_FRENTE,
        INE_REVERSO,
        OTRO,
        CEDULA_PROFESIONAL,
        INFORME_PARCIAL,
        INFORME_FINAL,
        CARTA_EVALUADOR,
        DICTAMEN_EVALUADOR,
        CONSTANCIA_EVALUADOR,
        OFICIO_APROBACION,
        NOMBRAMIENTO,
        RECIBO_PAGO,
        /** Adjunto de postulación (requisitos configurables por convocatoria) */
        ADJUNTO_POSTULACION
    }
}
