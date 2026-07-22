package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.Articulo;
import com.example.proyecto.demo.Entity.AreaConocimiento;
import com.example.proyecto.demo.Entity.Congreso;
import com.example.proyecto.demo.Entity.Curso;
import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Divulgacion;
import com.example.proyecto.demo.Entity.Estancia;
import com.example.proyecto.demo.Entity.Herramienta;
import com.example.proyecto.demo.Entity.Idioma;
import com.example.proyecto.demo.Entity.IncidenciaSocial;
import com.example.proyecto.demo.Entity.Institucion;
import com.example.proyecto.demo.Entity.InteresHabilidad;
import com.example.proyecto.demo.Entity.Logro;
import com.example.proyecto.demo.Entity.PerfilMigracion;
import com.example.proyecto.demo.Entity.PropiedadIntelectual;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Entity.TrayectoriaAcademica;
import com.example.proyecto.demo.Entity.TrayectoriaProfesional;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.ArticuloRepository;
import com.example.proyecto.demo.Repository.AreaConocimientoRepository;
import com.example.proyecto.demo.Repository.CongresoRepository;
import com.example.proyecto.demo.Repository.CursoRepository;
import com.example.proyecto.demo.Repository.DivulgacionRepository;
import com.example.proyecto.demo.Repository.EstanciaRepository;
import com.example.proyecto.demo.Repository.HerramientaRepository;
import com.example.proyecto.demo.Repository.IdiomaRepository;
import com.example.proyecto.demo.Repository.IncidenciaSocialRepository;
import com.example.proyecto.demo.Repository.InstitucionRepository;
import com.example.proyecto.demo.Repository.InteresHabilidadRepository;
import com.example.proyecto.demo.Repository.LogroRepository;
import com.example.proyecto.demo.Repository.PerfilMigracionRepository;
import com.example.proyecto.demo.Repository.PropiedadIntelectualRepository;
import com.example.proyecto.demo.Repository.TrayectoriaAcademicaRepository;
import com.example.proyecto.demo.Repository.TrayectoriaProfesionalRepository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.Service.DocumentoService;
import com.example.proyecto.demo.Service.PerfilCompletoService;
import com.example.proyecto.demo.Service.PerfilCompletoService.RegistroIncompletoException;
import com.example.proyecto.demo.dto.ArticuloItemDTO;
import com.example.proyecto.demo.dto.CursoItemDTO;
import com.example.proyecto.demo.dto.IdiomaItemDTO;
import com.example.proyecto.demo.dto.InvestigadorDTO;
import com.example.proyecto.demo.dto.LogroItemDTO;
import com.example.proyecto.demo.dto.PropiedadIntelectualItemDTO;
import com.example.proyecto.demo.dto.PerfilCompletoDTO;
import com.example.proyecto.demo.dto.UsuarioUpdateRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/usuarios")
@RequiredArgsConstructor
@Slf4j
public class UsuarioController {

    private final UsuarioRepository usuarioRepo;
    private final DocumentoService documentoService;
    private final TrayectoriaAcademicaRepository trayectoriaAcademicaRepository;
    private final InteresHabilidadRepository interesHabilidadRepository;
    private final CursoRepository cursoRepository;
    private final IdiomaRepository idiomaRepository;
    private final LogroRepository logroRepository;
    private final HerramientaRepository herramientaRepository;
    private final ArticuloRepository articuloRepository;
    private final PropiedadIntelectualRepository propiedadIntelectualRepository;
    private final AreaConocimientoRepository areaConocimientoRepository;
    private final InstitucionRepository institucionRepository;
    private final IncidenciaSocialRepository incidenciaSocialRepository;
    private final TrayectoriaProfesionalRepository trayectoriaProfesionalRepository;
    private final EstanciaRepository estanciaRepository;
    private final CongresoRepository congresoRepository;
    private final DivulgacionRepository divulgacionRepository;
    private final PerfilMigracionRepository perfilMigracionRepository;
    private final PerfilCompletoService perfilCompletoService;
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

    @GetMapping("/me")
    public PerfilCompletoDTO getMe(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario u = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        
        PerfilCompletoDTO dto = PerfilCompletoDTO.from(u);
        
        // Obtener IDs de foto y curriculum si existen
        Long fotoId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.FOTO_PERFIL)
                .map(Documento::getId)
                .orElse(null);
        
