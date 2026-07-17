package com.example.proyecto.demo.util;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Utilidad para validar el formato y la coincidencia de datos del CURP
 */
public class CurpValidator {

    // Mapeo de códigos de entidad federativa (primeras 2 letras del CURP posiciones 12-13)
    private static final Map<String, String> ENTIDADES_FEDERATIVAS = new HashMap<>();
    
    static {
        ENTIDADES_FEDERATIVAS.put("AS", "AGUASCALIENTES");
        ENTIDADES_FEDERATIVAS.put("BC", "BAJA CALIFORNIA");
        ENTIDADES_FEDERATIVAS.put("BS", "BAJA CALIFORNIA SUR");
        ENTIDADES_FEDERATIVAS.put("CC", "CAMPECHE");
        ENTIDADES_FEDERATIVAS.put("CL", "COAHUILA");
        ENTIDADES_FEDERATIVAS.put("CM", "COLIMA");
        ENTIDADES_FEDERATIVAS.put("CS", "CHIAPAS");
        ENTIDADES_FEDERATIVAS.put("CH", "CHIHUAHUA");
        ENTIDADES_FEDERATIVAS.put("DF", "DISTRITO FEDERAL");
        ENTIDADES_FEDERATIVAS.put("DG", "DURANGO");
        ENTIDADES_FEDERATIVAS.put("GT", "GUANAJUATO");
        ENTIDADES_FEDERATIVAS.put("GR", "GUERRERO");
        ENTIDADES_FEDERATIVAS.put("HG", "HIDALGO");
        ENTIDADES_FEDERATIVAS.put("JC", "JALISCO");
        ENTIDADES_FEDERATIVAS.put("MC", "MÉXICO");
        ENTIDADES_FEDERATIVAS.put("MN", "MICHOACÁN");
        ENTIDADES_FEDERATIVAS.put("MS", "MORELOS");
        ENTIDADES_FEDERATIVAS.put("NT", "NAYARIT");
        ENTIDADES_FEDERATIVAS.put("NL", "NUEVO LEÓN");
        ENTIDADES_FEDERATIVAS.put("OC", "OAXACA");
        ENTIDADES_FEDERATIVAS.put("PL", "PUEBLA");
        ENTIDADES_FEDERATIVAS.put("QT", "QUERÉTARO");
        ENTIDADES_FEDERATIVAS.put("QR", "QUINTANA ROO");
        ENTIDADES_FEDERATIVAS.put("SP", "SAN LUIS POTOSÍ");
        ENTIDADES_FEDERATIVAS.put("SL", "SINALOA");
        ENTIDADES_FEDERATIVAS.put("SR", "SONORA");
        ENTIDADES_FEDERATIVAS.put("TC", "TABASCO");
        ENTIDADES_FEDERATIVAS.put("TS", "TAMAULIPAS");
        ENTIDADES_FEDERATIVAS.put("TL", "TLAXCALA");
        ENTIDADES_FEDERATIVAS.put("VZ", "VERACRUZ");
        ENTIDADES_FEDERATIVAS.put("YN", "YUCATÁN");
        ENTIDADES_FEDERATIVAS.put("ZS", "ZACATECAS");
        ENTIDADES_FEDERATIVAS.put("NE", "NACIDO EN EL EXTRANJERO");
    }

    /**
     * Valida el formato del CURP (18 caracteres alfanuméricos)
     */
    public static boolean validarFormato(String curp) {
        if (curp == null || curp.trim().isEmpty()) {
            return false;
        }
        
        curp = curp.trim().toUpperCase();
        
        // Debe tener exactamente 18 caracteres
        if (curp.length() != 18) {
            return false;
        }
        
        // Debe ser alfanumérico
        if (!curp.matches("^[A-Z0-9]{18}$")) {
            return false;
        }
        
        // Validaciones específicas de estructura
        // Posiciones 0-3: Letras (apellidos y nombre)
        // Posición 10: Sexo (H o M)
        char sexo = curp.charAt(10);
        if (sexo != 'H' && sexo != 'M') {
            return false;
        }
        
        // Posiciones 11-12: Código de entidad federativa (2 caracteres)
        String entidadCodigo = curp.substring(11, 13);
        if (!ENTIDADES_FEDERATIVAS.containsKey(entidadCodigo)) {
            return false;
        }
        
        return true;
    }

