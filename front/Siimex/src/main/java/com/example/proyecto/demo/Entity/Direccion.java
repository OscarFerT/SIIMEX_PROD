package com.example.proyecto.demo.Entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

@Entity
@Table(name = "direcciones")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Direccion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank @Column(length = 150)
    private String calle;

    @NotBlank @Column(name = "numero_exterior", length = 20)
    private String numeroExterior;

    @Column(name = "numero_interior", length = 20)
    private String numeroInterior;

    @NotBlank @Column(length = 120)
    private String colonia;

    @NotBlank @Column(length = 120)
    private String municipio;

    @NotBlank @Column(length = 120)
    private String estado;

    @NotBlank @Pattern(regexp = "^[0-9]{5}$")
    @Column(name = "codigo_postal", length = 5)
    private String codigoPostal;

    @NotBlank @Column(length = 80)
    private String pais;
}
