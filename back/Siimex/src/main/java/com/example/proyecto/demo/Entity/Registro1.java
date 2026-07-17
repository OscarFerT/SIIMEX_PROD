package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDate;
@Entity
@Table(
    name = "registro1",
    indexes = {
        @Index(name = "idx_registro1_curp", columnList = "curp", unique = true),
        @Index(name = "idx_registro1_rfc", columnList = "rfc", unique = true)
    }
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Registro1 {

    @Id
    private Long id;

    // 🔗 RELACIÓN COMPARTIENDO EL MISMO ID CON USUARIO
    @OneToOne
    @MapsId  // El id de Registro1 será el mismo que el de Usuario
    @JoinColumn(name = "id")  // Usa la columna 'id' como FK (que es también la PK)
    private Usuario usuario;
    



    @Pattern(regexp = "^[A-Z0-9]{18}$")
    @Column(length = 18, nullable = false, unique = true)
    private String curp;

    @Column(length = 13, unique = true)
    private String rfc;

    @Past
    @Column(name = "fecha_nacimiento", nullable = false)
    private LocalDate fechaNacimiento;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private Genero genero;

    private String nacionalidad;
    private String paisNacimiento;
    private String entidadFederativa;
    private String municipio;

    @Enumerated(EnumType.STRING)
    private EstadoCivil estadoCivil;

    /** Tipo de perfil: INVESTIGADOR, INNOVADOR o HIBRIDO. Nullable para registros antiguos. */
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_perfil", length = 20)
    private TipoPerfil tipoPerfil;

    @Column(length = 20)
    private String telefono;

    @Column(name = "celular", length = 20)
    private String celular;

    @Column(name = "tp_id_oficial", length = 60)
    private String tipoIdentificacionOficial;

    @Column(name = "id_oficial", length = 80)
    private String identificacionOficial;

    @Column(name = "calle", length = 150)
    private String calle;

    @Column(name = "num_ext", length = 20)
    private String numeroExterior;

    @Column(name = "num_int", length = 20)
    private String numeroInterior;

    @Column(name = "entre_calle", length = 150)
    private String entreCalle;

    @Column(name = "y_calle", length = 150)
    private String yCalle;

    @Column(name = "otra_referencia", length = 250)
    private String otraReferencia;

    @Column(name = "colonia", length = 120)
    private String colonia;

    @Column(name = "ct_localidad", length = 40)
    private String claveLocalidad;

    @Column(name = "localidad", length = 120)
    private String localidad;

    @Column(name = "ct_municipio", length = 40)
    private String claveMunicipio;

    @Column(name = "municipio_domicilio", length = 120)
    private String municipioDomicilio;

    @Column(name = "ct_entidad_federativa", length = 40)
    private String claveEntidadFederativa;

    @Column(name = "codigo_postal", length = 5)
    private String codigoPostal;

    @Column(name = "ct_ageb", length = 40)
    private String claveAgeb;

    @Column(name = "ct_red_social", length = 40)
    private String claveRedSocial;

    @Column(name = "red_social", length = 180)
    private String redSocial;

    @Column(updatable = false)
    private LocalDate createdAt;

    private LocalDate updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDate.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDate.now();
    }

    public enum Genero { MASCULINO, FEMENINO, OTRO }
    public enum EstadoCivil { SOLTERO, CASADO, DIVORCIADO, VIUDO, UNION_LIBRE }
    public enum TipoPerfil { INVESTIGADOR, INNOVADOR, HIBRIDO }
}