        Long curriculumId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.CURRICULUM)
                .map(Documento::getId)
                .orElseGet(() -> documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.CV)
                        .map(Documento::getId)
                        .orElse(null));

        Long ineId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.FISCAL_PDF)
                .map(Documento::getId)
                .orElse(null);

        Long domicilioId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.DOMICILIO)
                .map(Documento::getId)
                .orElse(null);

        Long cedulaId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.CEDULA_PROFESIONAL)
                .map(Documento::getId)
                .orElse(null);

        Long constanciaSniiId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.CONSTANCIA_SNII)
                .map(Documento::getId)
                .orElse(null);

        // Obtener el grado académico desde TrayectoriaAcademica (nivel de escolaridad)
        String gradoAcademico = null;
        try {
            gradoAcademico = resolverGradoAcademicoMasAlto(u.getId());
        } catch (Exception e) {
            log.warn("No se pudo obtener el grado académico para usuario {}: {}", u.getId(), e.getMessage());
        }
        
        String semblanza = resolverSemblanza(u);
        
        String cedulaProfesional = null;
        try {
            cedulaProfesional = trayectoriaAcademicaRepository.findByUsuarioId(u.getId())
                    .stream()
                    .map(t -> t.getCedulaProfesional())
                    .filter(c -> c != null && !c.isBlank())
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("No se pudo obtener cédula profesional para usuario {}: {}", u.getId(), e.getMessage());
        }

        return new PerfilCompletoDTO(
                dto.id(),
                dto.nombre(),
                dto.apellidoPaterno(),
                dto.apellidoMaterno(),
                dto.email(),
                dto.curp(),
                dto.rfc(),
                dto.telefono(),
                dto.celular(),
                dto.tipoIdentificacionOficial(),
                dto.identificacionOficial(),
                dto.calle(),
                dto.numeroExterior(),
                dto.numeroInterior(),
                dto.entreCalle(),
                dto.yCalle(),
                dto.otraReferencia(),
                dto.colonia(),
                dto.claveLocalidad(),
                dto.localidad(),
                dto.claveMunicipio(),
                dto.municipioDomicilio(),
                dto.claveEntidadFederativa(),
                dto.codigoPostal(),
                dto.claveAgeb(),
                dto.claveRedSocial(),
                dto.redSocial(),
                dto.genero(),
                dto.fechaNacimiento(),
                dto.nacionalidad(),
                dto.paisNacimiento(),
                dto.entidadFederativa(),
                dto.municipio(),
                dto.estadoCivil(),
                dto.tipoPerfil(),
                dto.tienePerfilMigracion(),
                dto.visibilidadPerfil(),
                dto.consentimientoDirectorioPublico(),
                gradoAcademico,
                fotoId,
                curriculumId,
                ineId,
                domicilioId,
                cedulaId,
                constanciaSniiId,
                cedulaProfesional,
                semblanza,
                Boolean.TRUE.equals(u.getRegistro2Completo())
        );
    }

    /**
     * Perfil completo para "Ver perfil", sincronizado con todos los rubros de completar registro.
     */
    @GetMapping("/me/detalle")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMeDetalle(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        PerfilCompletoDTO dto = getMe(auth);
        String semblanza = resolverSemblanza(usuario);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", dto.id());
        response.put("nombre", dto.nombre());
        response.put("apellidoPaterno", dto.apellidoPaterno());
        response.put("apellidoMaterno", dto.apellidoMaterno());
        response.put("email", dto.email());
        response.put("curp", dto.curp());
        response.put("rfc", dto.rfc());
        response.put("telefono", dto.telefono());
        response.put("celular", dto.celular());
        response.put("tipoIdentificacionOficial", dto.tipoIdentificacionOficial());
        response.put("identificacionOficial", dto.identificacionOficial());
        response.put("calle", dto.calle());
        response.put("numeroExterior", dto.numeroExterior());
        response.put("numeroInterior", dto.numeroInterior());
        response.put("entreCalle", dto.entreCalle());
        response.put("yCalle", dto.yCalle());
        response.put("otraReferencia", dto.otraReferencia());
        response.put("colonia", dto.colonia());
        response.put("claveLocalidad", dto.claveLocalidad());
        response.put("localidad", dto.localidad());
        response.put("claveMunicipio", dto.claveMunicipio());
        response.put("municipioDomicilio", dto.municipioDomicilio());
        response.put("claveEntidadFederativa", dto.claveEntidadFederativa());
        response.put("codigoPostal", dto.codigoPostal());
        response.put("claveAgeb", dto.claveAgeb());
        response.put("claveRedSocial", dto.claveRedSocial());
        response.put("redSocial", dto.redSocial());
        response.put("genero", dto.genero());
        response.put("fechaNacimiento", dto.fechaNacimiento());
        response.put("nacionalidad", dto.nacionalidad());
        response.put("paisNacimiento", dto.paisNacimiento());
        response.put("entidadFederativa", dto.entidadFederativa());
        response.put("municipio", dto.municipio());
        response.put("estadoCivil", dto.estadoCivil());
        response.put("tipoPerfil", dto.tipoPerfil());
        response.put("tienePerfilMigracion", dto.tienePerfilMigracion());
        response.put("visibilidadPerfil", dto.visibilidadPerfil());
        response.put("consentimientoDirectorioPublico", dto.consentimientoDirectorioPublico());
        response.put("gradoAcademico", dto.gradoAcademico());
        response.put("fotoDocumentoId", dto.fotoDocumentoId());
        response.put("curriculumDocumentoId", dto.curriculumDocumentoId());
        response.put("ineDocumentoId", dto.ineDocumentoId());
        response.put("domicilioDocumentoId", dto.domicilioDocumentoId());
        response.put("cedulaDocumentoId", dto.cedulaDocumentoId());
        response.put("constanciaSniiDocumentoId", dto.constanciaSniiDocumentoId());
        response.put("cedulaProfesional", dto.cedulaProfesional());
        response.put("semblanza", semblanza);
        response.put("registro2Completo", dto.registro2Completo());

        Map<String, Object> persona = new LinkedHashMap<>();
        persona.put("nombreCompleto", java.util.stream.Stream.of(
                        usuario.getNombre(), usuario.getApellidoPaterno(), usuario.getApellidoMaterno())
                .filter(v -> v != null && !v.isBlank())
                .collect(Collectors.joining(" ")));
        persona.put("email", dto.email());
        persona.put("curp", dto.curp());
        persona.put("rfc", dto.rfc());
        persona.put("telefono", dto.telefono());
        persona.put("tipoPerfil", dto.tipoPerfil());
        persona.put("genero", dto.genero());
        persona.put("estadoCivil", dto.estadoCivil());
        persona.put("semblanza", semblanza);
        response.put("personaPrincipal", persona);

        Map<String, Object> institucion = new LinkedHashMap<>();
        institucionRepository.findByUsuarioId(usuario.getId()).stream().findFirst().ifPresent(inst -> {
            institucion.put("id", inst.getId());
            institucion.put("nombre", inst.getNombre());
            institucion.put("claveOficial", inst.getClaveOficial());
            institucion.put("tipoId", inst.getTipoId());
            institucion.put("tipoNombre", inst.getTipoNombre());
            institucion.put("paisNombre", inst.getPaisNombre());
            institucion.put("entidadNombre", inst.getEntidadNombre());
            institucion.put("municipioNombre", inst.getMunicipioNombre());
            institucion.put("nivelUnoNombre", inst.getNivelUnoNombre());
            institucion.put("nivelDosNombre", inst.getNivelDosNombre());
        });
        response.put("institucion", institucion);

        Map<String, Object> areaConocimiento = new LinkedHashMap<>();
        areaConocimientoRepository.findByUsuarioId(usuario.getId()).stream().findFirst().ifPresent(area -> {
            areaConocimiento.put("id", area.getId());
            areaConocimiento.put("areaId", area.getAreaId());
            areaConocimiento.put("areaNombre", area.getAreaNombre());
            areaConocimiento.put("areaClave", area.getAreaClave());
            areaConocimiento.put("areaVersion", area.getAreaVersion());
            areaConocimiento.put("campoId", area.getCampoId());
            areaConocimiento.put("campoNombre", area.getCampoNombre());
            areaConocimiento.put("campoClave", area.getCampoClave());
            areaConocimiento.put("disciplinaId", area.getDisciplinaId());
            areaConocimiento.put("disciplinaNombre", area.getDisciplinaNombre());
            areaConocimiento.put("disciplinaClave", area.getDisciplinaClave());
            areaConocimiento.put("subdisciplinaId", area.getSubdisciplinaId());
            areaConocimiento.put("subdisciplinaNombre", area.getSubdisciplinaNombre());
            areaConocimiento.put("subdisciplinaClave", area.getSubdisciplinaClave());
        });
        response.put("areaConocimiento", areaConocimiento);

        Map<String, Object> perfilMigracion = perfilMigracionRepository.findByUsuarioId(usuario.getId()).map(pm -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", pm.getId());
            m.put("migracionId", pm.getMigracionId());
            m.put("cvu", pm.getCvu());
            m.put("login", pm.getLogin());
            m.put("correoAlterno", pm.getCorreoAlterno());
            m.put("nivelAcademico", pm.getNivelAcademico());
            m.put("tituloTratamiento", pm.getTituloTratamiento());
            m.put("filtro", pm.getFiltro());
            m.put("institucionReceptora", pm.getInstitucionReceptora());
            m.put("createdDate", pm.getCreatedDate() != null ? pm.getCreatedDate().toString() : null);
            m.put("lastModifiedDate", pm.getLastModifiedDate() != null ? pm.getLastModifiedDate().toString() : null);
            return m;
        }).orElse(null);
        response.put("perfilMigracion", perfilMigracion);

        List<Documento> documentos = documentoService.obtenerDocumentosPorUsuario(usuario.getId());
        Map<String, Object> evidencias = new LinkedHashMap<>();
        evidencias.put("curriculum", mapDocumentoResumen(obtenerDocumentoPreferente(documentos, Documento.TipoDocumento.CURRICULUM, Documento.TipoDocumento.CV)));
        evidencias.put("ine", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.FISCAL_PDF)));
        evidencias.put("domicilio", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.DOMICILIO)));
        evidencias.put("cedula", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CEDULA_PROFESIONAL)));
        evidencias.put("cert1", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CERTIFICADO_1)));
        evidencias.put("cert2", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CERTIFICADO_2)));
        evidencias.put("constanciaSnii", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CONSTANCIA_SNII)));
        evidencias.put("divulgacion", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.DIVULGACION)));
        response.put("evidencias", evidencias);
        response.put("evidenciasRubrosPersonalizadas", agruparEvidenciasPorRubro(documentos));

        response.put("trayectoriaAcademica", trayectoriaAcademicaRepository.findByUsuarioId(usuario.getId()).stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("nivelNombre", t.getNivelNombre());
            m.put("titulo", t.getTitulo());
            m.put("institucion", t.getInstitucion());
            m.put("estatusNombre", t.getEstatusNombre());
            m.put("cedulaProfesional", t.getCedulaProfesional());
            m.put("esPerfilSnii", t.getEsPerfilSnii());
            m.put("opcionTitulacion", t.getOpcionTitulacion());
            m.put("tituloTesis", t.getTituloTesis());
            m.put("fechaObtencion", t.getFechaObtencion() != null ? t.getFechaObtencion().toString() : null);
            return m;
        }).collect(Collectors.toList()));

        response.put("trayectoriaProfesional", trayectoriaProfesionalRepository.findByUsuarioId(usuario.getId()).stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("nombramiento", t.getNombramiento());
            m.put("institucion", t.getInstitucion());
            m.put("fechaInicio", t.getFechaInicio() != null ? t.getFechaInicio().toString() : null);
            m.put("fechaFin", t.getFechaFin() != null ? t.getFechaFin().toString() : null);
            m.put("esActual", t.getEsActual());
            m.put("logros", t.getLogros());
            return m;
        }).collect(Collectors.toList()));

        response.put("idiomas", idiomaRepository.findByUsuarioId(usuario.getId()).stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("nombre", i.getNombre());
            m.put("dominioNombre", i.getDominioNombre());
            m.put("conversacion", i.getConversacion());
            m.put("lectura", i.getLectura());
            m.put("escritura", i.getEscritura());
            m.put("esCertificado", i.getEsCertificado());
            m.put("certInstitucion", i.getCertInstitucion());
            m.put("certPuntuacion", i.getCertPuntuacion());
            m.put("vigenciaFin", i.getVigenciaFin() != null ? i.getVigenciaFin().toString() : null);
            return m;
        }).collect(Collectors.toList()));

        response.put("cursos", cursoRepository.findByUsuarioId(usuario.getId()).stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("nombre", c.getNombre());
            m.put("programa", c.getPrograma());
            m.put("horasTotales", c.getHorasTotales());
            m.put("fechaInicio", c.getFechaInicio() != null ? c.getFechaInicio().toString() : null);
            m.put("fechaFin", c.getFechaFin() != null ? c.getFechaFin().toString() : null);
            m.put("institucion", c.getInstitucion());
            m.put("nivelEscolaridad", c.getNivelEscolaridad());
            m.put("productoPrincipal", c.getProductoPrincipal());
            return m;
        }).collect(Collectors.toList()));

        response.put("estancias", estanciaRepository.findByUsuarioId(usuario.getId()).stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("tipoNombre", e.getTipoNombre());
            m.put("nombreProyecto", e.getNombreProyecto());
            m.put("institucionReceptora", e.getInstitucionReceptora());
            m.put("fechaInicio", e.getFechaInicio() != null ? e.getFechaInicio().toString() : null);
            m.put("fechaFin", e.getFechaFin() != null ? e.getFechaFin().toString() : null);
            m.put("logros", e.getLogros());
            return m;
        }).collect(Collectors.toList()));

        response.put("articulos", articuloRepository.findByUsuarioId(usuario.getId()).stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("titulo", a.getTitulo());
            m.put("tipo", a.getTipo());
            m.put("anio", a.getAnio());
            m.put("doi", a.getDoi());
            m.put("issn", a.getIssn());
            m.put("nombreRevista", a.getNombreRevista());
            m.put("rolParticipacionNombre", a.getRolParticipacionNombre());
            m.put("estadoNombre", a.getEstadoNombre());
            m.put("productoPrincipal", a.getProductoPrincipal());
            m.put("idExterno", a.getIdExterno());
            m.put("eje", a.getEje());
            m.put("issnElectronico", a.getIssnElectronico());
            m.put("objetivoNombre", a.getObjetivoNombre());
            m.put("fondoProgramaNombre", a.getFondoProgramaNombre());
            m.put("totalCitas", a.getTotalCitas());
            if (a.getAutores() != null) {
                m.put("autores", a.getAutores().stream().map(au -> {
                    Map<String, Object> am = new LinkedHashMap<>();
                    am.put("nombreCompleto", au.getNombreCompleto());
                    am.put("orcid", au.getOrcid());
                    am.put("orden", au.getOrden());
                    return am;
                }).collect(Collectors.toList()));
            } else {
                m.put("autores", new ArrayList<>());
            }
            return m;
        }).collect(Collectors.toList()));

        response.put("congresos", congresoRepository.findByUsuarioId(usuario.getId()).stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("nombreEvento", c.getNombreEvento());
            m.put("tituloTrabajo", c.getTituloTrabajo());
            m.put("tipoParticipacionNombre", c.getTipoParticipacionNombre());
            m.put("fecha", c.getFecha() != null ? c.getFecha().toString() : null);
            m.put("paisSede", c.getPaisSede());
            m.put("productoPrincipal", c.getProductoPrincipal());
            return m;
        }).collect(Collectors.toList()));

        response.put("divulgaciones", divulgacionRepository.findByUsuarioId(usuario.getId()).stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.getId());
            m.put("titulo", d.getTitulo());
            m.put("tipoDivulgacionNombre", d.getTipoDivulgacionNombre());
            m.put("medioNombre", d.getMedioNombre());
            m.put("dirigidoA", d.getDirigidoA());
            m.put("productoObtenidoNombre", d.getProductoObtenidoNombre());
            m.put("fecha", d.getFecha() != null ? d.getFecha().toString() : null);
            m.put("institucionOrganizadora", d.getInstitucionOrganizadora());
            m.put("evidenciaTipo", d.getEvidenciaTipo());
            m.put("evidenciaLink", d.getEvidenciaLink());
            m.put("evidenciaArchivoNombre", d.getEvidenciaArchivoNombre());
            return m;
        }).collect(Collectors.toList()));

        response.put("logros", logroRepository.findByUsuarioId(usuario.getId()).stream().map(l -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", l.getId());
            m.put("tipo", l.getTipo());
            m.put("nombre", l.getNombre());
            m.put("anio", l.getAnio());
            return m;
        }).collect(Collectors.toList()));

        response.put("herramientas", herramientaRepository.findByUsuarioId(usuario.getId()).stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", h.getId());
            m.put("nombre", h.getNombre());
            return m;
        }).collect(Collectors.toList()));

        response.put("incidenciaSocial", incidenciaSocialRepository.findByUsuarioId(usuario.getId()).stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("titulo", i.getTitulo());
            m.put("ubicacion", i.getUbicacion());
            m.put("descripcion", i.getDescripcion());
            m.put("fecha", i.getFecha() != null ? i.getFecha().toString() : null);
            m.put("anio", i.getAnio());
            return m;
        }).collect(Collectors.toList()));

        response.put("propiedadIntelectual", propiedadIntelectualRepository.findByUsuarioId(usuario.getId()).stream().map(pi -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", pi.getId());
            m.put("tipo", pi.getTipo() != null ? pi.getTipo().name() : null);
            m.put("titulo", pi.getTitulo());
            m.put("numeroRegistro", pi.getNumeroRegistro());
            m.put("institucionOficina", pi.getInstitucionOficina());
            m.put("pais", pi.getPais());
            m.put("fechaRegistro", pi.getFechaRegistro() != null ? pi.getFechaRegistro().toString() : null);
            m.put("anio", pi.getAnio());
            m.put("descripcion", pi.getDescripcion());
            return m;
        }).collect(Collectors.toList()));

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/me")
    @Transactional
    public ResponseEntity<Map<String, String>> updateMe(@RequestBody UsuarioUpdateRequest req, Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario u = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId).orElse(null);
        if (u == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", "No se encontró su perfil. Asegúrese de haber completado al menos el registro inicial (crear cuenta)."));
        }

        if (req.nombre() != null) u.setNombre(req.nombre());
        if (req.apellidoPaterno() != null) u.setApellidoPaterno(req.apellidoPaterno());
        if (req.apellidoMaterno() != null) u.setApellidoMaterno(req.apellidoMaterno());
        if (req.semblanza() != null) {
            String semblanzaNormalizada = req.semblanza().trim();
            if (semblanzaNormalizada.isBlank()) {
                semblanzaNormalizada = null;
            }
            u.setSemblanza(semblanzaNormalizada);
            sincronizarSemblanzaInteresHabilidad(u, semblanzaNormalizada);
        }
        if (req.visibilidadPerfil() != null && ("MINIMA".equals(req.visibilidadPerfil()) || "ESTANDAR".equals(req.visibilidadPerfil()) || "COMPLETA".equals(req.visibilidadPerfil()))) {
            u.setVisibilidadPerfil(req.visibilidadPerfil());
        }
        if (req.consentimientoDirectorioPublico() != null) {
            u.setConsentimientoDirectorioPublico(req.consentimientoDirectorioPublico());
        }
        if (req.registro2Completo() != null) u.setRegistro2Completo(req.registro2Completo());

        usuarioRepo.save(u);
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Perfil actualizado correctamente"));
    }

    @PatchMapping("/me/completar-registro/seccion/{seccion}")
    @Transactional
    public ResponseEntity<Map<String, String>> guardarSeccionCompletarRegistro(
            @PathVariable String seccion,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Map<String, Object> datos = body != null ? new HashMap<>(body) : new HashMap<>();
        String seccionNormalizada = seccion == null ? "" : seccion.trim().toLowerCase(Locale.ROOT);

        switch (seccionNormalizada) {
            case "inicio":
            case "personaprincipal":
                guardarDatosPersonalesParciales(usuario, datos);
                break;
            case "padroninstitucional":
                guardarPadronParcial(usuario, datos);
                break;
            case "institucion":
                if (tieneAlgunValor(datos, "instClaveOficial", "instNombre", "instTipoId", "instTipoNombre", "instPaisNombre", "instEntidadNombre", "instMunicipioNombre", "instNivelUnoNombre", "instNivelDosNombre")) {
                    perfilCompletoService.guardarInstitucionConTransaccion(usuario, datos);
                }
                break;
            case "area-conocimiento":
            case "areaconocimiento":
                if (tieneAlgunValor(datos, "areaNombre", "areaClave", "areaVersion", "campoNombre", "disciplinaNombre", "subdisciplinaNombre")) {
                    perfilCompletoService.guardarAreaConocimientoConTransaccion(usuario, datos);
                }
                break;
            case "trayectoria-academica":
            case "trayectoriaacademica":
                if (tieneTexto(datos.get("academicaJson"))) {
                    perfilCompletoService.guardarTrayectoriaAcademicaDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("academicaJson")));
                } else if (tieneAlgunValor(datos, "acadTitulo", "acadNivelNombre", "acadEstatusNombre", "acadInstitucion", "acadCedulaProfesional")) {
                    perfilCompletoService.guardarTrayectoriaAcademicaConTransaccion(usuario, datos);
                }
                break;
            case "trayectoria-profesional":
            case "trayectoriaprofesional":
                if (tieneAlgunValor(datos, "trayProfNombramiento", "trayProfInstitucion", "trayProfFechaInicio", "trayProfFechaFin", "trayProfLogros")) {
                    perfilCompletoService.guardarTrayectoriaProfesionalConTransaccion(usuario, datos);
                }
                break;
            case "cursos":
                if (tieneTexto(datos.get("cursosJson"))) {
                    perfilCompletoService.guardarCursosDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("cursosJson")));
                } else if (tieneAlgunValor(datos, "cursoNombre", "cursoPrograma", "cursoFechaInicio", "cursoInstitucion", "cursoNivelEscolaridad")) {
                    perfilCompletoService.guardarCursoConTransaccion(usuario, datos);
                }
                break;
            case "idiomas":
                if (tieneTexto(datos.get("idiomasJson"))) {
                    perfilCompletoService.guardarIdiomasDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("idiomasJson")));
                } else if (tieneAlgunValor(datos, "idiomaNombre", "idiomaDominioNombre", "idiomaCertInstitucion", "idiomaCertPuntuacion")) {
                    perfilCompletoService.guardarIdiomaConTransaccion(usuario, datos);
                }
                break;
            case "estancias":
                if (tieneTexto(datos.get("estanciasJson"))) {
                    perfilCompletoService.guardarEstanciasDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("estanciasJson")));
                } else if (tieneAlgunValor(datos, "estanciaNombreProyecto", "estanciaTipoNombre", "estanciaFechaInicio", "estanciaInstitucionReceptora")) {
                    perfilCompletoService.guardarEstanciaConTransaccion(usuario, datos);
                }
                break;
            case "aportaciones":
                if (tieneTexto(datos.get("articulosJson"))) {
                    perfilCompletoService.guardarArticulosDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("articulosJson")));
                } else if (tieneAlgunValor(datos, "artTitulo", "artNombreRevista", "artRolPartNombre", "artEstadoNombre")) {
                    perfilCompletoService.guardarArticuloConTransaccion(usuario, datos);
                }
                break;
            case "congresos":
                if (tieneTexto(datos.get("congresosJson"))) {
                    perfilCompletoService.guardarCongresosDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("congresosJson")));
                } else if (tieneAlgunValor(datos, "congresoNombreEvento", "congresoTipoPartNombre", "congresoFecha", "congresoPaisSede")) {
                    perfilCompletoService.guardarCongresoConTransaccion(usuario, datos);
                }
                break;
            case "divulgacion":
                if (tieneTexto(datos.get("divulgacionesJson"))) {
                    perfilCompletoService.guardarDivulgacionesDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("divulgacionesJson")));
                } else if (tieneAlgunValor(datos, "divulgTitulo", "divulgTipoDivNombre", "divulgMedioNombre", "divulgProdObtenidoNombre")) {
                    perfilCompletoService.guardarDivulgacionConTransaccion(usuario, datos);
                }
                break;
            case "logros":
                if (tieneTexto(datos.get("logrosJson"))) {
                    perfilCompletoService.guardarLogrosDesdeJsonConTransaccion(usuario, normalizarTexto(datos.get("logrosJson")));
                } else if (tieneAlgunValor(datos, "logroNombre", "logroTipo")) {
                    perfilCompletoService.guardarLogroConTransaccion(usuario, datos);
                }
                break;
            default:
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("status", "error", "message", "Sección no soportada para guardado parcial: " + seccion));
        }

        usuarioRepo.save(usuario);
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "message", "Sección guardada correctamente",
                "section", seccion
        ));
    }
    @PostMapping("/me/completar-registro/finalizar")
    public ResponseEntity<Map<String, Object>> finalizarCompletarRegistro(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1AndPerfilMigracion(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        try {
            PerfilMigracion perfil = perfilCompletoService.finalizarRegistroPersistido(usuario);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "success");
            response.put("message", "Registro completado correctamente");
            response.put("usuarioId", usuario.getId());
            response.put("perfilMigracionId", perfil.getId());
            response.put("migracionId", perfil.getMigracionId());
            return ResponseEntity.ok(response);
        } catch (RegistroIncompletoException ex) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "incomplete");
            response.put("message", ex.getMessage());
            response.put("seccionesFaltantes", ex.getSeccionesFaltantes());
            response.put("primeraSeccion", ex.getSeccionesFaltantes().get(0).clave());
            return ResponseEntity.badRequest().body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", ex.getMessage()));
        }
    }
    @GetMapping("/me/completar-registro/archivos")
    public ResponseEntity<Map<String, Object>> obtenerArchivosCompletarRegistro(Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Map<String, Object> archivos = new LinkedHashMap<>();
        agregarArchivoGuardado(archivos, "cert1", usuario.getId(), Documento.TipoDocumento.CERTIFICADO_1);
        agregarArchivoGuardado(archivos, "cert2", usuario.getId(), Documento.TipoDocumento.CERTIFICADO_2);
        agregarArchivoGuardado(archivos, "acad_constancia_snii", usuario.getId(), Documento.TipoDocumento.CONSTANCIA_SNII);
        agregarArchivoGuardado(archivos, "idioma_cert_documento", usuario.getId(), Documento.TipoDocumento.CERTIFICACION_IDIOMA);
        agregarArchivoGuardado(archivos, "estancia_documento", usuario.getId(), Documento.TipoDocumento.ESTANCIA_INVESTIGACION);
        agregarArchivoGuardado(archivos, "divulg_archivo", usuario.getId(), Documento.TipoDocumento.DIVULGACION);

        return ResponseEntity.ok(Map.of("status", "ok", "archivos", archivos));
    }

    @PostMapping(value = "/me/completar-registro/seccion/{seccion}/archivos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> guardarArchivosCompletarRegistro(
            @PathVariable String seccion,
            MultipartHttpServletRequest request,
            Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        String seccionNormalizada = seccion == null ? "" : seccion.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> guardados = new ArrayList<>();

        try {
            switch (seccionNormalizada) {
                case "trayectoria-academica":
                case "trayectoriaacademica":
                    guardarArchivoParcial(request.getFile("cert1"), "cert1", Documento.TipoDocumento.CERTIFICADO_1, usuario.getId(), guardados);
                    guardarArchivoParcial(request.getFile("acad_constancia_snii"), "acad_constancia_snii", Documento.TipoDocumento.CONSTANCIA_SNII, usuario.getId(), guardados);
                    break;
                case "trayectoria-profesional":
                case "trayectoriaprofesional":
                    guardarArchivoParcial(request.getFile("cert2"), "cert2", Documento.TipoDocumento.CERTIFICADO_2, usuario.getId(), guardados);
                    break;
                case "idiomas":
                    guardarArchivoParcial(request.getFile("idioma_cert_documento"), "idioma_cert_documento", Documento.TipoDocumento.CERTIFICACION_IDIOMA, usuario.getId(), guardados);
                    List<Map.Entry<String, MultipartFile>> certificadosIdioma = request.getFileMap().entrySet().stream()
                            .filter(entry -> entry.getKey().startsWith("idiomaCertDocumento_")
                                    && entry.getValue() != null && !entry.getValue().isEmpty())
                            .sorted(Map.Entry.comparingByKey())
                            .toList();
                    for (Map.Entry<String, MultipartFile> certificado : certificadosIdioma) {
                        Documento documento = documentoService.guardarDocumento(
                                usuario.getId(),
                                certificado.getValue(),
                                Documento.TipoDocumento.CERTIFICACION_IDIOMA,
                                certificado.getValue().getOriginalFilename(),
                                false
                        );
                        guardados.add(resumenArchivoGuardado(certificado.getKey(), documento));
                    }
                    break;
                case "estancias":
                    guardarArchivoParcial(request.getFile("estancia_documento"), "estancia_documento", Documento.TipoDocumento.ESTANCIA_INVESTIGACION, usuario.getId(), guardados);
                    break;
                case "divulgacion":
                    List<Map.Entry<String, MultipartFile>> evidencias = request.getFileMap().entrySet().stream()
                            .filter(entry -> (entry.getKey().equals("divulg_archivo") || entry.getKey().startsWith("divulgArchivo_"))
                                    && entry.getValue() != null && !entry.getValue().isEmpty())
                            .sorted(Map.Entry.comparingByKey())
                            .toList();
                    for (Map.Entry<String, MultipartFile> evidencia : evidencias) {
                        Documento documento;
                        if (evidencia.getKey().equals("divulg_archivo")) {
                            documento = documentoService.guardarDocumentoUsuario(
                                    usuario.getId(),
                                    evidencia.getValue(),
                                    Documento.TipoDocumento.DIVULGACION
                            );
                        } else {
                            documento = documentoService.guardarDocumento(
                                    usuario.getId(),
                                    evidencia.getValue(),
                                    Documento.TipoDocumento.DIVULGACION,
                                    evidencia.getValue().getOriginalFilename(),
                                    false
                            );
                        }
                        guardados.add(resumenArchivoGuardado(evidencia.getKey(), documento));
                    }
                    break;
                default:
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                            "status", "error",
                            "message", "La sección no admite archivos: " + seccion
                    ));
            }
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "status", "error",
                    "message", ex.getMessage()
            ));
        } catch (Exception ex) {
            log.error("No se pudieron guardar los archivos parciales de la sección {} para el usuario {}", seccion, usuario.getId(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "error",
                    "message", "No se pudieron guardar los archivos de esta sección"
            ));
        }

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "message", guardados.isEmpty() ? "No había archivos nuevos para guardar" : "Archivos guardados correctamente",
                "archivos", guardados
        ));
    }

    private void guardarArchivoParcial(
            MultipartFile archivo,
            String campo,
            Documento.TipoDocumento tipo,
            Long usuarioId,
            List<Map<String, Object>> guardados) throws Exception {
        if (archivo == null || archivo.isEmpty()) {
            return;
        }
        Documento documento = documentoService.guardarDocumentoUsuario(usuarioId, archivo, tipo);
        guardados.add(resumenArchivoGuardado(campo, documento));
    }

    private void agregarArchivoGuardado(
            Map<String, Object> archivos,
            String campo,
            Long usuarioId,
            Documento.TipoDocumento tipo) {
        documentoService.obtenerDocumentoPorUsuarioYTipo(usuarioId, tipo)
                .ifPresent(documento -> archivos.put(campo, resumenArchivoGuardado(campo, documento)));
    }

    private Map<String, Object> resumenArchivoGuardado(String campo, Documento documento) {
        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("campo", campo);
        resumen.put("documentoId", documento.getId());
        resumen.put("nombre", documento.getNombreArchivo());
        resumen.put("tipo", documento.getTipo().name());
        resumen.put("guardado", true);
        return resumen;
    }
    @PatchMapping("/me/perfil-snii")
    @Transactional
    public ResponseEntity<Map<String, String>> updatePerfilSnii(@RequestBody Map<String, Object> body, Authentication auth) {
        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        if (body == null || !body.containsKey("esPerfilSnii")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("status", "error", "message", "Falta el campo esPerfilSnii"));
        }

        Object raw = body.get("esPerfilSnii");
        boolean esPerfilSnii;
        if (raw instanceof Boolean b) {
            esPerfilSnii = b;
        } else {
            esPerfilSnii = Boolean.parseBoolean(String.valueOf(raw));
        }

        List<TrayectoriaAcademica> lista = trayectoriaAcademicaRepository.findByUsuarioId(usuario.getId());
        if (lista.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of(
                            "status", "error",
                            "message", "No hay trayectoria académica registrada. Agrega al menos un grado en Completar registro."
                    ));
        }

        lista.forEach(t -> t.setEsPerfilSnii(esPerfilSnii));
        trayectoriaAcademicaRepository.saveAll(lista);

        return ResponseEntity.ok(Map.of("status", "ok", "message", "Perfil SNII actualizado correctamente"));
    }

    private void guardarDatosPersonalesParciales(Usuario usuario, Map<String, Object> datos) {
        if (datos == null) {
            return;
        }

        if (datos.containsKey("nombre")) usuario.setNombre(normalizarTexto(datos.get("nombre")));
        if (datos.containsKey("apellidoPaterno")) usuario.setApellidoPaterno(normalizarTexto(datos.get("apellidoPaterno")));
        if (datos.containsKey("apellidoMaterno")) usuario.setApellidoMaterno(normalizarTexto(datos.get("apellidoMaterno")));

        Registro1 registro1 = asegurarRegistro1(usuario);
        if (datos.containsKey("curp")) registro1.setCurp(normalizarTexto(datos.get("curp")));
        if (datos.containsKey("rfc")) registro1.setRfc(normalizarTexto(datos.get("rfc")));
        if (datos.containsKey("fechaNacimiento")) registro1.setFechaNacimiento(parseFecha(datos.get("fechaNacimiento")));
        if (datos.containsKey("genero")) registro1.setGenero(parseGenero(datos.get("genero")));
        if (datos.containsKey("nacionalidad")) registro1.setNacionalidad(normalizarTexto(datos.get("nacionalidad")));
        if (datos.containsKey("paisNacimiento")) registro1.setPaisNacimiento(normalizarTexto(datos.get("paisNacimiento")));
        if (datos.containsKey("entidadFederativa")) registro1.setEntidadFederativa(normalizarTexto(datos.get("entidadFederativa")));
        if (datos.containsKey("municipio")) registro1.setMunicipio(normalizarTexto(datos.get("municipio")));
        if (datos.containsKey("estadoCivil")) registro1.setEstadoCivil(parseEstadoCivil(datos.get("estadoCivil")));

        if (datos.containsKey("interesDescripcion")) {
            String semblanza = normalizarTexto(datos.get("interesDescripcion"));
            usuario.setSemblanza(semblanza);
            Map<String, Object> datosInteres = new HashMap<>();
            datosInteres.put("interesDescripcion", semblanza);
            perfilCompletoService.guardarInteresHabilidadConTransaccion(usuario, datosInteres);
        }
    }

    private void guardarPadronParcial(Usuario usuario, Map<String, Object> datos) {
        if (datos == null) {
            return;
        }

        Registro1 registro1 = asegurarRegistro1(usuario);
        if (datos.containsKey("telefono")) registro1.setTelefono(normalizarTexto(datos.get("telefono")));
        if (datos.containsKey("celular")) registro1.setCelular(normalizarTexto(datos.get("celular")));
        if (datos.containsKey("tipoIdentificacionOficial")) registro1.setTipoIdentificacionOficial(normalizarTexto(datos.get("tipoIdentificacionOficial")));
        if (datos.containsKey("identificacionOficial")) registro1.setIdentificacionOficial(normalizarTexto(datos.get("identificacionOficial")));
        if (datos.containsKey("calle")) registro1.setCalle(normalizarTexto(datos.get("calle")));
        if (datos.containsKey("numeroExterior")) registro1.setNumeroExterior(normalizarTexto(datos.get("numeroExterior")));
        if (datos.containsKey("numeroInterior")) registro1.setNumeroInterior(normalizarTexto(datos.get("numeroInterior")));
        if (datos.containsKey("entreCalle")) registro1.setEntreCalle(normalizarTexto(datos.get("entreCalle")));
        if (datos.containsKey("yCalle")) registro1.setYCalle(normalizarTexto(datos.get("yCalle")));
        if (datos.containsKey("colonia")) registro1.setColonia(normalizarTexto(datos.get("colonia")));
        if (datos.containsKey("claveEntidadFederativa")) registro1.setClaveEntidadFederativa(normalizarTexto(datos.get("claveEntidadFederativa")));
        if (datos.containsKey("municipioDomicilio")) registro1.setMunicipioDomicilio(normalizarTexto(datos.get("municipioDomicilio")));
        if (datos.containsKey("claveMunicipio")) registro1.setClaveMunicipio(normalizarTexto(datos.get("claveMunicipio")));
        if (datos.containsKey("localidad")) registro1.setLocalidad(normalizarTexto(datos.get("localidad")));
        if (datos.containsKey("claveLocalidad")) registro1.setClaveLocalidad(normalizarTexto(datos.get("claveLocalidad")));
        if (datos.containsKey("codigoPostal")) registro1.setCodigoPostal(normalizarTexto(datos.get("codigoPostal")));
        if (datos.containsKey("claveAgeb")) registro1.setClaveAgeb(normalizarTexto(datos.get("claveAgeb")));
        if (datos.containsKey("otraReferencia")) registro1.setOtraReferencia(normalizarTexto(datos.get("otraReferencia")));
        if (datos.containsKey("claveRedSocial")) registro1.setClaveRedSocial(normalizarTexto(datos.get("claveRedSocial")));
        if (datos.containsKey("redSocial")) registro1.setRedSocial(normalizarTexto(datos.get("redSocial")));
    }

    private Registro1 asegurarRegistro1(Usuario usuario) {
        Registro1 registro1 = usuario.getRegistro1();
        if (registro1 != null) {
            return registro1;
        }
        registro1 = new Registro1();
        registro1.setUsuario(usuario);
        usuario.setRegistro1(registro1);
        return registro1;
    }

    private boolean tieneAlgunValor(Map<String, Object> datos, String... keys) {
        if (datos == null || keys == null) {
            return false;
        }
        for (String key : keys) {
            String valor = normalizarTexto(datos.get(key));
            if (valor != null) {
                return true;
            }
        }
        return false;
    }

    private boolean tieneTexto(Object valor) {
        return normalizarTexto(valor) != null;
    }

    private String normalizarTexto(Object valor) {
        if (valor == null) {
            return null;
        }
        String texto = valor.toString().trim();
        return texto.isEmpty() ? null : texto;
    }

    private LocalDate parseFecha(Object valor) {
        String texto = normalizarTexto(valor);
        if (texto == null) {
            return null;
        }
        try {
            return LocalDate.parse(texto);
        } catch (Exception ex) {
            log.warn("No se pudo convertir la fecha parcial [{}]", texto);
            return null;
        }
    }

    private Registro1.Genero parseGenero(Object valor) {
        String texto = normalizarTexto(valor);
        if (texto == null) {
            return null;
        }
        try {
            return Registro1.Genero.valueOf(texto.toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            log.warn("Genero parcial no válido: {}", texto);
            return null;
        }
    }

    private Registro1.EstadoCivil parseEstadoCivil(Object valor) {
        String texto = normalizarTexto(valor);
        if (texto == null) {
            return null;
        }
        try {
            return Registro1.EstadoCivil.valueOf(texto.toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            log.warn("Estado civil parcial no válido: {}", texto);
            return null;
        }
    }
    private String resolverSemblanza(Usuario usuario) {
        String semblanzaInteres = null;
        try {
            semblanzaInteres = interesHabilidadRepository.findByUsuarioId(usuario.getId())
                    .map(InteresHabilidad::getInteresDescripcion)
                    .filter(s -> s != null && !s.isBlank())
                    .map(String::trim)
                    .orElse(null);
        } catch (Exception e) {
            log.warn("No se pudo obtener la semblanza desde InteresHabilidad para usuario {}: {}", usuario.getId(), e.getMessage());
        }

        String semblanzaUsuario = usuario.getSemblanza();
        if (semblanzaUsuario != null && !semblanzaUsuario.isBlank()) {
            semblanzaUsuario = semblanzaUsuario.trim();
        } else {
            semblanzaUsuario = null;
        }

        // Priorizar el valor de completar-registro (InteresHabilidad) para reflejar cambios recientes.
        return semblanzaInteres != null ? semblanzaInteres : semblanzaUsuario;
    }

    private void sincronizarSemblanzaInteresHabilidad(Usuario usuario, String semblanza) {
        Optional<InteresHabilidad> existente = interesHabilidadRepository.findByUsuarioId(usuario.getId());
        if (existente.isPresent()) {
            InteresHabilidad ih = existente.get();
            ih.setInteresDescripcion(semblanza);
            interesHabilidadRepository.save(ih);
            return;
        }

        if (semblanza != null && !semblanza.isBlank()) {
            InteresHabilidad nuevo = InteresHabilidad.builder()
                    .usuario(usuario)
                    .interesDescripcion(semblanza)
                    .build();
            interesHabilidadRepository.save(nuevo);
        }
    }

    @PostMapping(value = "/me/foto", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadFoto(
            @RequestPart("foto") MultipartFile foto,
            Authentication auth) {
        try {
            Long authUserId = (Long) auth.getPrincipal();
            Usuario u = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            
            // Validar que sea una imagen
            if (!foto.getContentType().startsWith("image/")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("status", "error", "message", "El archivo debe ser una imagen"));
            }
            
            Documento documento = documentoService.guardarDocumentoUsuario(
                    u.getId(), 
                    foto, 
                    Documento.TipoDocumento.FOTO_PERFIL
            );
            
            log.info("Foto guardada para usuario {}: {}", u.getId(), documento.getId());
            
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Foto actualizada correctamente",
                    "documentoId", documento.getId(),
                    "filename", foto.getOriginalFilename()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error al guardar foto: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", "Error al guardar foto"));
        }
    }

    @PostMapping(value = "/me/curriculum", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadCurriculum(
            @RequestPart("curriculum") MultipartFile curriculum,
            Authentication auth) {
        try {
            Long authUserId = (Long) auth.getPrincipal();
            Usuario u = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            
            // Validar que sea un PDF
            if (!curriculum.getContentType().equals("application/pdf")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("status", "error", "message", "El archivo debe ser un PDF"));
            }
            
            Documento documento = documentoService.guardarDocumentoUsuario(
                    u.getId(), 
                    curriculum, 
                    Documento.TipoDocumento.CURRICULUM
            );
            
            log.info("Currículum guardado para usuario {}: {}", u.getId(), documento.getId());
            
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Currículum actualizado correctamente",
                    "documentoId", documento.getId(),
                    "filename", curriculum.getOriginalFilename()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error al guardar currículum: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", "Error al guardar currículum"));
        }
    }

    private Documento obtenerDocumentoPreferente(List<Documento> documentos, Documento.TipoDocumento... tipos) {
        for (Documento.TipoDocumento tipo : tipos) {
            Documento encontrado = obtenerUltimoDocumentoPorTipo(documentos, tipo);
            if (encontrado != null) {
                return encontrado;
            }
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
        if (documento == null) {
            return null;
        }
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", documento.getId());
        dto.put("nombre", documento.getNombreArchivo());
        dto.put("tipo", documento.getTipo() != null ? documento.getTipo().name() : null);
        dto.put("contentType", documento.getContentType());
        dto.put("sizeBytes", documento.getSizeBytes());
        dto.put("fechaSubida", documento.getFechaSubida() != null ? documento.getFechaSubida().toString() : null);
        return dto;
    }

    private Map<String, List<Map<String, Object>>> agruparEvidenciasPorRubro(List<Documento> documentos) {
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

        return response;
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

    @GetMapping("/investigadores")
    @Transactional(readOnly = true)
    public ResponseEntity<List<InvestigadorDTO>> listarInvestigadores() {
        try {
            List<Usuario> usuarios = usuarioRepo.findAllWithRelations();
            
            List<InvestigadorDTO> investigadores = usuarios.stream()
                    .filter(u -> u.getAuthUser() != null) // Solo usuarios con autenticación
                    .map(u -> {
                        // Obtener email
                        String email = u.getAuthUser() != null ? u.getAuthUser().getEmail() : null;
                        
                        // Obtener teléfono y tipo de perfil desde Registro1
                        String telefono = null;
                        String tipoPerfil = null;
                        try {
                            if (u.getRegistro1() != null) {
                                telefono = u.getRegistro1().getTelefono();
                                tipoPerfil = u.getRegistro1().getTipoPerfil() != null
                                        ? u.getRegistro1().getTipoPerfil().name() : null;
                            }
                        } catch (Exception e) {
                            log.warn("No se pudo obtener el teléfono para usuario {}: {}", u.getId(), e.getMessage());
                        }
                        
                        // Obtener grado académico
                        String gradoAcademico = null;
                        try {
                            gradoAcademico = resolverGradoAcademicoMasAlto(u.getId());
                        } catch (Exception e) {
                            log.warn("No se pudo obtener el grado académico para usuario {}: {}", u.getId(), e.getMessage());
                        }

                        // Obtener área de conocimiento (rubro principal para filtros del directorio)
                        String areaConocimiento = null;
                        try {
                            areaConocimiento = areaConocimientoRepository.findByUsuarioId(u.getId())
                                    .stream()
                                    .findFirst()
                                    .map(area -> {
                                        if (area.getAreaNombre() != null && !area.getAreaNombre().isBlank()) return area.getAreaNombre();
                                        if (area.getCampoNombre() != null && !area.getCampoNombre().isBlank()) return area.getCampoNombre();
                                        if (area.getDisciplinaNombre() != null && !area.getDisciplinaNombre().isBlank()) return area.getDisciplinaNombre();
                                        if (area.getSubdisciplinaNombre() != null && !area.getSubdisciplinaNombre().isBlank()) return area.getSubdisciplinaNombre();
                                        return null;
                                    })
                                    .orElse(null);
                        } catch (Exception e) {
                            log.warn("No se pudo obtener área de conocimiento para usuario {}: {}", u.getId(), e.getMessage());
                        }
                        
                        String semblanza = resolverSemblanza(u);
                        
                        // Obtener foto
                        Long fotoId = null;
                        try {
                            fotoId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.FOTO_PERFIL)
                                    .map(Documento::getId)
                                    .orElse(null);
                            if (fotoId != null) {
                                log.debug("Foto encontrada para usuario {}: documentoId={}", u.getId(), fotoId);
                            } else {
                                log.debug("No se encontró foto para usuario {}", u.getId());
                            }
                        } catch (Exception e) {
                            log.warn("Error al obtener foto para usuario {}: {}", u.getId(), e.getMessage());
                        }
                        
                        // Obtener CV/Curriculum
                        Long curriculumId = null;
                        try {
                            curriculumId = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.CURRICULUM)
                                    .map(Documento::getId)
                                    .orElseGet(() -> documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.CV)
                                            .map(Documento::getId)
                                            .orElse(null));
                            if (curriculumId != null) {
                                log.debug("Currículum encontrado para usuario {}: documentoId={}", u.getId(), curriculumId);
                            } else {
                                log.debug("No se encontró currículum para usuario {}", u.getId());
                            }
                        } catch (Exception e) {
                            log.warn("Error al obtener currículum para usuario {}: {}", u.getId(), e.getMessage());
                        }
                        
                        // Trayectoria: cursos, idiomas, logros, herramientas, artículos, propiedad intelectual (según visibilidad)
                        List<CursoItemDTO> cursos = new ArrayList<>();
                        List<IdiomaItemDTO> idiomas = new ArrayList<>();
                        List<LogroItemDTO> logros = new ArrayList<>();
                        List<String> herramientas = new ArrayList<>();
                        List<ArticuloItemDTO> articulos = new ArrayList<>();
                        List<PropiedadIntelectualItemDTO> propiedadIntelectual = new ArrayList<>();
                        try {
                            cursos = cursoRepository.findByUsuarioId(u.getId()).stream()
                                    .map(c -> new CursoItemDTO(c.getNombre(), c.getPrograma(), c.getHorasTotales(), c.getInstitucion()))
                                    .collect(Collectors.toList());
                            idiomas = idiomaRepository.findByUsuarioId(u.getId()).stream()
                                    .map(i -> new IdiomaItemDTO(i.getNombre(), i.getDominioNombre() != null ? i.getDominioNombre() : (i.getConversacion() != null ? i.getConversacion() : "")))
                                    .collect(Collectors.toList());
                            logros = logroRepository.findByUsuarioId(u.getId()).stream()
                                    .map(l -> new LogroItemDTO(l.getTipo(), l.getNombre(), l.getAnio()))
                                    .collect(Collectors.toList());
                            herramientas = herramientaRepository.findByUsuarioId(u.getId()).stream()
                                    .map(Herramienta::getNombre)
                                    .collect(Collectors.toList());
                            articulos = articuloRepository.findByUsuarioId(u.getId()).stream()
                                    .map(a -> new ArticuloItemDTO(a.getTitulo(), a.getNombreRevista(), a.getAnio(), a.getDoi()))
                                    .collect(Collectors.toList());
                            propiedadIntelectual = propiedadIntelectualRepository.findByUsuarioId(u.getId()).stream()
                                    .map(pi -> new PropiedadIntelectualItemDTO(pi.getTipo().name(), pi.getTitulo(), pi.getNumeroRegistro(),
                                            pi.getInstitucionOficina(), pi.getPais(), pi.getFechaRegistro(), pi.getAnio(), pi.getDescripcion()))
                                    .collect(Collectors.toList());
                        } catch (Exception e) {
                            log.warn("Error al cargar trayectoria para usuario {}: {}", u.getId(), e.getMessage());
                        }

                        // Aplicar visibilidad: qué se muestra en el módulo público
                        String visibilidad = u.getVisibilidadPerfil() != null ? u.getVisibilidadPerfil() : "ESTANDAR";
                        if ("MINIMA".equals(visibilidad)) {
                            email = null;
                            telefono = null;
                            semblanza = null;
                            fotoId = null;
                            curriculumId = null;
                            cursos = new ArrayList<>();
                            idiomas = new ArrayList<>();
                            logros = new ArrayList<>();
                            herramientas = new ArrayList<>();
                            articulos = new ArrayList<>();
                            propiedadIntelectual = new ArrayList<>();
                        } else if ("ESTANDAR".equals(visibilidad)) {
                            telefono = null;
                            curriculumId = null;
                            cursos = new ArrayList<>();
                            logros = new ArrayList<>();
                            articulos = new ArrayList<>();
                            propiedadIntelectual = new ArrayList<>();
                            // herramientas e idiomas sí se muestran en Estándar
                        }
                        // COMPLETA: se muestran todos los datos (ya cargados arriba)
                        
                        return new InvestigadorDTO(
                                u.getId(),
                                u.getNombre(),
                                u.getApellidoPaterno(),
                                u.getApellidoMaterno(),
                                email,
                                telefono,
                                gradoAcademico,
                                areaConocimiento,
                                semblanza,
                                tipoPerfil,
                                fotoId,
                                curriculumId,
                                cursos,
                                idiomas,
                                logros,
                                herramientas,
                                articulos,
                                propiedadIntelectual
                        );
                    })
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(investigadores);
        } catch (Exception e) {
            log.error("Error al listar investigadores: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String resolverGradoAcademicoMasAlto(Long usuarioId) {
        return trayectoriaAcademicaRepository.findByUsuarioId(usuarioId).stream()
                .max(Comparator
                        .comparingInt((TrayectoriaAcademica t) -> prioridadGrado(t.getNivelNombre()))
                        .thenComparing(TrayectoriaAcademica::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(TrayectoriaAcademica::getNivelNombre)
                .orElse(null);
    }

    private int prioridadGrado(String nivelNombre) {
        if (nivelNombre == null || nivelNombre.isBlank()) return 0;
        String n = nivelNombre.trim().toLowerCase(Locale.ROOT);

        if (n.contains("doctorado") || n.contains("phd") || n.contains("doctor")) return 500;
        if (n.contains("maestr")) return 400;
        if (n.contains("especialidad")) return 300;
        if (n.contains("licenciatura") || n.contains("ingenier") || n.contains("arquitect")) return 200;
        if (n.contains("tsu") || n.contains("tecnico superior") || n.contains("técnico superior") || n.contains("tecnico")) return 100;
        return 10;
    }

}