    /**
     * Obtiene el nombre de la entidad federativa según el código en el CURP (posiciones 11-12).
     * Útil para mostrar mensajes específicos cuando la entidad no coincide.
     *
     * @param curp CURP de 18 caracteres
     * @return Nombre de la entidad (ej. "OAXACA", "MÉXICO") o null si el CURP es inválido
     */
    public static String obtenerNombreEntidadDesdeCurp(String curp) {
        if (curp == null || curp.trim().length() < 13) {
            return null;
        }
        String codigo = curp.trim().toUpperCase().substring(11, 13);
        return ENTIDADES_FEDERATIVAS.get(codigo);
    }

    /**
     * Valida que los datos del CURP coincidan con los datos proporcionados del usuario
     * 
     * @param curp CURP a validar
     * @param apellidoPaterno Primer apellido
     * @param apellidoMaterno Segundo apellido
     * @param nombre Nombre(s)
     * @param fechaNacimiento Fecha de nacimiento
     * @param genero Género (MASCULINO/FEMENINO)
     * @param entidadFederativa Entidad federativa donde nació
     * @return true si los datos coinciden, false en caso contrario
     */
    public static boolean validarCoincidenciaDatos(
            String curp,
            String apellidoPaterno,
            String apellidoMaterno,
            String nombre,
            LocalDate fechaNacimiento,
            String genero,
            String entidadFederativa) {
        
        if (curp == null || apellidoPaterno == null || apellidoMaterno == null || 
            nombre == null || fechaNacimiento == null || genero == null || entidadFederativa == null) {
            return false;
        }
        
        curp = curp.trim().toUpperCase();
        apellidoPaterno = limpiarTexto(apellidoPaterno.trim().toUpperCase());
        apellidoMaterno = limpiarTexto(apellidoMaterno.trim().toUpperCase());
        String nombreConEspacios = nombre.trim().toUpperCase(); // conservar espacios para validar cada nombre
        nombre = limpiarTexto(nombreConEspacios);
        
        // Validar longitud
        if (curp.length() != 18) {
            return false;
        }
        
        // Permitir X en las primeras 4 posiciones (cuando no hay suficiente información)
        // Si el CURP tiene X en alguna de las primeras 4 posiciones, se considera válido
        boolean tieneXEnPrimeros4 = curp.charAt(0) == 'X' || curp.charAt(1) == 'X' || 
                                     curp.charAt(2) == 'X' || curp.charAt(3) == 'X';
        
        if (!tieneXEnPrimeros4) {
            // Solo validar coincidencia si no hay X en los primeros 4 caracteres
            
            // Posición 0: Primera letra del primer apellido (puede ser vocal o consonante)
            char primeraLetraApellidoPaterno = apellidoPaterno.isEmpty() ? 'X' : limpiarTexto(apellidoPaterno).charAt(0);
            if (curp.charAt(0) != primeraLetraApellidoPaterno) {
                return false;
            }
            
            // Posición 1: Primera vocal interna del primer apellido (omitir la primera letra)
            char vocal1 = obtenerPrimeraVocalInternaCorrecta(apellidoPaterno);
            // Si no hay vocal interna, el CURP debe tener 'X' en esta posición
            if (vocal1 == 'X' || vocal1 == 0) {
                if (curp.charAt(1) != 'X') {
                    return false;
                }
            } else if (curp.charAt(1) != vocal1) {
                return false;
            }
            
            // Posición 2: Primera letra del segundo apellido (puede ser vocal o consonante)
            char primeraLetraApellidoMaterno = apellidoMaterno.isEmpty() ? 'X' : limpiarTexto(apellidoMaterno).charAt(0);
            if (curp.charAt(2) != primeraLetraApellidoMaterno) {
                return false;
            }
            
            // Posición 3: Primera letra del nombre - busca en todos los nombres (ej. "Jose Carlos" → C válido)
            char letraCurpNombre = curp.charAt(3);
            if (!nombreContieneLetraInicial(nombreConEspacios, letraCurpNombre)) {
                return false;
            }
        }
        // Si tiene X en los primeros 4 caracteres, se considera válido sin verificar coincidencia
        
        // Posiciones 4-9: Fecha de nacimiento (AAMMDD)
        String fechaCurp = curp.substring(4, 10);
        String fechaEsperada = formatearFechaParaCurp(fechaNacimiento);
        if (!fechaCurp.equals(fechaEsperada)) {
            return false;
        }
        
        // Posición 10: Sexo (H o M)
        // H = Hombre (MASCULINO), M = Mujer (FEMENINO)
        char sexoCurp = curp.charAt(10);
        // Normalizar el género: MASCULINO o FEMENINO -> H o M
        String generoNormalizado = genero.trim().toUpperCase();
        char sexoEsperado;
        
        // Verificar explícitamente por MASCULINO o FEMENINO
        // En el CURP: H = Hombre (MASCULINO), M = Mujer (FEMENINO)
        if (generoNormalizado.equals("MASCULINO") || 
            generoNormalizado.equals("H") || 
            generoNormalizado.equals("HOMBRE") ||
            generoNormalizado.equals("MALE")) {
            sexoEsperado = 'H';  // Hombre = H
        } else if (generoNormalizado.equals("FEMENINO") ||
                   generoNormalizado.equals("MUJER") ||
                   generoNormalizado.equals("FEMALE")) {
            sexoEsperado = 'M';  // Mujer = M
        } else {
            // Fallback: si empieza con M probablemente es MASCULINO
            sexoEsperado = (generoNormalizado.startsWith("M") && !generoNormalizado.equals("MUJER")) ? 'H' : 'M';
        }
        
        if (sexoCurp != sexoEsperado) {
            return false;
        }
        
        // Posiciones 11-12: Código de entidad federativa
        String entidadCodigo = curp.substring(11, 13);
        String entidadEsperada = obtenerCodigoEntidad(entidadFederativa.toUpperCase());
        if (entidadEsperada == null || !entidadCodigo.equals(entidadEsperada)) {
            return false;
        }
        
        return true;
    }

