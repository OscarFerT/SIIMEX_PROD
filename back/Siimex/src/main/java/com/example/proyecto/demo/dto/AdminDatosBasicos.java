package com.example.proyecto.demo.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.Locale;

public final class AdminDatosBasicos {
    private AdminDatosBasicos() {}

    public record Datos(Long id, String nombre, String apellidoPaterno, String apellidoMaterno,
                        String email, String curp, String telefono, LocalDate fechaNacimiento,
                        String genero, String entidadFederativa, String revision) {}

    public record Cambio(
            @NotBlank @Size(max = 120) String nombre,
            @NotBlank @Size(max = 120) String apellidoPaterno,
            @NotNull @Size(max = 120) String apellidoMaterno,
            @NotBlank @Email @Size(max = 180) String email,
            @NotBlank @Pattern(regexp = "[A-Z0-9]{18}", message = "La CURP debe tener 18 caracteres alfanumericos") String curp,
            @NotNull @Size(max = 20) @Pattern(regexp = "[0-9+() .-]*", message = "Telefono invalido") String telefono,
            @NotNull @Past LocalDate fechaNacimiento,
            @NotBlank @Pattern(regexp = "MASCULINO|FEMENINO|OTRO") String genero,
            @NotBlank @Size(max = 255) String entidadFederativa,
            @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String revision,
            @NotBlank @Size(max = 500) String motivo) {
        public Cambio {
            nombre = trim(nombre);
            apellidoPaterno = trim(apellidoPaterno);
            apellidoMaterno = trim(apellidoMaterno);
            email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
            curp = curp == null ? null : curp.trim().toUpperCase(Locale.ROOT);
            telefono = trim(telefono);
            entidadFederativa = trim(entidadFederativa);
            motivo = trim(motivo);
        }
    }

    private static String trim(String value) { return value == null ? null : value.trim(); }
}
