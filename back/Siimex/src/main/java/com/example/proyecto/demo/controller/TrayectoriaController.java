package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.*;
import com.example.proyecto.demo.Repository.*;
import com.example.proyecto.demo.Service.DocumentoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/trayectoria")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class TrayectoriaController {

    private final UsuarioRepository usuarioRepository;
    private final CursoRepository cursoRepository;
    private final IdiomaRepository idiomaRepository;
    private final LogroRepository logroRepository;
    private final ArticuloRepository articuloRepository;
    private final DocumentoService documentoService;
    private final InteresHabilidadRepository interesHabilidadRepository;
    private final AreaConocimientoRepository areaConocimientoRepository;
    private final InstitucionRepository institucionRepository;
    private final HerramientaRepository herramientaRepository;
    private final IncidenciaSocialRepository incidenciaSocialRepository;
    private final PropiedadIntelectualRepository propiedadIntelectualRepository;
    private final TrayectoriaAcademicaRepository trayectoriaAcademicaRepository;
    private final TrayectoriaProfesionalRepository trayectoriaProfesionalRepository;
    private final EstanciaRepository estanciaRepository;
    private final CongresoRepository congresoRepository;
    private final DivulgacionRepository divulgacionRepository;
    private static final String EVIDENCIA_RUBRO_PREFIX = "EVIDENCIA__";
    private static final Set<String> RUBROS_EVIDENCIA_VALIDOS = Set.of(
            "institucion",
            "areaConocimiento",
            "certs",
            "cursos",
            "herramientas",
            "idiomas",
            "logros",
            "articulos",
            "pi",
            "incidencia",
            "trayAcademica",
            "trayProfesional",
            "estancias",
            "congresos",
            "divulgacion"
    );

    /**
     * Resumen para "Mi perfil único SIIMEX":
     * - Rubros base de completar registro (persona, institución, área)
     * - Evidencias/documentos por rubro
     */
    @GetMapping("/rubros-perfil")
    public ResponseEntity<Map<String, Object>> getRubrosPerfil(Authentication auth) {
        Usuario usuario = getUsuario(auth);

        Map<String, Object> response = new HashMap<>();

        // Rubro 1: Persona principal
        Map<String, Object> persona = new HashMap<>();
        String nombreCompleto = java.util.stream.Stream.of(
                usuario.getNombre(),
                usuario.getApellidoPaterno(),
                usuario.getApellidoMaterno()
        ).filter(v -> v != null && !v.isBlank()).collect(Collectors.joining(" "));

        persona.put("nombreCompleto", nombreCompleto);
        persona.put("email", usuario.getAuthUser() != null ? usuario.getAuthUser().getEmail() : null);

        if (usuario.getRegistro1() != null) {
            persona.put("curp", usuario.getRegistro1().getCurp());
            persona.put("rfc", usuario.getRegistro1().getRfc());
            persona.put("telefono", usuario.getRegistro1().getTelefono());
            persona.put("tipoPerfil", usuario.getRegistro1().getTipoPerfil() != null ? usuario.getRegistro1().getTipoPerfil().name() : null);
        } else {
            persona.put("curp", null);
            persona.put("rfc", null);
            persona.put("telefono", null);
            persona.put("tipoPerfil", null);
        }

        String semblanza = usuario.getSemblanza();
        if (semblanza == null || semblanza.isBlank()) {
            semblanza = interesHabilidadRepository.findByUsuarioId(usuario.getId())
                    .map(InteresHabilidad::getInteresDescripcion)
                    .orElse(null);
        }
        persona.put("semblanza", semblanza);
        response.put("personaPrincipal", persona);

        // Rubro 2: Institución
        Map<String, Object> institucionDTO = new HashMap<>();
        Institucion institucion = institucionRepository.findByUsuarioId(usuario.getId()).stream().findFirst().orElse(null);
        if (institucion != null) {
            institucionDTO.put("nombre", institucion.getNombre());
            institucionDTO.put("claveOficial", institucion.getClaveOficial());
            institucionDTO.put("tipoNombre", institucion.getTipoNombre());
            institucionDTO.put("paisNombre", institucion.getPaisNombre());
            institucionDTO.put("entidadNombre", institucion.getEntidadNombre());
            institucionDTO.put("municipioNombre", institucion.getMunicipioNombre());
            institucionDTO.put("nivelUnoNombre", institucion.getNivelUnoNombre());
            institucionDTO.put("nivelDosNombre", institucion.getNivelDosNombre());
        }
        response.put("institucion", institucionDTO);

        // Rubro 3: Área de conocimiento
        Map<String, Object> areaDTO = new HashMap<>();
        AreaConocimiento area = areaConocimientoRepository.findByUsuarioId(usuario.getId()).stream().findFirst().orElse(null);
        if (area != null) {
            areaDTO.put("areaNombre", area.getAreaNombre());
            areaDTO.put("areaClave", area.getAreaClave());
            areaDTO.put("campoNombre", area.getCampoNombre());
            areaDTO.put("campoClave", area.getCampoClave());
            areaDTO.put("disciplinaNombre", area.getDisciplinaNombre());
            areaDTO.put("disciplinaClave", area.getDisciplinaClave());
            areaDTO.put("subdisciplinaNombre", area.getSubdisciplinaNombre());
            areaDTO.put("subdisciplinaClave", area.getSubdisciplinaClave());
        }
        response.put("areaConocimiento", areaDTO);

        // Evidencias de documentos por tipo
        List<Documento> documentos = documentoService.obtenerDocumentosPorUsuario(usuario.getId());
        Map<String, Object> evidencias = new HashMap<>();
        evidencias.put("curriculum", mapDocumentoResumen(obtenerDocumentoPreferente(documentos, Documento.TipoDocumento.CURRICULUM, Documento.TipoDocumento.CV)));
        evidencias.put("ine", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.FISCAL_PDF)));
        evidencias.put("domicilio", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.DOMICILIO)));
        evidencias.put("cedula", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CEDULA_PROFESIONAL)));
        evidencias.put("cert1", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CERTIFICADO_1)));
        evidencias.put("cert2", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CERTIFICADO_2)));
        evidencias.put("constanciaSnii", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CONSTANCIA_SNII)));
        evidencias.put("divulgacion", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.DIVULGACION)));
        response.put("evidencias", evidencias);

        return ResponseEntity.ok(response);
    }

    /**
     * Evidencias personalizadas por rubro para "Mi perfil único SIIMEX".
     * Se guardan como documentos tipo OTRO con prefijo EVIDENCIA__{rubro}__...
     */
    @GetMapping("/evidencias")
    public ResponseEntity<Map<String, List<Map<String, Object>>>> getEvidenciasRubros(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        List<Documento> documentos = documentoService.obtenerDocumentosPorUsuario(usuario.getId());

        Map<String, List<Map<String, Object>>> response = new LinkedHashMap<>();
        RUBROS_EVIDENCIA_VALIDOS.forEach(rubro -> response.put(rubro, new ArrayList<>()));

        documentos.stream()
                .filter(this::esDocumentoEvidenciaRubro)
                .sorted(Comparator
                        .comparing(Documento::getFechaSubida, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(Documento::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .forEach(doc -> {
                    String rubro = extraerRubroDeNombreEvidencia(doc.getNombreArchivo());
                    if (rubro == null || !response.containsKey(rubro)) {
                        return;
                    }
                    Map<String, Object> dto = mapDocumentoResumen(doc);
                    dto.put("nombre", extraerNombreVisibleEvidencia(doc.getNombreArchivo()));
                    dto.put("rubroId", rubro);
                    dto.put("esEvidenciaRubro", true);
                    response.get(rubro).add(dto);
                });

        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/evidencias/{rubroId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadEvidenciaRubro(
            Authentication auth,
            @PathVariable String rubroId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "nombre", required = false) String nombre
    ) {
        Usuario usuario = getUsuario(auth);
        String rubroCanonico = normalizarYValidarRubroEvidencia(rubroId);

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debe seleccionar un archivo de evidencia");
        }
        if (!esArchivoPdf(file)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo se permiten archivos PDF para evidencias por rubro");
        }

        String nombreBase = (nombre != null && !nombre.isBlank())
                ? nombre.trim()
                : (file.getOriginalFilename() != null ? file.getOriginalFilename() : "evidencia");
        String nombreSanitizado = sanitizarNombreArchivo(nombreBase);
        if (!nombreSanitizado.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            nombreSanitizado = nombreSanitizado + ".pdf";
        }
        String nombreArchivo = EVIDENCIA_RUBRO_PREFIX + rubroCanonico + "__" + System.currentTimeMillis() + "__" + nombreSanitizado;

        try {
            Documento documento = documentoService.guardarDocumento(
                    usuario.getId(),
                    file,
                    Documento.TipoDocumento.OTRO,
                    nombreArchivo,
                    false
            );
            Map<String, Object> dto = mapDocumentoResumen(documento);
            dto.put("nombre", extraerNombreVisibleEvidencia(documento.getNombreArchivo()));
            dto.put("rubroId", rubroCanonico);
            dto.put("esEvidenciaRubro", true);
            return ResponseEntity.ok(dto);
        } catch (IOException e) {
            log.error("Error al subir evidencia de rubro {}", rubroCanonico, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar la evidencia");
        }
    }

    @DeleteMapping("/evidencias/{rubroId}/{documentoId}")
    public ResponseEntity<Void> deleteEvidenciaRubro(
            Authentication auth,
            @PathVariable String rubroId,
            @PathVariable Long documentoId
    ) {
        Usuario usuario = getUsuario(auth);
        String rubroCanonico = normalizarYValidarRubroEvidencia(rubroId);

        Documento documento = documentoService.obtenerDocumento(documentoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidencia no encontrada"));

        if (!documento.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }

        if (documento.getTipo() != Documento.TipoDocumento.OTRO || !esDocumentoEvidenciaRubro(documento)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El documento no corresponde a evidencia de rubro");
        }

        String rubroDocumento = extraerRubroDeNombreEvidencia(documento.getNombreArchivo());
        if (rubroDocumento == null || !rubroDocumento.equals(rubroCanonico)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La evidencia no pertenece al rubro indicado");
        }

        documentoService.eliminarDocumento(documentoId, usuario.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/institucion")
    public ResponseEntity<Map<String, Object>> saveInstitucion(
            Authentication auth,
            @RequestBody Map<String, Object> body
    ) {
        Usuario usuario = getUsuario(auth);

        String nombre = getString(body, "nombre");
        if (nombre == null || nombre.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre de la institución es requerido");
        }

        Institucion institucion = institucionRepository.findByUsuarioId(usuario.getId()).stream().findFirst().orElse(null);
        if (institucion == null) {
            institucion = new Institucion();
            institucion.setUsuario(usuario);
        }

        institucion.setNombre(nombre.trim());
        institucion.setClaveOficial(getString(body, "claveOficial"));
        institucion.setTipoNombre(getString(body, "tipoNombre"));
        institucion.setPaisNombre(getString(body, "paisNombre"));
        institucion.setEntidadNombre(getString(body, "entidadNombre"));
        institucion.setMunicipioNombre(getString(body, "municipioNombre"));
        institucion.setNivelUnoNombre(getString(body, "nivelUnoNombre"));
        institucion.setNivelDosNombre(getString(body, "nivelDosNombre"));

        institucion = institucionRepository.save(institucion);
        return ResponseEntity.ok(mapInstitucionToDTO(institucion));
    }

    @DeleteMapping("/institucion")
    public ResponseEntity<Void> deleteInstitucion(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        institucionRepository.findByUsuarioId(usuario.getId()).forEach(institucionRepository::delete);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/area-conocimiento")
    public ResponseEntity<Map<String, Object>> saveAreaConocimiento(
            Authentication auth,
            @RequestBody Map<String, Object> body
    ) {
        Usuario usuario = getUsuario(auth);

        AreaConocimiento area = areaConocimientoRepository.findByUsuarioId(usuario.getId()).stream().findFirst().orElse(null);
        if (area == null) {
            area = new AreaConocimiento();
            area.setUsuario(usuario);
        }

        area.setAreaNombre(getString(body, "areaNombre"));
        area.setAreaClave(getString(body, "areaClave"));
        area.setCampoNombre(getString(body, "campoNombre"));
        area.setCampoClave(getString(body, "campoClave"));
        area.setDisciplinaNombre(getString(body, "disciplinaNombre"));
        area.setDisciplinaClave(getString(body, "disciplinaClave"));
        area.setSubdisciplinaNombre(getString(body, "subdisciplinaNombre"));
        area.setSubdisciplinaClave(getString(body, "subdisciplinaClave"));

        area = areaConocimientoRepository.save(area);
        return ResponseEntity.ok(mapAreaConocimientoToDTO(area));
    }

    @DeleteMapping("/area-conocimiento")
    public ResponseEntity<Void> deleteAreaConocimiento(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        areaConocimientoRepository.findByUsuarioId(usuario.getId()).forEach(areaConocimientoRepository::delete);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtener todos los cursos del usuario autenticado
     */
    @GetMapping("/cursos")
    public ResponseEntity<List<Map<String, Object>>> getCursos(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        List<Curso> cursos = cursoRepository.findByUsuarioId(usuario.getId());
        List<Map<String, Object>> cursosDTO = cursos.stream().map(this::mapCursoToDTO).collect(Collectors.toList());
        return ResponseEntity.ok(cursosDTO);
    }

    /**
     * Crear o actualizar un curso
     */
    @PostMapping("/cursos")
    public ResponseEntity<Map<String, Object>> saveCurso(
            Authentication auth,
            @RequestBody Map<String, Object> cursoData) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Curso curso;
        if (cursoData.containsKey("id") && cursoData.get("id") != null) {
            // Actualizar curso existente
            Long cursoId = Long.valueOf(cursoData.get("id").toString());
            curso = cursoRepository.findById(cursoId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Curso no encontrado"));
            if (!curso.getUsuario().getId().equals(usuario.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
            }
        } else {
            // Crear nuevo curso
            curso = new Curso();
            curso.setUsuario(usuario);
        }

        // Actualizar campos
        if (cursoData.containsKey("nombre")) curso.setNombre(cursoData.get("nombre").toString());
        if (cursoData.containsKey("programa")) curso.setPrograma(cursoData.get("programa").toString());
        if (cursoData.containsKey("horasTotales")) {
            Object horas = cursoData.get("horasTotales");
            if (horas != null) curso.setHorasTotales(Integer.valueOf(horas.toString()));
        }
        if (cursoData.containsKey("fechaInicio")) {
            String fechaStr = cursoData.get("fechaInicio").toString();
            if (!fechaStr.isEmpty()) curso.setFechaInicio(LocalDate.parse(fechaStr));
        }
        if (cursoData.containsKey("fechaFin")) {
            String fechaStr = cursoData.get("fechaFin").toString();
            if (!fechaStr.isEmpty()) curso.setFechaFin(LocalDate.parse(fechaStr));
        }
        if (cursoData.containsKey("institucion")) curso.setInstitucion(cursoData.get("institucion").toString());
        if (cursoData.containsKey("nivelEscolaridad")) curso.setNivelEscolaridad(cursoData.get("nivelEscolaridad").toString());

        curso = cursoRepository.save(curso);
        return ResponseEntity.ok(mapCursoToDTO(curso));
    }

    /**
     * Eliminar un curso
     */
    @DeleteMapping("/cursos/{id}")
    public ResponseEntity<Void> deleteCurso(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Curso curso = cursoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Curso no encontrado"));
        if (!curso.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }

        cursoRepository.delete(curso);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtener todos los idiomas del usuario
     */
    @GetMapping("/idiomas")
    public ResponseEntity<List<Map<String, Object>>> getIdiomas(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        List<Idioma> idiomas = idiomaRepository.findByUsuarioId(usuario.getId());
        List<Map<String, Object>> idiomasDTO = idiomas.stream().map(this::mapIdiomaToDTO).collect(Collectors.toList());
        return ResponseEntity.ok(idiomasDTO);
    }

    /**
     * Crear o actualizar un idioma
     */
    @PostMapping("/idiomas")
    public ResponseEntity<Map<String, Object>> saveIdioma(
            Authentication auth,
            @RequestBody Map<String, Object> idiomaData) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Idioma idioma;
        if (idiomaData.containsKey("id") && idiomaData.get("id") != null) {
            Long idiomaId = Long.valueOf(idiomaData.get("id").toString());
            idioma = idiomaRepository.findById(idiomaId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Idioma no encontrado"));
            if (!idioma.getUsuario().getId().equals(usuario.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
            }
        } else {
            idioma = new Idioma();
            idioma.setUsuario(usuario);
        }

        if (idiomaData.containsKey("nombre")) idioma.setNombre(idiomaData.get("nombre").toString());
        if (idiomaData.containsKey("dominioNombre")) idioma.setDominioNombre(idiomaData.get("dominioNombre").toString());
        if (idiomaData.containsKey("conversacion")) idioma.setConversacion(idiomaData.get("conversacion").toString());
        if (idiomaData.containsKey("lectura")) idioma.setLectura(idiomaData.get("lectura").toString());
        if (idiomaData.containsKey("escritura")) idioma.setEscritura(idiomaData.get("escritura").toString());
        if (idiomaData.containsKey("esCertificado")) {
            idioma.setEsCertificado(Boolean.valueOf(idiomaData.get("esCertificado").toString()));
        }
        if (idiomaData.containsKey("certInstitucion")) idioma.setCertInstitucion(idiomaData.get("certInstitucion").toString());
        if (idiomaData.containsKey("certPuntuacion")) idioma.setCertPuntuacion(idiomaData.get("certPuntuacion").toString());
        if (idiomaData.containsKey("vigenciaFin")) {
            String fechaStr = idiomaData.get("vigenciaFin").toString();
            if (!fechaStr.isEmpty()) idioma.setVigenciaFin(LocalDate.parse(fechaStr));
        }

        idioma = idiomaRepository.save(idioma);
        return ResponseEntity.ok(mapIdiomaToDTO(idioma));
    }

    /**
     * Eliminar un idioma
     */
    @DeleteMapping("/idiomas/{id}")
    public ResponseEntity<Void> deleteIdioma(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Idioma idioma = idiomaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Idioma no encontrado"));
        if (!idioma.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }

        idiomaRepository.delete(idioma);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtener todos los logros del usuario
     */
    @GetMapping("/logros")
    public ResponseEntity<List<Map<String, Object>>> getLogros(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        List<Logro> logros = logroRepository.findByUsuarioId(usuario.getId());
        List<Map<String, Object>> logrosDTO = logros.stream().map(this::mapLogroToDTO).collect(Collectors.toList());
        return ResponseEntity.ok(logrosDTO);
    }

    /**
     * Crear o actualizar un logro
     */
    @PostMapping("/logros")
    public ResponseEntity<Map<String, Object>> saveLogro(
            Authentication auth,
            @RequestBody Map<String, Object> logroData) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Logro logro;
        if (logroData.containsKey("id") && logroData.get("id") != null) {
            Long logroId = Long.valueOf(logroData.get("id").toString());
            logro = logroRepository.findById(logroId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Logro no encontrado"));
            if (!logro.getUsuario().getId().equals(usuario.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
            }
        } else {
            logro = new Logro();
            logro.setUsuario(usuario);
        }

        if (logroData.containsKey("tipo")) logro.setTipo(logroData.get("tipo").toString());
        if (logroData.containsKey("nombre")) logro.setNombre(logroData.get("nombre").toString());
        if (logroData.containsKey("anio")) {
            Object anio = logroData.get("anio");
            if (anio != null) logro.setAnio(Integer.valueOf(anio.toString()));
        }

        logro = logroRepository.save(logro);
        return ResponseEntity.ok(mapLogroToDTO(logro));
    }

    /**
     * Eliminar un logro
     */
    @DeleteMapping("/logros/{id}")
    public ResponseEntity<Void> deleteLogro(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Logro logro = logroRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Logro no encontrado"));
        if (!logro.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }

        logroRepository.delete(logro);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtener certificaciones (documentos tipo CERTIFICADO y OTRO con nombre que empiece con CERTIFICADO_)
     */
    @GetMapping("/certificaciones")
    public ResponseEntity<List<Map<String, Object>>> getCertificaciones(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        // Obtener todos los documentos de tipo CERTIFICADO y OTRO que sean certificaciones
        List<Documento> todosDocumentos = documentoService.obtenerDocumentosPorUsuario(usuario.getId());
        
        log.info("Total documentos del usuario {}: {}", usuario.getId(), todosDocumentos.size());
        
        List<Documento> certificados = todosDocumentos.stream()
                .filter(doc -> {
                    if (doc.getNombreArchivo() == null) {
                        log.debug("Documento {} sin nombre, descartado", doc.getId());
                        return false;
                    }
                    String nombre = doc.getNombreArchivo().toUpperCase();
                    // Incluir todos los tipos CERTIFICADO (CERTIFICADO_1, CERTIFICADO_2)
                    // y OTRO que tenga nombre que empiece con CERTIFICADO_, OTRO_CERTIFICADO_, o CERTIFICACIONES_
                    // También incluir cualquier documento cuyo nombre contenga CERTIFICADO o CERTIFICACIONES (más flexible)
                    boolean esCertificado = doc.getTipo() == Documento.TipoDocumento.CERTIFICADO_1 
                            || doc.getTipo() == Documento.TipoDocumento.CERTIFICADO_2
                            || (doc.getTipo() == Documento.TipoDocumento.OTRO 
                                && (nombre.startsWith("CERTIFICADO_") 
                                    || nombre.startsWith("OTRO_CERTIFICADO_")
                                    || nombre.startsWith("CERTIFICACIONES_")
                                    || nombre.contains("CERTIFICADO")
                                    || nombre.contains("CERTIFICACIONES")));
                    
                    if (esCertificado) {
                        log.debug("Certificado encontrado - ID: {}, Tipo: {}, Nombre: {}, ContentType: {}", 
                                doc.getId(), doc.getTipo(), doc.getNombreArchivo(), doc.getContentType());
                    } else {
                        log.debug("Documento descartado - ID: {}, Tipo: {}, Nombre: {}", 
                                doc.getId(), doc.getTipo(), doc.getNombreArchivo());
                    }
                    return esCertificado;
                })
                .sorted((a, b) -> {
                    // Ordenar por fecha de subida (más recientes primero)
                    if (a.getFechaSubida() != null && b.getFechaSubida() != null) {
                        return b.getFechaSubida().compareTo(a.getFechaSubida());
                    }
                    return 0;
                })
                .collect(Collectors.toList());
        
        log.info("Certificados encontrados para usuario {}: {}", usuario.getId(), certificados.size());
        certificados.forEach(cert -> {
            log.info("  - Certificado ID: {}, Tipo: {}, Nombre: {}, ContentType: {}", 
                    cert.getId(), cert.getTipo(), cert.getNombreArchivo(), cert.getContentType());
        });
        
        List<Map<String, Object>> certsDTO = certificados.stream().map(doc -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", doc.getId());
            // Limpiar el nombre para mostrar (remover prefijos CERTIFICACIONES_X_, OTRO_CERTIFICADO_, CERTIFICADO_X_)
            String nombreMostrar = doc.getNombreArchivo();
            String nombreUpper = nombreMostrar.toUpperCase();
            
            // Remover prefijo CERTIFICACIONES_X_ (nuevo formato)
            if (nombreUpper.startsWith("CERTIFICACIONES_")) {
                // Encontrar el número y el siguiente guion bajo
                int indice = nombreMostrar.indexOf('_', "CERTIFICACIONES_".length());
                if (indice > 0) {
                    int siguienteIndice = nombreMostrar.indexOf('_', indice + 1);
                    if (siguienteIndice > 0) {
                        nombreMostrar = nombreMostrar.substring(siguienteIndice + 1);
                    } else {
                        nombreMostrar = nombreMostrar.substring(indice + 1);
                    }
                }
            }
            // Remover prefijo OTRO_CERTIFICADO_
            else if (nombreUpper.startsWith("OTRO_CERTIFICADO_")) {
                nombreMostrar = nombreMostrar.substring("OTRO_CERTIFICADO_".length());
            } 
            // Remover prefijo CERTIFICADO_X_ (donde X puede ser 1, 2, 3, etc.)
            else if (nombreUpper.matches("^CERTIFICADO_\\d+_.*")) {
                // Encontrar el primer guion bajo después de CERTIFICADO_ y el número
                int indice = nombreMostrar.indexOf('_', "CERTIFICADO_".length());
                if (indice > 0) {
                    int siguienteIndice = nombreMostrar.indexOf('_', indice + 1);
                    if (siguienteIndice > 0) {
                        nombreMostrar = nombreMostrar.substring(siguienteIndice + 1);
                    } else {
                        // Si no hay más guiones bajos, solo remover hasta el primer número
                        nombreMostrar = nombreMostrar.substring(indice + 1);
                    }
                }
            }
            // Remover prefijo CERTIFICADO_ simple (sin número)
            else if (nombreUpper.startsWith("CERTIFICADO_")) {
                nombreMostrar = nombreMostrar.substring("CERTIFICADO_".length());
            }
            
            dto.put("nombre", nombreMostrar);
            dto.put("nombreCompleto", doc.getNombreArchivo());
            dto.put("tipo", doc.getTipo().name());
            dto.put("contentType", doc.getContentType());
            dto.put("fechaSubida", doc.getFechaSubida());
            dto.put("sizeBytes", doc.getSizeBytes());
            return dto;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(certsDTO);
    }

    /**
     * Subir certificación (permite múltiples certificaciones)
     */
    @PostMapping("/certificaciones")
    public ResponseEntity<Map<String, Object>> uploadCertificacion(
            Authentication auth,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "nombre", required = false) String nombre) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debe seleccionar un archivo");
        }
        if (!esArchivoPdf(file)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo se permiten archivos PDF");
        }

        try {
            String nombreOriginal = file.getOriginalFilename();
            
            // Obtener todas las certificaciones existentes para determinar el siguiente número
            List<Documento> certsExistentes = documentoService.obtenerDocumentosPorUsuario(usuario.getId()).stream()
                    .filter(doc -> {
                        if (doc.getNombreArchivo() == null) return false;
                        String nombreArchivo = doc.getNombreArchivo().toUpperCase();
                        return doc.getTipo() == Documento.TipoDocumento.CERTIFICADO_1 
                                || doc.getTipo() == Documento.TipoDocumento.CERTIFICADO_2
                                || (doc.getTipo() == Documento.TipoDocumento.OTRO 
                                    && (nombreArchivo.startsWith("CERTIFICADO_") 
                                        || nombreArchivo.startsWith("OTRO_CERTIFICADO_")
                                        || nombreArchivo.startsWith("CERTIFICACIONES_")
                                        || nombreArchivo.contains("CERTIFICADO")));
                    })
                    .collect(Collectors.toList());
            
            // Determinar el siguiente número de certificación
            int siguienteNumero = certsExistentes.size() + 1;
            
            // Construir nombre del archivo con prefijo CERTIFICACIONES_ y número
            String nombreBase;
            if (nombre != null && !nombre.isEmpty()) {
                nombreBase = nombre;
            } else {
                nombreBase = nombreOriginal != null ? nombreOriginal : "certificado_" + System.currentTimeMillis() + ".pdf";
            }
            
            // Asegurar extensión PDF en el nombre visible guardado
            if (!nombreBase.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
                nombreBase = nombreBase + ".pdf";
            }
            
            String nombreArchivo = "CERTIFICACIONES_" + siguienteNumero + "_" + nombreBase;
            
            log.info("Guardando certificación PDF - Nombre original: {}, Nombre base: {}, Número: {}, Nombre final: {}, ContentType: {}", 
                    nombreOriginal, nombreBase, siguienteNumero, nombreArchivo, file.getContentType());

            Documento documento = documentoService.guardarDocumento(
                    usuario.getId(),
                    file,
                    Documento.TipoDocumento.OTRO,
                    nombreArchivo,
                    false // NO eliminar anteriores, permitir múltiples
            );

            Map<String, Object> response = new HashMap<>();
            response.put("id", documento.getId());
            // Limpiar el nombre para mostrar (remover prefijos)
            String nombreMostrar = documento.getNombreArchivo();
            String nombreUpper = nombreMostrar.toUpperCase();
            
            // Remover prefijo CERTIFICACIONES_X_ (nuevo formato)
            if (nombreUpper.startsWith("CERTIFICACIONES_")) {
                int indice = nombreMostrar.indexOf('_', "CERTIFICACIONES_".length());
                if (indice > 0) {
                    int siguienteIndice = nombreMostrar.indexOf('_', indice + 1);
                    if (siguienteIndice > 0) {
                        nombreMostrar = nombreMostrar.substring(siguienteIndice + 1);
                    } else {
                        nombreMostrar = nombreMostrar.substring(indice + 1);
                    }
                }
            }
            // Remover prefijo OTRO_CERTIFICADO_
            else if (nombreUpper.startsWith("OTRO_CERTIFICADO_")) {
                nombreMostrar = nombreMostrar.substring("OTRO_CERTIFICADO_".length());
            }
            response.put("nombre", nombreMostrar);
            response.put("nombreCompleto", documento.getNombreArchivo());
            response.put("tipo", documento.getTipo().name());
            response.put("contentType", documento.getContentType());
            response.put("fechaSubida", documento.getFechaSubida());
            response.put("sizeBytes", documento.getSizeBytes());
            
            log.info("Certificación guardada exitosamente - ID: {}, Nombre: {}, ContentType: {}", 
                    documento.getId(), documento.getNombreArchivo(), documento.getContentType());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error al subir certificación", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error al subir certificación");
        }
    }

    /**
     * Eliminar certificación
     */
    @DeleteMapping("/certificaciones/{id}")
    public ResponseEntity<Void> deleteCertificacion(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        documentoService.eliminarDocumento(id, usuario.getId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtener herramientas del usuario
     */
    @GetMapping("/herramientas")
    public ResponseEntity<List<Map<String, Object>>> getHerramientas(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        List<Herramienta> herramientas = herramientaRepository.findByUsuarioId(usuario.getId());
        List<Map<String, Object>> herramientasDTO = herramientas.stream().map(h -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", h.getId());
            dto.put("nombre", h.getNombre());
            return dto;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(herramientasDTO);
    }

    /**
     * Guardar herramientas (reemplaza todas las existentes)
     */
    @PostMapping("/herramientas")
    public ResponseEntity<List<Map<String, Object>>> saveHerramientas(
            Authentication auth,
            @RequestBody List<String> herramientasNombres) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        // Validar máximo 12 herramientas
        if (herramientasNombres.size() > 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo 12 herramientas permitidas");
        }

        // Eliminar herramientas existentes
        List<Herramienta> herramientasExistentes = herramientaRepository.findByUsuarioId(usuario.getId());
        herramientaRepository.deleteAll(herramientasExistentes);

        // Guardar nuevas herramientas
        List<Herramienta> nuevasHerramientas = herramientasNombres.stream()
                .filter(nombre -> nombre != null && !nombre.trim().isEmpty())
                .map(nombre -> Herramienta.builder()
                        .usuario(usuario)
                        .nombre(nombre.trim())
                        .build())
                .collect(Collectors.toList());

        herramientaRepository.saveAll(nuevasHerramientas);

        // Retornar herramientas guardadas
        List<Map<String, Object>> herramientasDTO = nuevasHerramientas.stream().map(h -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", h.getId());
            dto.put("nombre", h.getNombre());
            return dto;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(herramientasDTO);
    }

    /**
     * Agregar una herramienta individual
     */
    @PostMapping("/herramientas/agregar")
    public ResponseEntity<Map<String, Object>> agregarHerramienta(
            Authentication auth,
            @RequestBody Map<String, String> request) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        String nombre = request.get("nombre");
        if (nombre == null || nombre.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre de la herramienta es requerido");
        }

        // Verificar máximo 12 herramientas
        List<Herramienta> herramientasExistentes = herramientaRepository.findByUsuarioId(usuario.getId());
        if (herramientasExistentes.size() >= 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo 12 herramientas permitidas");
        }

        // Verificar si ya existe
        herramientaRepository.findByUsuarioIdAndNombre(usuario.getId(), nombre.trim())
                .ifPresent(h -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta herramienta ya está registrada");
                });

        Herramienta herramienta = Herramienta.builder()
                .usuario(usuario)
                .nombre(nombre.trim())
                .build();

        herramienta = herramientaRepository.save(herramienta);

        Map<String, Object> dto = new HashMap<>();
        dto.put("id", herramienta.getId());
        dto.put("nombre", herramienta.getNombre());
        return ResponseEntity.ok(dto);
    }

    /**
     * Eliminar una herramienta
     */
    @DeleteMapping("/herramientas/{id}")
    public ResponseEntity<Void> eliminarHerramienta(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Herramienta herramienta = herramientaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Herramienta no encontrada"));
        if (!herramienta.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }

        herramientaRepository.delete(herramienta);
        return ResponseEntity.noContent().build();
    }

    // ==================== INCIDENCIA SOCIAL ====================

    @GetMapping("/incidencia-social")
    public ResponseEntity<List<Map<String, Object>>> getIncidenciaSocial(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        List<IncidenciaSocial> list = incidenciaSocialRepository.findByUsuarioId(usuario.getId());
        List<Map<String, Object>> dtoList = list.stream().map(this::mapIncidenciaSocialToDTO).collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    @PostMapping("/incidencia-social")
    public ResponseEntity<Map<String, Object>> saveIncidenciaSocial(
            Authentication auth,
            @RequestBody Map<String, Object> data) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        String titulo = data.get("titulo") != null ? data.get("titulo").toString().trim() : null;
        if (titulo == null || titulo.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El título es requerido");
        }

        IncidenciaSocial inc;
        if (data.containsKey("id") && data.get("id") != null) {
            Long id = Long.valueOf(data.get("id").toString());
            inc = incidenciaSocialRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incidencia social no encontrada"));
            if (!inc.getUsuario().getId().equals(usuario.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
            }
        } else {
            inc = new IncidenciaSocial();
            inc.setUsuario(usuario);
        }

        inc.setTitulo(titulo);
        inc.setUbicacion(data.get("ubicacion") != null ? data.get("ubicacion").toString().trim() : null);
        inc.setDescripcion(data.get("descripcion") != null ? data.get("descripcion").toString() : null);
        if (data.get("fecha") != null && !data.get("fecha").toString().isEmpty()) {
            try {
                inc.setFecha(LocalDate.parse(data.get("fecha").toString()));
            } catch (Exception ignored) {}
        } else {
            inc.setFecha(null);
        }
        if (data.get("anio") != null && !data.get("anio").toString().isEmpty()) {
            try {
                inc.setAnio(Integer.valueOf(data.get("anio").toString()));
            } catch (Exception ignored) {}
        } else {
            inc.setAnio(null);
        }

        inc = incidenciaSocialRepository.save(inc);
        return ResponseEntity.ok(mapIncidenciaSocialToDTO(inc));
    }

    @DeleteMapping("/incidencia-social/{id}")
    public ResponseEntity<Void> deleteIncidenciaSocial(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        IncidenciaSocial inc = incidenciaSocialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incidencia social no encontrada"));
        if (!inc.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }
        incidenciaSocialRepository.delete(inc);
        return ResponseEntity.noContent().build();
    }

    // ==================== PROPIEDAD INTELECTUAL ====================

    @GetMapping("/propiedad-intelectual")
    public ResponseEntity<List<Map<String, Object>>> getPropiedadIntelectual(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        List<PropiedadIntelectual> list = propiedadIntelectualRepository.findByUsuarioId(usuario.getId());
        List<Map<String, Object>> dtoList = list.stream().map(this::mapPropiedadIntelectualToDTO).collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    @PostMapping("/propiedad-intelectual")
    public ResponseEntity<Map<String, Object>> savePropiedadIntelectual(
            Authentication auth,
            @RequestBody Map<String, Object> data) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        String titulo = data.get("titulo") != null ? data.get("titulo").toString().trim() : null;
        if (titulo == null || titulo.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El título es requerido");
        }
        String tipoStr = data.get("tipo") != null ? data.get("tipo").toString().trim().toUpperCase() : null;
        if (tipoStr == null || tipoStr.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tipo es requerido");
        }
        PropiedadIntelectual.Tipo tipo;
        try {
            tipo = PropiedadIntelectual.Tipo.valueOf(tipoStr.replace(" ", "_").replace("Í", "I"));
        } catch (IllegalArgumentException e) {
            tipo = PropiedadIntelectual.Tipo.OTRO;
        }

        PropiedadIntelectual pi;
        if (data.containsKey("id") && data.get("id") != null) {
            Long id = Long.valueOf(data.get("id").toString());
            pi = propiedadIntelectualRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Propiedad intelectual no encontrada"));
            if (!pi.getUsuario().getId().equals(usuario.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
            }
        } else {
            pi = new PropiedadIntelectual();
            pi.setUsuario(usuario);
        }

        pi.setTipo(tipo);
        pi.setTitulo(titulo);
        pi.setNumeroRegistro(data.get("numeroRegistro") != null ? data.get("numeroRegistro").toString().trim() : null);
        pi.setInstitucionOficina(data.get("institucionOficina") != null ? data.get("institucionOficina").toString().trim() : null);
        pi.setPais(data.get("pais") != null ? data.get("pais").toString().trim() : null);
        pi.setDescripcion(data.get("descripcion") != null ? data.get("descripcion").toString() : null);
        if (data.get("fechaRegistro") != null && !data.get("fechaRegistro").toString().isEmpty()) {
            try {
                pi.setFechaRegistro(LocalDate.parse(data.get("fechaRegistro").toString()));
            } catch (Exception ignored) {}
        } else {
            pi.setFechaRegistro(null);
        }
        if (data.get("anio") != null && !data.get("anio").toString().isEmpty()) {
            try {
                pi.setAnio(Integer.valueOf(data.get("anio").toString()));
            } catch (Exception ignored) {}
        } else {
            pi.setAnio(null);
        }
        if (data.get("documentoId") != null && !data.get("documentoId").toString().isEmpty()) {
            try {
                Long documentoId = Long.valueOf(data.get("documentoId").toString());
                Documento documento = documentoService.obtenerDocumento(documentoId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Documento no encontrado"));
                if (documento.getUsuario() == null || !documento.getUsuario().getId().equals(usuario.getId())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Documento no autorizado");
                }
                pi.setDocumentoId(documentoId);
            } catch (ResponseStatusException e) {
                throw e;
            } catch (Exception ignored) {}
        } else {
            pi.setDocumentoId(null);
        }

        pi = propiedadIntelectualRepository.save(pi);
        return ResponseEntity.ok(mapPropiedadIntelectualToDTO(pi));
    }

    @DeleteMapping("/propiedad-intelectual/{id}")
    public ResponseEntity<Void> deletePropiedadIntelectual(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        PropiedadIntelectual pi = propiedadIntelectualRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Propiedad intelectual no encontrada"));
        if (!pi.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }
        propiedadIntelectualRepository.delete(pi);
        return ResponseEntity.noContent().build();
    }

    /**
     * Subir documento adjunto para propiedad intelectual (opcional).
     * Retorna el documentoId para incluirlo al guardar/actualizar el registro PI.
     */
    @PostMapping(value = "/propiedad-intelectual/documento", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadDocumentoPI(
            Authentication auth,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "nombre", required = false) String nombre) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debe seleccionar un archivo");
        }
        if (!esArchivoPdf(file)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo se permiten archivos PDF");
        }

        try {
            List<Documento> docsPI = documentoService.obtenerDocumentosPorUsuario(usuario.getId()).stream()
                    .filter(d -> d.getNombreArchivo() != null && d.getNombreArchivo().toUpperCase().startsWith("PI_"))
                    .collect(Collectors.toList());
            int num = docsPI.size() + 1;
            String nombreOriginal = file.getOriginalFilename() != null ? file.getOriginalFilename() : "documento";
            String nombreBase = (nombre != null && !nombre.isEmpty()) ? nombre : nombreOriginal;
            if (!nombreBase.toLowerCase(Locale.ROOT).endsWith(".pdf")) nombreBase += ".pdf";
            String nombreArchivo = "PI_" + num + "_" + nombreBase;

            Documento doc = documentoService.guardarDocumento(
                    usuario.getId(), file, Documento.TipoDocumento.OTRO, nombreArchivo, false);

            Map<String, Object> resp = new HashMap<>();
            resp.put("id", doc.getId());
            resp.put("nombre", doc.getNombreArchivo());
            return ResponseEntity.ok(resp);
        } catch (IOException e) {
            log.error("Error al subir documento PI", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error al subir documento");
        }
    }

    private Map<String, Object> mapPropiedadIntelectualToDTO(PropiedadIntelectual pi) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", pi.getId());
        dto.put("tipo", pi.getTipo().name());
        dto.put("titulo", pi.getTitulo());
        dto.put("numeroRegistro", pi.getNumeroRegistro());
        dto.put("institucionOficina", pi.getInstitucionOficina());
        dto.put("pais", pi.getPais());
        dto.put("descripcion", pi.getDescripcion());
        dto.put("fechaRegistro", pi.getFechaRegistro() != null ? pi.getFechaRegistro().toString() : null);
        dto.put("anio", pi.getAnio());
        dto.put("documentoId", pi.getDocumentoId());
        return dto;
    }

    private Map<String, Object> mapIncidenciaSocialToDTO(IncidenciaSocial inc) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", inc.getId());
        dto.put("titulo", inc.getTitulo());
        dto.put("ubicacion", inc.getUbicacion());
        dto.put("descripcion", inc.getDescripcion());
        dto.put("fecha", inc.getFecha() != null ? inc.getFecha().toString() : null);
        dto.put("anio", inc.getAnio());
        return dto;
    }

    // Métodos auxiliares para mapear entidades a DTOs
    private Map<String, Object> mapCursoToDTO(Curso curso) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", curso.getId());
        dto.put("nombre", curso.getNombre());
        dto.put("programa", curso.getPrograma());
        dto.put("horasTotales", curso.getHorasTotales());
        dto.put("fechaInicio", curso.getFechaInicio());
        dto.put("fechaFin", curso.getFechaFin());
        dto.put("institucion", curso.getInstitucion());
        dto.put("nivelEscolaridad", curso.getNivelEscolaridad());
        return dto;
    }

    private Map<String, Object> mapIdiomaToDTO(Idioma idioma) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", idioma.getId());
        dto.put("nombre", idioma.getNombre());
        dto.put("dominioNombre", idioma.getDominioNombre());
        dto.put("conversacion", idioma.getConversacion());
        dto.put("lectura", idioma.getLectura());
        dto.put("escritura", idioma.getEscritura());
        dto.put("esCertificado", idioma.getEsCertificado());
        dto.put("certInstitucion", idioma.getCertInstitucion());
        dto.put("certPuntuacion", idioma.getCertPuntuacion());
        dto.put("vigenciaFin", idioma.getVigenciaFin());
        return dto;
    }

    private Map<String, Object> mapLogroToDTO(Logro logro) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", logro.getId());
        dto.put("tipo", logro.getTipo());
        dto.put("nombre", logro.getNombre());
        dto.put("anio", logro.getAnio());
        return dto;
    }

    /**
     * Obtener todos los artículos del usuario autenticado
     */
    @GetMapping("/articulos")
    public ResponseEntity<List<Map<String, Object>>> getArticulos(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        List<Articulo> articulos = articuloRepository.findByUsuarioId(usuario.getId());
        List<Map<String, Object>> articulosDTO = articulos.stream().map(this::mapArticuloToDTO).collect(Collectors.toList());
        return ResponseEntity.ok(articulosDTO);
    }

    /**
     * Crear o actualizar un artículo
     */
    @PostMapping("/articulos")
    public ResponseEntity<Map<String, Object>> saveArticulo(
            Authentication auth,
            @RequestBody Map<String, Object> articuloData) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Articulo articulo;
        if (articuloData.containsKey("id") && articuloData.get("id") != null) {
            // Actualizar artículo existente
            Long articuloId = Long.valueOf(articuloData.get("id").toString());
            articulo = articuloRepository.findById(articuloId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artículo no encontrado"));
            if (!articulo.getUsuario().getId().equals(usuario.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
            }
        } else {
            // Crear nuevo artículo
            articulo = new Articulo();
            articulo.setUsuario(usuario);
        }

        // Actualizar campos
        if (articuloData.containsKey("titulo")) articulo.setTitulo(articuloData.get("titulo").toString());
        if (articuloData.containsKey("revista")) articulo.setNombreRevista(articuloData.get("revista").toString());
        if (articuloData.containsKey("anio")) {
            Object anio = articuloData.get("anio");
            if (anio != null) articulo.setAnio(Integer.valueOf(anio.toString()));
        }
        if (articuloData.containsKey("doi")) articulo.setDoi(articuloData.get("doi").toString());
        if (articuloData.containsKey("url")) {
            // Si viene URL, podríamos guardarlo en algún campo adicional o ignorarlo
            // Por ahora lo ignoramos ya que la entidad no tiene campo URL
        }

        articulo = articuloRepository.save(articulo);
        return ResponseEntity.ok(mapArticuloToDTO(articulo));
    }

    /**
     * Eliminar un artículo
     */
    @DeleteMapping("/articulos/{id}")
    public ResponseEntity<Void> deleteArticulo(Authentication auth, @PathVariable Long id) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Articulo articulo = articuloRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artículo no encontrado"));
        if (!articulo.getUsuario().getId().equals(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }

        articuloRepository.delete(articulo);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> mapArticuloToDTO(Articulo articulo) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", articulo.getId());
        dto.put("titulo", articulo.getTitulo());
        dto.put("revista", articulo.getNombreRevista());
        dto.put("anio", articulo.getAnio());
        dto.put("doi", articulo.getDoi());
        if (articulo.getDoi() != null && !articulo.getDoi().isEmpty()) {
            dto.put("url", "https://doi.org/" + articulo.getDoi());
        }
        return dto;
    }

    // ========== TRAYECTORIA ACADÉMICA ==========

    @GetMapping("/academica")
    public ResponseEntity<List<Map<String, Object>>> getTrayAcademica(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        List<Map<String, Object>> result = trayectoriaAcademicaRepository.findByUsuarioId(usuario.getId()).stream().map(t -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", t.getId());
            dto.put("nivel", t.getNivelNombre());
            dto.put("titulo", t.getTitulo());
            dto.put("institucion", t.getInstitucion());
            dto.put("estatus", t.getEstatusNombre());
            dto.put("fechaObtencion", t.getFechaObtencion() != null ? t.getFechaObtencion().toString() : null);
            dto.put("cedulaProfesional", t.getCedulaProfesional());
            dto.put("esPerfilSnii", t.getEsPerfilSnii());
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/academica")
    public ResponseEntity<Map<String, Object>> saveTrayAcademica(Authentication auth, @RequestBody Map<String, Object> body) {
        Usuario usuario = getUsuario(auth);
        TrayectoriaAcademica entity;
        if (body.containsKey("id") && body.get("id") != null) {
            Long id = Long.valueOf(body.get("id").toString());
            entity = trayectoriaAcademicaRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (!entity.getUsuario().getId().equals(usuario.getId()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        } else {
            entity = new TrayectoriaAcademica();
            entity.setUsuario(usuario);
        }
        entity.setNivelNombre(getString(body, "nivel"));
        entity.setTitulo(getString(body, "titulo"));
        entity.setInstitucion(getString(body, "institucion"));
        entity.setEstatusNombre(getString(body, "estatus"));
        entity.setCedulaProfesional(getString(body, "cedulaProfesional"));
        Object esPerfilSnii = body.get("esPerfilSnii");
        if (esPerfilSnii instanceof Boolean b) {
            entity.setEsPerfilSnii(b);
        } else if (esPerfilSnii != null) {
            entity.setEsPerfilSnii(Boolean.parseBoolean(esPerfilSnii.toString()));
        } else {
            entity.setEsPerfilSnii(null);
        }
        String fecha = getString(body, "fechaObtencion");
        entity.setFechaObtencion(fecha != null ? LocalDate.parse(fecha) : null);
        trayectoriaAcademicaRepository.save(entity);
        return ResponseEntity.ok(Map.of("id", entity.getId()));
    }

    @DeleteMapping("/academica/{id}")
    public ResponseEntity<Void> deleteTrayAcademica(Authentication auth, @PathVariable Long id) {
        Usuario usuario = getUsuario(auth);
        TrayectoriaAcademica entity = trayectoriaAcademicaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entity.getUsuario().getId().equals(usuario.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        trayectoriaAcademicaRepository.delete(entity);
        return ResponseEntity.noContent().build();
    }

    // ========== TRAYECTORIA PROFESIONAL ==========

    @GetMapping("/profesional")
    public ResponseEntity<List<Map<String, Object>>> getTrayProfesional(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        List<Map<String, Object>> result = trayectoriaProfesionalRepository.findByUsuarioId(usuario.getId()).stream().map(t -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", t.getId());
            dto.put("nombramiento", t.getNombramiento());
            dto.put("institucion", t.getInstitucion());
            dto.put("fechaInicio", t.getFechaInicio() != null ? t.getFechaInicio().toString() : null);
            dto.put("fechaFin", t.getFechaFin() != null ? t.getFechaFin().toString() : null);
            dto.put("esActual", t.getEsActual());
            dto.put("logros", t.getLogros());
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/profesional")
    public ResponseEntity<Map<String, Object>> saveTrayProfesional(Authentication auth, @RequestBody Map<String, Object> body) {
        Usuario usuario = getUsuario(auth);
        TrayectoriaProfesional entity;
        if (body.containsKey("id") && body.get("id") != null) {
            Long id = Long.valueOf(body.get("id").toString());
            entity = trayectoriaProfesionalRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (!entity.getUsuario().getId().equals(usuario.getId()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        } else {
            entity = new TrayectoriaProfesional();
            entity.setUsuario(usuario);
        }
        entity.setNombramiento(getString(body, "nombramiento"));
        entity.setInstitucion(getString(body, "institucion"));
        String fi = getString(body, "fechaInicio");
        entity.setFechaInicio(fi != null ? LocalDate.parse(fi) : null);
        String ff = getString(body, "fechaFin");
        entity.setFechaFin(ff != null ? LocalDate.parse(ff) : null);
        entity.setEsActual(body.get("esActual") instanceof Boolean ? (Boolean) body.get("esActual") : false);
        entity.setLogros(getString(body, "logros"));
        trayectoriaProfesionalRepository.save(entity);
        return ResponseEntity.ok(Map.of("id", entity.getId()));
    }

    @DeleteMapping("/profesional/{id}")
    public ResponseEntity<Void> deleteTrayProfesional(Authentication auth, @PathVariable Long id) {
        Usuario usuario = getUsuario(auth);
        TrayectoriaProfesional entity = trayectoriaProfesionalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entity.getUsuario().getId().equals(usuario.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        trayectoriaProfesionalRepository.delete(entity);
        return ResponseEntity.noContent().build();
    }

    // ========== ESTANCIAS ==========

    @GetMapping("/estancias")
    public ResponseEntity<List<Map<String, Object>>> getEstancias(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        List<Map<String, Object>> result = estanciaRepository.findByUsuarioId(usuario.getId()).stream().map(e -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", e.getId());
            dto.put("tipo", e.getTipoNombre());
            dto.put("nombreProyecto", e.getNombreProyecto());
            dto.put("institucionReceptora", e.getInstitucionReceptora());
            dto.put("fechaInicio", e.getFechaInicio() != null ? e.getFechaInicio().toString() : null);
            dto.put("fechaFin", e.getFechaFin() != null ? e.getFechaFin().toString() : null);
            dto.put("logros", e.getLogros());
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/estancias")
    public ResponseEntity<Map<String, Object>> saveEstancia(Authentication auth, @RequestBody Map<String, Object> body) {
        Usuario usuario = getUsuario(auth);
        Estancia entity;
        if (body.containsKey("id") && body.get("id") != null) {
            Long id = Long.valueOf(body.get("id").toString());
            entity = estanciaRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (!entity.getUsuario().getId().equals(usuario.getId()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        } else {
            entity = new Estancia();
            entity.setUsuario(usuario);
        }
        entity.setTipoNombre(getString(body, "tipo"));
        entity.setNombreProyecto(getString(body, "nombreProyecto"));
        entity.setInstitucionReceptora(getString(body, "institucionReceptora"));
        String fi = getString(body, "fechaInicio");
        entity.setFechaInicio(fi != null ? LocalDate.parse(fi) : null);
        String ff = getString(body, "fechaFin");
        entity.setFechaFin(ff != null ? LocalDate.parse(ff) : null);
        entity.setLogros(getString(body, "logros"));
        estanciaRepository.save(entity);
        return ResponseEntity.ok(Map.of("id", entity.getId()));
    }

    @DeleteMapping("/estancias/{id}")
    public ResponseEntity<Void> deleteEstancia(Authentication auth, @PathVariable Long id) {
        Usuario usuario = getUsuario(auth);
        Estancia entity = estanciaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entity.getUsuario().getId().equals(usuario.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        estanciaRepository.delete(entity);
        return ResponseEntity.noContent().build();
    }

    // ========== CONGRESOS ==========

    @GetMapping("/congresos")
    public ResponseEntity<List<Map<String, Object>>> getCongresos(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        List<Map<String, Object>> result = congresoRepository.findByUsuarioId(usuario.getId()).stream().map(c -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", c.getId());
            dto.put("nombre", c.getNombreEvento());
            dto.put("tituloTrabajo", c.getTituloTrabajo());
            dto.put("tipoParticipacion", c.getTipoParticipacionNombre());
            dto.put("fecha", c.getFecha() != null ? c.getFecha().toString() : null);
            dto.put("paisSede", c.getPaisSede());
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/congresos")
    public ResponseEntity<Map<String, Object>> saveCongreso(Authentication auth, @RequestBody Map<String, Object> body) {
        Usuario usuario = getUsuario(auth);
        Congreso entity;
        if (body.containsKey("id") && body.get("id") != null) {
            Long id = Long.valueOf(body.get("id").toString());
            entity = congresoRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (!entity.getUsuario().getId().equals(usuario.getId()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        } else {
            entity = new Congreso();
            entity.setUsuario(usuario);
        }
        entity.setNombreEvento(getString(body, "nombre"));
        entity.setTituloTrabajo(getString(body, "tituloTrabajo"));
        entity.setTipoParticipacionNombre(getString(body, "tipoParticipacion"));
        String fecha = getString(body, "fecha");
        entity.setFecha(fecha != null ? LocalDate.parse(fecha) : null);
        entity.setPaisSede(getString(body, "paisSede"));
        congresoRepository.save(entity);
        return ResponseEntity.ok(Map.of("id", entity.getId()));
    }

    @DeleteMapping("/congresos/{id}")
    public ResponseEntity<Void> deleteCongreso(Authentication auth, @PathVariable Long id) {
        Usuario usuario = getUsuario(auth);
        Congreso entity = congresoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entity.getUsuario().getId().equals(usuario.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        congresoRepository.delete(entity);
        return ResponseEntity.noContent().build();
    }

    // ========== DIVULGACIÓN ==========

    @GetMapping("/divulgacion")
    public ResponseEntity<List<Map<String, Object>>> getDivulgaciones(Authentication auth) {
        Usuario usuario = getUsuario(auth);
        List<Map<String, Object>> result = divulgacionRepository.findByUsuarioId(usuario.getId()).stream().map(d -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", d.getId());
            dto.put("titulo", d.getTitulo());
            dto.put("tipoDivulgacion", d.getTipoDivulgacionNombre());
            dto.put("medioComunicacion", d.getMedioNombre());
            dto.put("dirigidoA", d.getDirigidoA());
            dto.put("productoObtenidoNombre", d.getProductoObtenidoNombre());
            dto.put("fecha", d.getFecha() != null ? d.getFecha().toString() : null);
            dto.put("institucionOrganizadora", d.getInstitucionOrganizadora());
            dto.put("evidenciaTipo", d.getEvidenciaTipo());
            dto.put("evidenciaLink", d.getEvidenciaLink());
            dto.put("evidenciaArchivoNombre", d.getEvidenciaArchivoNombre());
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/divulgacion")
    public ResponseEntity<Map<String, Object>> saveDivulgacion(Authentication auth, @RequestBody Map<String, Object> body) {
        Usuario usuario = getUsuario(auth);
        Divulgacion entity;
        if (body.containsKey("id") && body.get("id") != null) {
            Long id = Long.valueOf(body.get("id").toString());
            entity = divulgacionRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (!entity.getUsuario().getId().equals(usuario.getId()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        } else {
            entity = new Divulgacion();
            entity.setUsuario(usuario);
        }
        entity.setTitulo(getString(body, "titulo"));
        entity.setTipoDivulgacionNombre(getString(body, "tipoDivulgacion"));
        entity.setMedioNombre(getString(body, "medioComunicacion"));
        entity.setDirigidoA(getString(body, "dirigidoA"));
        entity.setProductoObtenidoNombre(getString(body, "productoObtenidoNombre"));
        String fecha = getString(body, "fecha");
        entity.setFecha(fecha != null ? LocalDate.parse(fecha) : null);
        entity.setInstitucionOrganizadora(getString(body, "institucionOrganizadora"));
        entity.setEvidenciaTipo(getString(body, "evidenciaTipo"));
        entity.setEvidenciaLink(getString(body, "evidenciaLink"));
        entity.setEvidenciaArchivoNombre(getString(body, "evidenciaArchivoNombre"));
        divulgacionRepository.save(entity);
        return ResponseEntity.ok(Map.of("id", entity.getId()));
    }

    @DeleteMapping("/divulgacion/{id}")
    public ResponseEntity<Void> deleteDivulgacion(Authentication auth, @PathVariable Long id) {
        Usuario usuario = getUsuario(auth);
        Divulgacion entity = divulgacionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entity.getUsuario().getId().equals(usuario.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        divulgacionRepository.delete(entity);
        return ResponseEntity.noContent().build();
    }

    // ========== HELPERS ==========

    private Usuario getUsuario(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        return usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    }

    private Documento obtenerDocumentoPreferente(List<Documento> documentos, Documento.TipoDocumento... tipos) {
        for (Documento.TipoDocumento tipo : tipos) {
            Documento encontrado = obtenerUltimoDocumentoPorTipo(documentos, tipo);
            if (encontrado != null) return encontrado;
        }
        return null;
    }

    private Documento obtenerUltimoDocumentoPorTipo(List<Documento> documentos, Documento.TipoDocumento tipo) {
        return documentos.stream()
                .filter(d -> d.getTipo() == tipo)
                .max(Comparator
                        .comparing(Documento::getFechaSubida, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Documento::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
    }

    private Map<String, Object> mapDocumentoResumen(Documento documento) {
        if (documento == null) return null;
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", documento.getId());
        dto.put("nombre", documento.getNombreArchivo());
        dto.put("tipo", documento.getTipo() != null ? documento.getTipo().name() : null);
        dto.put("contentType", documento.getContentType());
        dto.put("sizeBytes", documento.getSizeBytes());
        dto.put("fechaSubida", documento.getFechaSubida() != null ? documento.getFechaSubida().toString() : null);
        return dto;
    }

    private Map<String, Object> mapInstitucionToDTO(Institucion institucion) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", institucion.getId());
        dto.put("nombre", institucion.getNombre());
        dto.put("claveOficial", institucion.getClaveOficial());
        dto.put("tipoNombre", institucion.getTipoNombre());
        dto.put("paisNombre", institucion.getPaisNombre());
        dto.put("entidadNombre", institucion.getEntidadNombre());
        dto.put("municipioNombre", institucion.getMunicipioNombre());
        dto.put("nivelUnoNombre", institucion.getNivelUnoNombre());
        dto.put("nivelDosNombre", institucion.getNivelDosNombre());
        return dto;
    }

    private Map<String, Object> mapAreaConocimientoToDTO(AreaConocimiento area) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", area.getId());
        dto.put("areaNombre", area.getAreaNombre());
        dto.put("areaClave", area.getAreaClave());
        dto.put("campoNombre", area.getCampoNombre());
        dto.put("campoClave", area.getCampoClave());
        dto.put("disciplinaNombre", area.getDisciplinaNombre());
        dto.put("disciplinaClave", area.getDisciplinaClave());
        dto.put("subdisciplinaNombre", area.getSubdisciplinaNombre());
        dto.put("subdisciplinaClave", area.getSubdisciplinaClave());
        return dto;
    }

    private String normalizarYValidarRubroEvidencia(String rubroId) {
        if (rubroId == null || rubroId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rubro de evidencia requerido");
        }

        String rubroNormalizado = rubroId.trim();
        return RUBROS_EVIDENCIA_VALIDOS.stream()
                .filter(r -> r.equalsIgnoreCase(rubroNormalizado))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Rubro no válido para evidencia: " + rubroId
                ));
    }

    private boolean esDocumentoEvidenciaRubro(Documento documento) {
        return documento != null
                && documento.getTipo() == Documento.TipoDocumento.OTRO
                && documento.getNombreArchivo() != null
                && documento.getNombreArchivo().startsWith(EVIDENCIA_RUBRO_PREFIX)
                && extraerRubroDeNombreEvidencia(documento.getNombreArchivo()) != null;
    }

    private String extraerRubroDeNombreEvidencia(String nombreArchivo) {
        if (nombreArchivo == null || !nombreArchivo.startsWith(EVIDENCIA_RUBRO_PREFIX)) {
            return null;
        }
        String resto = nombreArchivo.substring(EVIDENCIA_RUBRO_PREFIX.length());
        String[] partes = resto.split("__", 3);
        if (partes.length < 3) {
            return null;
        }
        String rubro = partes[0];
        return RUBROS_EVIDENCIA_VALIDOS.contains(rubro) ? rubro : null;
    }

    private String extraerNombreVisibleEvidencia(String nombreArchivo) {
        if (nombreArchivo == null || !nombreArchivo.startsWith(EVIDENCIA_RUBRO_PREFIX)) {
            return nombreArchivo;
        }
        String resto = nombreArchivo.substring(EVIDENCIA_RUBRO_PREFIX.length());
        String[] partes = resto.split("__", 3);
        if (partes.length < 3 || partes[2] == null || partes[2].isBlank()) {
            return nombreArchivo;
        }
        return partes[2];
    }

    private String sanitizarNombreArchivo(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            return "evidencia";
        }
        return nombre
                .replace("\\", "_")
                .replace("/", "_")
                .replace(":", "_")
                .replace("*", "_")
                .replace("?", "_")
                .replace("\"", "_")
                .replace("<", "_")
                .replace(">", "_")
                .replace("|", "_");
    }

    private boolean esArchivoPdf(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return false;
        }

        String contentType = file.getContentType();
        String nombreOriginal = file.getOriginalFilename();

        boolean mimePdf = contentType != null && contentType.toLowerCase(Locale.ROOT).contains("pdf");
        boolean extensionPdf = nombreOriginal != null && nombreOriginal.toLowerCase(Locale.ROOT).endsWith(".pdf");
        return mimePdf || extensionPdf;
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }
}
