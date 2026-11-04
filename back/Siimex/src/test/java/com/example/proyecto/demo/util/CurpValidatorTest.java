package com.example.proyecto.demo.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class CurpValidatorTest {
    // Synthetic date and suffix: no real person's CURP is used in these fixtures.
    private static final LocalDate FECHA = LocalDate.of(1990, 1, 1);
    private static String curp(String letras) { return letras + "900101MMCRSN00"; }

    private void coincide(String letras, String paterno, String materno, boolean expected) {
        String value = curp(letras);
        assertThat(CurpValidator.validarFormato(value)).isTrue();
        assertThat(CurpValidator.validarCoincidenciaDatos(value, paterno, materno, "Ana Cecilia", FECHA, "FEMENINO", "Estado de Mexico"))
                .as("%s %s frente a %s", paterno, materno, letras).isEqualTo(expected);
        assertThat(CurpValidator.validarCoincidenciaDatosConMensaje(value, paterno, materno, "Ana Cecilia", FECHA, "FEMENINO", "Estado de Mexico").isEmpty())
                .isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"De la Rosa", "DE LA ROSA", "de la rosa", "  De   la   Rosa  ", "De\tla\tRosa", "De\u00a0la\u00a0Rosa"})
    void aceptaDeLaRosaConEspaciosYMayusculasSinModificarElApellido(String materno) {
        coincide("FARA", "Franco", materno, true);
    }

    @ParameterizedTest
    @CsvSource({
        "Del Rio,De la Rosa,RIRA", "De la Cruz,De los Santos,CUSA", "De Leon,Del Rio,LERA",
        "Riva Palacio,Rosa,RIRA", "Franco,De las Heras,FAHA", "Díaz,De la Peña,DIPA",
        "Franco,Rosa Mendoza,FARA", "Lopez,Garcia,LOGA", "Franco,Delgado,FADA",
        "Franco,Lazaro,FALA", "Franco,Derbez,FADA", "Franco,Macias,FAMA",
        "Franco,Mcgregor,FAMA", "Franco,De,FADA"
    })
    void aceptaApellidosSimplesYCompuestosSinEliminarPrefijosDentroDeUnaPalabra(String paterno, String materno, String letras) {
        coincide(letras, paterno, materno, true);
    }

    @ParameterizedTest
    @ValueSource(strings = {"DA", "DAS", "DE", "DEL", "DER", "DI", "DIE", "DD", "EL", "LA", "LOS", "LAS", "LE", "LES", "MAC", "MC", "VAN", "VON", "Y"})
    void omiteSoloParticulasInicialesDocumentadasEnAmbosApellidos(String particula) {
        coincide("FARA", particula + " Franco", particula + " Rosa", true);
    }

    @Test void aceptaAcentosDescompuestosEnUnicode() {
        coincide("RIRA", "Del Ri\u0301o", "De la Rosa", true);
    }

    @Test void rechazaLaDDeLaParticulaComoInicialDelApellidoSignificativo() {
        coincide("FADA", "Franco", "De la Rosa", false);
        var error = CurpValidator.validarCoincidenciaDatosConMensaje(curp("FADA"), "Franco", "De la Rosa", "Ana Cecilia", FECHA, "FEMENINO", "MC");
        assertThat(error).isPresent();
        assertThat(error.get()).contains("apellido completo").doesNotContain("debe iniciar");
    }

    @ParameterizedTest
    @ValueSource(strings = {"BARA", "FERA", "FAZA", "FARZ"})
    void noDejaPasarInicialesNiVocalesQueNoCoinciden(String letras) {
        coincide(letras, "Franco", "De la Rosa", false);
    }

    @Test void mantieneLasValidacionesDeFechaGeneroEntidadYLongitud() {
        String value = curp("FARA");
        assertThat(CurpValidator.validarCoincidenciaDatos(value, "Franco", "De la Rosa", "Ana Cecilia", FECHA.plusDays(1), "FEMENINO", "MC")).isFalse();
        assertThat(CurpValidator.validarCoincidenciaDatosConMensaje(value, "Franco", "De la Rosa", "Ana Cecilia", FECHA.plusDays(1), "FEMENINO", "MC").orElseThrow()).contains("fecha de nacimiento");
        assertThat(CurpValidator.validarCoincidenciaDatos(value, "Franco", "De la Rosa", "Ana Cecilia", FECHA, "MASCULINO", "MC")).isFalse();
        assertThat(CurpValidator.validarCoincidenciaDatosConMensaje(value, "Franco", "De la Rosa", "Ana Cecilia", FECHA, "MASCULINO", "MC").orElseThrow()).contains("género");
        assertThat(CurpValidator.validarCoincidenciaDatos(value, "Franco", "De la Rosa", "Ana Cecilia", FECHA, "FEMENINO", "DF")).isFalse();
        assertThat(CurpValidator.validarCoincidenciaDatosConMensaje(value, "Franco", "De la Rosa", "Ana Cecilia", FECHA, "FEMENINO", "DF").orElseThrow()).contains("entidad federativa");
        assertThat(CurpValidator.validarCoincidenciaDatos(value.substring(1), "Franco", "De la Rosa", "Ana Cecilia", FECHA, "FEMENINO", "MC")).isFalse();
    }

    @Test void xNoPermiteOmitirLasCoincidenciasDeOtrosCaracteres() {
        coincide("FXRA", "Franco", "De la Rosa", false);
        coincide("BXZA", "Franco", "De la Rosa", false);
        coincide("XARA", "Xavier", "De la Rosa", true);
        assertThat(CurpValidator.validarCoincidenciaDatos(curp("FXRA"), "Franco", "De la Rosa", "Ana Cecilia", FECHA.plusDays(1), "FEMENINO", "MC")).isFalse();
        assertThat(CurpValidator.validarCoincidenciaDatos(curp("FXRA"), "Franco", "De la Rosa", "Ana Cecilia", FECHA, "MASCULINO", "MC")).isFalse();
    }

    @Test void datosRequeridosYFormatoInvalidoSiguenSiendoRechazados() {
        assertThat(CurpValidator.validarCoincidenciaDatos(null, "Franco", "De la Rosa", "Ana", FECHA, "FEMENINO", "MC")).isFalse();
        assertThat(CurpValidator.validarCoincidenciaDatosConMensaje(curp("FARA"), null, "De la Rosa", "Ana", FECHA, "FEMENINO", "MC")).isPresent();
        assertThat(CurpValidator.validarFormato("FARA900101MMCRSN0!")).isFalse();
    }
}