    /**
     * Valida coincidencia y devuelve un mensaje específico si falla.
     * @return Optional vacío si todo es correcto, o mensaje descriptivo del error
     */
    public static Optional<String> validarCoincidenciaDatosConMensaje(
            String curp,
            String apellidoPaterno,
            String apellidoMaterno,
            String nombre,
            LocalDate fechaNacimiento,
            String genero,
            String entidadFederativa) {
        if (curp == null || apellidoPaterno == null || apellidoMaterno == null ||
                nombre == null || fechaNacimiento == null || genero == null || entidadFederativa == null) {
            return Optional.of("Faltan datos requeridos.");
        }
        curp = curp.trim().toUpperCase();
        String apP = limpiarTexto(apellidoPaterno.trim().toUpperCase());
        String apM = limpiarTexto(apellidoMaterno.trim().toUpperCase());
        String nom = limpiarTexto(nombre.trim().toUpperCase());
        if (curp.length() != 18) {
            return Optional.of("El CURP debe tener 18 caracteres.");
        }
        boolean tieneX = curp.charAt(0) == 'X' || curp.charAt(1) == 'X' || curp.charAt(2) == 'X' || curp.charAt(3) == 'X';
        if (!tieneX) {
            char c0 = apP.isEmpty() ? 'X' : apP.charAt(0);
            if (curp.charAt(0) != c0) {
                return Optional.of(String.format("El primer apellido debe iniciar con '%c' (CURP posición 1).", curp.charAt(0)));
            }
            char vocal1 = obtenerPrimeraVocalInternaCorrecta(apP);
            if (vocal1 == 'X' || vocal1 == 0) {
                if (curp.charAt(1) != 'X') {
                    return Optional.of("El primer apellido no tiene vocal interna; el CURP debe tener X en la posición 2.");
                }
            } else if (curp.charAt(1) != vocal1) {
                return Optional.of(String.format("La primera vocal interna del primer apellido debe ser '%c'.", curp.charAt(1)));
            }
            char c2 = apM.isEmpty() ? 'X' : apM.charAt(0);
            if (curp.charAt(2) != c2) {
                return Optional.of(String.format("El segundo apellido debe iniciar con '%c' (CURP posición 3).", curp.charAt(2)));
            }
            char letraCurpNombre = curp.charAt(3);
            if (!nombreContieneLetraInicial(nombre.trim().toUpperCase(), letraCurpNombre)) {
                return Optional.of(String.format("Ninguno de los nombres inicia con '%c' (CURP posición 4). Verifique que alguno coincida.", letraCurpNombre));
            }
        }
        String fechaCurp = curp.substring(4, 10);
        String fechaEsp = formatearFechaParaCurp(fechaNacimiento);
        if (!fechaCurp.equals(fechaEsp)) {
            return Optional.of(String.format("La fecha de nacimiento no coincide con el CURP. Esperada: %s (CURP: %s).",
                    formatearFechaLegible(fechaNacimiento), fechaCurp));
        }
        char sexoCurp = curp.charAt(10);
        String gen = genero.trim().toUpperCase();
        char sexoEsp = (gen.equals("MASCULINO") || gen.equals("H") || gen.equals("HOMBRE"))
                ? 'H' : (gen.equals("FEMENINO") || gen.equals("MUJER") ? 'M' :
                (gen.startsWith("M") && !gen.equals("MUJER") ? 'H' : 'M'));
        if (sexoCurp != sexoEsp) {
            return Optional.of(String.format("El género no coincide con el CURP. CURP indica %s.",
                    sexoCurp == 'H' ? "Hombre (Masculino)" : "Mujer (Femenino)"));
        }
        String codEnt = curp.substring(11, 13);
        String codSel = obtenerCodigoEntidad(entidadFederativa.toUpperCase());
        if (codSel == null || !codEnt.equals(codSel)) {
            String entCurp = obtenerNombreEntidadDesdeCurp(curp);
            return Optional.of(String.format("La entidad federativa no coincide. El CURP indica: %s. Seleccione la opción correcta.",
                    entCurp != null ? entCurp : "código " + codEnt));
        }
        return Optional.empty();
    }

