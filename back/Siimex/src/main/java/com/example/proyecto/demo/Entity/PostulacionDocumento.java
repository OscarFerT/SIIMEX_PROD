package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "postulacion_documentos", indexes = {
        @Index(name = "idx_postulacion_doc_postulacion", columnList = "postulacion_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostulacionDocumento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "postulacion_id", nullable = false)
    private Postulacion postulacion;

    /** Clave del requisito (ej. identificacion_oficial, comprobante_domicilio) */
    @Column(name = "clave", nullable = false, length = 80)
    private String clave;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "documento_id", nullable = false)
    private Documento documento;
}