    private static String formatearFechaLegible(LocalDate f) {
        return String.format("%02d/%02d/%d", f.getDayOfMonth(), f.getMonthValue(), f.getYear());
    }

    /**
     * Verifica si algún nombre (parte del campo nombre, separada por espacios) inicia con la letra esperada.
     * Ej: "Jose Carlos" con letra 'C' -> true (Carlos inicia con C).
     */
    private static boolean nombreContieneLetraInicial(String nombre, char letraEsperada) {
        if (nombre == null || nombre.trim().isEmpty()) return letraEsperada == 'X';
        String[] partes = nombre.trim().split("\\s+");
        char letra = Character.toUpperCase(letraEsperada);
        for (String parte : partes) {
            String p = limpiarTexto(parte.trim());
            if (!p.isEmpty() && p.charAt(0) == letra) return true;
        }
        return false;
    }

    /**
     * Limpia el texto removiendo acentos y caracteres especiales
     */
    private static String limpiarTexto(String texto) {
        return texto
                .replace("Á", "A").replace("É", "E").replace("Í", "I")
                .replace("Ó", "O").replace("Ú", "U").replace("Ü", "U")
                .replace("Ñ", "X")  // La Ñ se reemplaza por X en CURP
                .replaceAll("[^A-Z]", "");
    }

    /**
     * Obtiene la primera vocal interna del apellido (omitir la primera letra)
     * Esta es la regla correcta para el CURP: posición 1 es la primera vocal después de la primera letra
     */
    private static char obtenerPrimeraVocalInternaCorrecta(String texto) {
        String textoLimpio = limpiarTexto(texto);
        if (textoLimpio.length() < 2) {
            return 'X';
        }
        // Omitir la primera letra y buscar la primera vocal
        for (int i = 1; i < textoLimpio.length(); i++) {
            char c = textoLimpio.charAt(i);
            if (esVocal(c)) {
                return c;
            }
        }
        return 'X'; // Si no hay vocal interna
    }

    /**
     * Verifica si un carácter es vocal
     */
    private static boolean esVocal(char c) {
        return c == 'A' || c == 'E' || c == 'I' || c == 'O' || c == 'U';
    }

    /**
     * Formatea la fecha para compararla con el CURP (AAMMDD)
     */
    private static String formatearFechaParaCurp(LocalDate fecha) {
        int año = fecha.getYear();
        int mes = fecha.getMonthValue();
        int dia = fecha.getDayOfMonth();
        
        // Últimos dos dígitos del año
        String añoStr = String.format("%02d", año % 100);
        String mesStr = String.format("%02d", mes);
        String diaStr = String.format("%02d", dia);
        
        return añoStr + mesStr + diaStr;
    }

    /**
     * Obtiene el código de entidad federativa a partir del nombre (p. ej. "Estado de México" -> "MC").
     * Público para permitir mensajes de error específicos cuando la entidad no coincide con el CURP.
     */
    public static String obtenerCodigoEntidad(String entidadNombre) {
        if (entidadNombre == null || entidadNombre.trim().isEmpty()) {
            return null;
        }
        
        // Normalizar el nombre de la entidad: trim, mayúsculas, sin acentos
        String entidadNormalizada = entidadNombre.trim().toUpperCase()
                .replace("Á", "A").replace("É", "E").replace("Í", "I")
                .replace("Ó", "O").replace("Ú", "U").replace("Ü", "U")
                .replace("É", "E").replace("Í", "I");
        
        // Si ya es un código de 2 letras, devolverlo directamente
        if (entidadNormalizada.length() == 2 && 
            ENTIDADES_FEDERATIVAS.containsKey(entidadNormalizada)) {
            return entidadNormalizada;
        }
        
        // Casos especiales para Ciudad de México / Distrito Federal (código DF)
        if (entidadNormalizada.contains("IZTAPALAPA") ||
            entidadNormalizada.contains("CIUDAD DE MEXICO") ||
            entidadNormalizada.contains("CDMX") ||
            entidadNormalizada.contains("DISTRITO FEDERAL") ||
            entidadNormalizada.equals("DF") ||
            entidadNormalizada.equals("DISTRITO FEDERAL") ||
            entidadNormalizada.equals("CIUDAD DE MEXICO") ||
            entidadNormalizada.equals("IZTAPALAPA") ||
            entidadNormalizada.startsWith("IZTAPALAPA")) {
            return "DF";
        }
        
        // Buscar coincidencia exacta o parcial en el mapa de entidades
        for (Map.Entry<String, String> entry : ENTIDADES_FEDERATIVAS.entrySet()) {
            String valorNormalizado = entry.getValue().toUpperCase()
                    .replace("Á", "A").replace("É", "E").replace("Í", "I")
                    .replace("Ó", "O").replace("Ú", "U").replace("Ü", "U");
            
            // Coincidencia exacta
            if (valorNormalizado.equals(entidadNormalizada)) {
                return entry.getKey();
            }
            
            // Coincidencia parcial (la entidad contiene el valor o viceversa)
            if (entidadNormalizada.contains(valorNormalizado) ||
                valorNormalizado.contains(entidadNormalizada)) {
                return entry.getKey();
            }
            
            // Caso especial: si la entidad es "MEXICO" o "ESTADO DE MEXICO", usar código MC
            if ((entidadNormalizada.equals("MEXICO") || 
                 entidadNormalizada.equals("ESTADO DE MEXICO")) &&
                entry.getKey().equals("MC")) {
                return "MC";
            }
        }
        
        return null;
    }
}
