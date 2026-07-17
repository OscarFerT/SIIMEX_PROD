package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.*;
import com.example.proyecto.demo.Repository.*;
import com.example.proyecto.demo.Service.AdminService;
import com.example.proyecto.demo.Service.AuditLogService;
import com.example.proyecto.demo.Service.DocumentoService;
import com.example.proyecto.demo.Service.ListaNegraService;
import lombok.RequiredArgsConstructor;
import com.example.proyecto.demo.dto.AdminCrearUsuarioRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final UsuarioRepository usuarioRepository;
    private final AuthUserRepository authUserRepository;
    private final DocumentoService documentoService;
    private final AdminService adminService;
    private final PasswordEncoder passwordEncoder;
    private final TrayectoriaAcademicaRepository trayectoriaAcademicaRepository;
    private final TrayectoriaProfesionalRepository trayectoriaProfesionalRepository;
    private final EstanciaRepository estanciaRepository;
    private final CongresoRepository congresoRepository;
    private final DivulgacionRepository divulgacionRepository;
    private final ArticuloRepository articuloRepository;
    private final CursoRepository cursoRepository;
    private final IdiomaRepository idiomaRepository;
    private final LogroRepository logroRepository;
    private final HerramientaRepository herramientaRepository;
    private final IncidenciaSocialRepository incidenciaSocialRepository;
    private final PropiedadIntelectualRepository propiedadIntelectualRepository;
    private final AreaConocimientoRepository areaConocimientoRepository;
    private final InstitucionRepository institucionRepository;
    private final InteresHabilidadRepository interesHabilidadRepository;
    private final PerfilMigracionRepository perfilMigracionRepository;
    private final PostulacionRepository postulacionRepository;
    private final AuditLogService auditLogService;
    private final ListaNegraService listaNegraService;
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
     * KPIs y estadísticas para el dashboard de administración (incluye datos para gráficas).
     */
    @GetMapping("/dashboard/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats(
            Authentication auth,
            @RequestParam(name = "convocatoriaId", required = false) Long convocatoriaId
    ) {
        // Para dashboard incluimos también registros importados sin authUser
        // para evitar métricas en cero cuando la base tiene perfiles migrados.
        List<Usuario> todos = usuarioRepository.findAllWithRelationsIncludingSinAuth();
        List<Postulacion> postulaciones = convocatoriaId != null
                ? postulacionRepository.findByConvocatoriaIdWithUsuario(convocatoriaId)
                : postulacionRepository.findAllWithUsuarioAndConvocatoria();
        List<Institucion> instituciones = institucionRepository.findAll();
        List<TrayectoriaAcademica> trayectoriasAcademicas = trayectoriaAcademicaRepository.findAll();

        Set<Long> usuarioIdsFiltrados = convocatoriaId != null
                ? postulaciones.stream()
                    .map(p -> p.getUsuario() != null ? p.getUsuario().getId() : null)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet())
                : todos.stream().map(Usuario::getId).collect(Collectors.toSet());

        List<Usuario> usuariosDashboard = convocatoriaId != null
                ? todos.stream()
                    .filter(u -> u.getId() != null && usuarioIdsFiltrados.contains(u.getId()))
                    .collect(Collectors.toList())
                : todos;

        List<Institucion> institucionesDashboard = convocatoriaId != null
                ? instituciones.stream()
                    .filter(i -> i.getUsuario() != null && i.getUsuario().getId() != null && usuarioIdsFiltrados.contains(i.getUsuario().getId()))
                    .collect(Collectors.toList())
                : instituciones;

        List<TrayectoriaAcademica> trayectoriasDashboard = convocatoriaId != null
                ? trayectoriasAcademicas.stream()
                    .filter(t -> t.getUsuario() != null && t.getUsuario().getId() != null && usuarioIdsFiltrados.contains(t.getUsuario().getId()))
                    .collect(Collectors.toList())
                : trayectoriasAcademicas;

        long totalUsuarios = usuariosDashboard.size();
        long totalSolicitudes = postulaciones.size();
        long investigadores = usuariosDashboard.stream()
                .filter(u -> u.getRegistro1() != null && u.getRegistro1().getTipoPerfil() == Registro1.TipoPerfil.INVESTIGADOR)
                .count();
        long innovadores = usuariosDashboard.stream()
                .filter(u -> u.getRegistro1() != null && u.getRegistro1().getTipoPerfil() == Registro1.TipoPerfil.INNOVADOR)
                .count();
        long hibridos = usuariosDashboard.stream()
                .filter(u -> u.getRegistro1() != null && u.getRegistro1().getTipoPerfil() == Registro1.TipoPerfil.HIBRIDO)
                .count();
        long cuentasActivas = usuariosDashboard.stream()
                .filter(u -> u.getAuthUser() != null && u.getAuthUser().isEnabled())
                .count();
        long cuentasSuspendidas = usuariosDashboard.stream()
                .filter(u -> u.getAuthUser() != null && !u.getAuthUser().isEnabled())
                .count();

        // Registros por mes (últimos 12 meses)
        YearMonth now = YearMonth.now();
        List<Map<String, Object>> registrosPorMes = new ArrayList<>();
        List<Map<String, Object>> actualizacionesPorMes = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM");
        for (int i = 11; i >= 0; i--) {
            YearMonth ym = now.minusMonths(i);
            String clave = ym.format(fmt);
            long cantidad = usuariosDashboard.stream()
                    .filter(u -> u.getRegistro1() != null && u.getRegistro1().getCreatedAt() != null)
                    .filter(u -> {
                        LocalDate d = u.getRegistro1().getCreatedAt();
                        return YearMonth.from(d).equals(ym);
                    })
                    .count();
            Map<String, Object> punto = new HashMap<>();
            punto.put("mes", clave);
            punto.put("etiqueta", ym.getMonthValue() + "/" + (ym.getYear() % 100));
            punto.put("cantidad", cantidad);
            registrosPorMes.add(punto);

            long actualizaciones = usuariosDashboard.stream()
                    .filter(u -> u.getRegistro1() != null && u.getRegistro1().getUpdatedAt() != null)
                    .filter(u -> {
                        LocalDate d = u.getRegistro1().getUpdatedAt();
                        return YearMonth.from(d).equals(ym);
                    })
                    .count();
            Map<String, Object> puntoActualizacion = new HashMap<>();
            puntoActualizacion.put("mes", clave);
            puntoActualizacion.put("etiqueta", ym.getMonthValue() + "/" + (ym.getYear() % 100));
            puntoActualizacion.put("cantidad", actualizaciones);
            actualizacionesPorMes.add(puntoActualizacion);
        }

        // Por tipo de perfil (para gráfica circular)
        Map<String, Long> porTipoPerfil = new LinkedHashMap<>();
        porTipoPerfil.put("INVESTIGADOR", investigadores);
        porTipoPerfil.put("INNOVADOR", innovadores);
        porTipoPerfil.put("HIBRIDO", hibridos);

        // Sexo / género
        Map<String, Long> porSexo = ordenarPorConteo(
                usuariosDashboard.stream()
                        .map(this::resolverGeneroDashboard)
                        .filter(v -> !"NO ESPECIFICADO".equals(v))
                        .collect(Collectors.groupingBy(v -> v, Collectors.counting())),
                10
        );

        // Modalidad de convocatorias (desde tipo de solicitud de postulaciones)
        Map<String, Long> porModalidadConvocatoria = ordenarPorConteo(
                postulaciones.stream()
                        .map(p -> normalizarTextoClave(p.getTipoSolicitud(), "NO ESPECIFICADA"))
                        .collect(Collectors.groupingBy(v -> v, Collectors.counting())),
                10
        );

        // Tipo INV/HIB/INN
        Map<String, Long> porTipoInves = ordenarPorConteo(
                usuariosDashboard.stream()
                        .map(u -> {
                            Registro1 r = u.getRegistro1();
                            if (r == null || r.getTipoPerfil() == null) return "SIN TIPO";
                            return switch (r.getTipoPerfil()) {
                                case INVESTIGADOR -> "INV";
                                case INNOVADOR -> "INN";
                                case HIBRIDO -> "HIB";
                            };
                        })
                        .collect(Collectors.groupingBy(v -> v, Collectors.counting())),
                10
        );

        // Municipio (desde registro base del usuario)
        Map<String, Long> porMunicipio = ordenarPorConteo(
                usuariosDashboard.stream()
                        .map(u -> normalizarTextoClave(
                                u.getRegistro1() != null ? u.getRegistro1().getMunicipio() : null,
                                "SIN MUNICIPIO"))
                        .collect(Collectors.groupingBy(v -> v, Collectors.counting())),
                10
        );

        // Institución (catálogo vinculado en completar registro)
        Map<String, Long> porInstitucion = ordenarPorConteo(
                institucionesDashboard.stream()
                        .map(i -> normalizarTextoClave(i.getNombre(), "SIN INSTITUCIÓN"))
                        .collect(Collectors.groupingBy(v -> v, Collectors.counting())),
                10
        );

        // Grado académico (mejor grado por usuario)
        Map<Long, String> gradoMayorPorUsuario = new HashMap<>();
        Map<Long, Integer> prioridadGradoPorUsuario = new HashMap<>();
        for (TrayectoriaAcademica ta : trayectoriasDashboard) {
            Long usuarioId = (ta.getUsuario() != null) ? ta.getUsuario().getId() : null;
            if (usuarioId == null) continue;
            String grado = normalizarGradoAcademico(ta.getNivelNombre());
            int prioridad = prioridadGradoAcademico(grado);
            Integer actual = prioridadGradoPorUsuario.get(usuarioId);
            if (actual == null || prioridad > actual) {
                prioridadGradoPorUsuario.put(usuarioId, prioridad);
                gradoMayorPorUsuario.put(usuarioId, grado);
            }
        }
        Map<String, Long> porGradoAcademico = ordenarPorConteo(
                gradoMayorPorUsuario.values().stream()
                        .map(g -> normalizarTextoClave(g, "SIN GRADO"))
                        .collect(Collectors.groupingBy(v -> v, Collectors.counting())),
                10
        );

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsuarios", totalUsuarios);
        stats.put("totalSolicitudes", totalSolicitudes);
        stats.put("investigadores", investigadores);
        stats.put("innovadores", innovadores);
        stats.put("hibridos", hibridos);
        stats.put("cuentasActivas", cuentasActivas);
        stats.put("cuentasSuspendidas", cuentasSuspendidas);
        stats.put("registrosPorMes", registrosPorMes);
        stats.put("actualizacionesPorMes", actualizacionesPorMes);
        stats.put("porTipoPerfil", porTipoPerfil);
        stats.put("porSexo", porSexo);
        stats.put("porModalidadConvocatoria", porModalidadConvocatoria);
        stats.put("porTipoInves", porTipoInves);
        stats.put("porMunicipio", porMunicipio);
        stats.put("porInstitucion", porInstitucion);
        stats.put("porGradoAcademico", porGradoAcademico);
        stats.put("convocatoriaId", convocatoriaId);
        return ResponseEntity.ok(stats);
    }

    /**
     * Crear usuario desde el panel admin (alta manual).
     */
    @PostMapping("/registros")
    public ResponseEntity<Map<String, Object>> crearUsuario(Authentication auth,
                                                            @Valid @RequestBody AdminCrearUsuarioRequest request,
                                                            HttpServletRequest http) {
        Usuario u = adminService.crearUsuario(request);
        auditLogService.registrarAdmin("CREAR_USUARIO", "Usuario creado: " + request.email(), getAdminId(auth), getAdminEmail(auth), "Usuario", u.getId(), getIp(http));
        Map<String, Object> resp = new HashMap<>();
        resp.put("id", u.getId());
        resp.put("email", u.getAuthUser() != null ? u.getAuthUser().getEmail() : null);
        resp.put("message", "Usuario creado correctamente");
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(resp);
    }

    /**
     * Listado de registros (usuarios) para revisión.
     */
    @GetMapping("/registros")
    public ResponseEntity<List<Map<String, Object>>> getRegistros(Authentication auth) {
        List<Usuario> usuarios = usuarioRepository.findAllWithRelations();

        List<Map<String, Object>> list = usuarios.stream().map(u -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", u.getId());
            item.put("nombre", u.getNombre());
            item.put("apellidoPaterno", u.getApellidoPaterno());
            item.put("apellidoMaterno", u.getApellidoMaterno());
            item.put("email", u.getAuthUser() != null ? u.getAuthUser().getEmail() : null);
            item.put("roles", u.getAuthUser() != null ? u.getAuthUser().getRoles() : java.util.Collections.emptySet());
            Instant lastLogin = u.getAuthUser() != null ? u.getAuthUser().getLastLoginAt() : null;
            item.put("lastLoginAt", lastLogin != null ? lastLogin.toString() : null);
            item.put("bloqueadoListaNegra", listaNegraService.tieneBloqueoActivo(
                    u.getId(),
                    u.getAuthUser() != null ? u.getAuthUser().getEmail() : null,
                    u.getRegistro1() != null ? u.getRegistro1().getCurp() : null
            ));
            Optional<Documento> fotoOpt = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.FOTO_PERFIL);
            item.put("fotoDocumentoId", fotoOpt.map(Documento::getId).orElse(null));
            if (u.getRegistro1() != null) {
                Registro1 r = u.getRegistro1();
                item.put("curp", r.getCurp());
                item.put("tipoPerfil", r.getTipoPerfil() != null ? r.getTipoPerfil().name() : null);
                item.put("telefono", r.getTelefono());
                item.put("rfc", r.getRfc());
                item.put("fechaNacimiento", r.getFechaNacimiento() != null ? r.getFechaNacimiento().toString() : null);
                item.put("genero", r.getGenero() != null ? r.getGenero().name() : null);
                item.put("nacionalidad", r.getNacionalidad());
                item.put("paisNacimiento", r.getPaisNacimiento());
                item.put("entidadFederativa", r.getEntidadFederativa());
                item.put("municipio", r.getMunicipio());
                item.put("estadoCivil", r.getEstadoCivil() != null ? r.getEstadoCivil().name() : null);
            }
            return item;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(list);
    }

    /**
     * Detalle de un usuario por ID (para el modal del panel admin). Incluye fotoDocumentoId para mostrar imagen.
     */
    @GetMapping("/registros/{id}")
    public ResponseEntity<Map<String, Object>> getRegistroDetalle(Authentication auth, @PathVariable Long id) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Map<String, Object> item = new HashMap<>();
        item.put("id", u.getId());
        item.put("nombre", u.getNombre());
        item.put("apellidoPaterno", u.getApellidoPaterno());
        item.put("apellidoMaterno", u.getApellidoMaterno());
        item.put("visibilidadPerfil", u.getVisibilidadPerfil());
        Optional<Documento> fotoOpt = documentoService.obtenerDocumentoPorUsuarioYTipo(u.getId(), Documento.TipoDocumento.FOTO_PERFIL);
        item.put("fotoDocumentoId", fotoOpt.map(Documento::getId).orElse(null));
        if (u.getAuthUser() != null) {
            item.put("email", u.getAuthUser().getEmail());
            item.put("username", u.getAuthUser().getUsername());
            item.put("enabled", u.getAuthUser().isEnabled());
            item.put("locked", u.getAuthUser().isLocked());
            item.put("roles", u.getAuthUser().getRoles());
            Instant last = u.getAuthUser().getLastLoginAt();
            item.put("lastLoginAt", last != null ? last.toString() : null);
        }
        item.put("bloqueadoListaNegra", listaNegraService.tieneBloqueoActivo(
                u.getId(),
                u.getAuthUser() != null ? u.getAuthUser().getEmail() : null,
                u.getRegistro1() != null ? u.getRegistro1().getCurp() : null
        ));
        if (u.getRegistro1() != null) {
            Registro1 r = u.getRegistro1();
            item.put("curp", r.getCurp());
            item.put("rfc", r.getRfc());
            item.put("tipoPerfil", r.getTipoPerfil() != null ? r.getTipoPerfil().name() : null);
            item.put("telefono", r.getTelefono());
            item.put("fechaNacimiento", r.getFechaNacimiento() != null ? r.getFechaNacimiento().toString() : null);
            item.put("genero", r.getGenero() != null ? r.getGenero().name() : null);
            item.put("nacionalidad", r.getNacionalidad());
            item.put("paisNacimiento", r.getPaisNacimiento());
            item.put("entidadFederativa", r.getEntidadFederativa());
            item.put("municipio", r.getMunicipio());
            item.put("estadoCivil", r.getEstadoCivil() != null ? r.getEstadoCivil().name() : null);
            item.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
            item.put("updatedAt", r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : null);
        }

        String semblanza = interesHabilidadRepository.findByUsuarioId(u.getId())
                .map(InteresHabilidad::getInteresDescripcion)
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .orElseGet(() -> {
                    if (u.getSemblanza() == null || u.getSemblanza().isBlank()) {
                        return null;
                    }
                    return u.getSemblanza().trim();
                });
        item.put("semblanza", semblanza);

        item.put("interesHabilidad", interesHabilidadRepository.findByUsuarioId(u.getId()).map(ih -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", ih.getId());
            m.put("interesDescripcion", ih.getInteresDescripcion());
            m.put("habilidadDescripcion", ih.getHabilidadDescripcion());
            m.put("habilidadNivel", ih.getHabilidadNivel());
            return m;
        }).orElse(null));

        item.put("institucion", institucionRepository.findByUsuarioId(u.getId()).stream().findFirst().map(inst -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", inst.getId());
            m.put("nombre", inst.getNombre());
            m.put("claveOficial", inst.getClaveOficial());
            m.put("tipoNombre", inst.getTipoNombre());
            m.put("paisNombre", inst.getPaisNombre());
            m.put("entidadNombre", inst.getEntidadNombre());
            m.put("municipioNombre", inst.getMunicipioNombre());
            m.put("nivelUnoNombre", inst.getNivelUnoNombre());
            m.put("nivelDosNombre", inst.getNivelDosNombre());
            return m;
        }).orElse(null));

        item.put("areaConocimiento", areaConocimientoRepository.findByUsuarioId(u.getId()).stream().findFirst().map(area -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", area.getId());
            m.put("areaNombre", area.getAreaNombre());
            m.put("areaClave", area.getAreaClave());
            m.put("campoNombre", area.getCampoNombre());
            m.put("campoClave", area.getCampoClave());
            m.put("disciplinaNombre", area.getDisciplinaNombre());
            m.put("disciplinaClave", area.getDisciplinaClave());
            m.put("subdisciplinaNombre", area.getSubdisciplinaNombre());
            m.put("subdisciplinaClave", area.getSubdisciplinaClave());
            return m;
        }).orElse(null));

        item.put("perfilMigracion", perfilMigracionRepository.findByUsuarioId(u.getId()).map(pm -> {
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
        }).orElse(null));

        List<Documento> documentos = documentoService.obtenerDocumentosPorUsuario(u.getId());
        item.put("curriculumDocumentoId",
                Optional.ofNullable(obtenerDocumentoPreferente(documentos, Documento.TipoDocumento.CURRICULUM, Documento.TipoDocumento.CV))
                        .map(Documento::getId)
                        .orElse(null));
        item.put("ineDocumentoId",
                Optional.ofNullable(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.FISCAL_PDF))
                        .map(Documento::getId)
                        .orElse(null));
        item.put("domicilioDocumentoId",
                Optional.ofNullable(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.DOMICILIO))
                        .map(Documento::getId)
                        .orElse(null));
        item.put("cedulaDocumentoId",
                Optional.ofNullable(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CEDULA_PROFESIONAL))
                        .map(Documento::getId)
                        .orElse(null));

        Map<String, Object> evidencias = new LinkedHashMap<>();
        evidencias.put("curriculum", mapDocumentoResumen(obtenerDocumentoPreferente(documentos, Documento.TipoDocumento.CURRICULUM, Documento.TipoDocumento.CV)));
        evidencias.put("ine", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.FISCAL_PDF)));
        evidencias.put("domicilio", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.DOMICILIO)));
        evidencias.put("cedula", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CEDULA_PROFESIONAL)));
        evidencias.put("cert1", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CERTIFICADO_1)));
        evidencias.put("cert2", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CERTIFICADO_2)));
        evidencias.put("constanciaSnii", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.CONSTANCIA_SNII)));
        evidencias.put("divulgacion", mapDocumentoResumen(obtenerUltimoDocumentoPorTipo(documentos, Documento.TipoDocumento.DIVULGACION)));
        item.put("evidencias", evidencias);
        item.put("evidenciasRubrosPersonalizadas", agruparEvidenciasPorRubro(documentos));

        Long uid = u.getId();

        item.put("trayectoriaAcademica", trayectoriaAcademicaRepository.findByUsuarioId(uid).stream().map(ta -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", ta.getId());
            m.put("nivelNombre", ta.getNivelNombre());
            m.put("titulo", ta.getTitulo());
            m.put("estatusNombre", ta.getEstatusNombre());
            m.put("cedulaProfesional", ta.getCedulaProfesional());
            m.put("esPerfilSnii", ta.getEsPerfilSnii());
            m.put("opcionTitulacion", ta.getOpcionTitulacion());
            m.put("tituloTesis", ta.getTituloTesis());
            m.put("fechaObtencion", ta.getFechaObtencion() != null ? ta.getFechaObtencion().toString() : null);
            m.put("institucion", ta.getInstitucion());
            return m;
        }).collect(Collectors.toList()));

        item.put("trayectoriaProfesional", trayectoriaProfesionalRepository.findByUsuarioId(uid).stream().map(tp -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", tp.getId());
            m.put("nombramiento", tp.getNombramiento());
            m.put("fechaInicio", tp.getFechaInicio() != null ? tp.getFechaInicio().toString() : null);
            m.put("fechaFin", tp.getFechaFin() != null ? tp.getFechaFin().toString() : null);
            m.put("esActual", tp.getEsActual());
            m.put("logros", tp.getLogros());
            m.put("institucion", tp.getInstitucion());
            return m;
        }).collect(Collectors.toList()));

        item.put("estancias", estanciaRepository.findByUsuarioId(uid).stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", e.getId());
            m.put("nombreProyecto", e.getNombreProyecto());
            m.put("tipoNombre", e.getTipoNombre());
            m.put("logros", e.getLogros());
            m.put("fechaInicio", e.getFechaInicio() != null ? e.getFechaInicio().toString() : null);
            m.put("fechaFin", e.getFechaFin() != null ? e.getFechaFin().toString() : null);
            m.put("institucionReceptora", e.getInstitucionReceptora());
            return m;
        }).collect(Collectors.toList()));

        item.put("congresos", congresoRepository.findByUsuarioId(uid).stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("nombreEvento", c.getNombreEvento());
            m.put("tituloTrabajo", c.getTituloTrabajo());
            m.put("tipoParticipacionNombre", c.getTipoParticipacionNombre());
            m.put("fecha", c.getFecha() != null ? c.getFecha().toString() : null);
            m.put("paisSede", c.getPaisSede());
            return m;
        }).collect(Collectors.toList()));

        item.put("divulgaciones", divulgacionRepository.findByUsuarioId(uid).stream().map(d -> {
            Map<String, Object> m = new HashMap<>();
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

        item.put("articulos", articuloRepository.findByUsuarioId(uid).stream().map(a -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", a.getId());
            m.put("titulo", a.getTitulo());
            m.put("tipo", a.getTipo());
            m.put("anio", a.getAnio());
            m.put("issn", a.getIssn());
            m.put("doi", a.getDoi());
            m.put("nombreRevista", a.getNombreRevista());
            m.put("rolParticipacionNombre", a.getRolParticipacionNombre());
            m.put("estadoNombre", a.getEstadoNombre());
            m.put("productoPrincipal", a.getProductoPrincipal());
            if (a.getAutores() != null) {
                m.put("autores", a.getAutores().stream().map(au -> {
                    Map<String, Object> am = new HashMap<>();
                    am.put("nombreCompleto", au.getNombreCompleto());
                    am.put("orcid", au.getOrcid());
                    am.put("orden", au.getOrden());
                    return am;
                }).collect(Collectors.toList()));
            }
            return m;
        }).collect(Collectors.toList()));

        item.put("cursos", cursoRepository.findByUsuarioId(uid).stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("nombre", c.getNombre());
            m.put("programa", c.getPrograma());
            m.put("horasTotales", c.getHorasTotales());
            m.put("fechaInicio", c.getFechaInicio() != null ? c.getFechaInicio().toString() : null);
            m.put("fechaFin", c.getFechaFin() != null ? c.getFechaFin().toString() : null);
            m.put("institucion", c.getInstitucion());
            m.put("nivelEscolaridad", c.getNivelEscolaridad());
            return m;
        }).collect(Collectors.toList()));

        item.put("idiomas", idiomaRepository.findByUsuarioId(uid).stream().map(i -> {
            Map<String, Object> m = new HashMap<>();
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

        item.put("logros", logroRepository.findByUsuarioId(uid).stream().map(l -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", l.getId());
            m.put("tipo", l.getTipo());
            m.put("nombre", l.getNombre());
            m.put("anio", l.getAnio());
            return m;
        }).collect(Collectors.toList()));

        item.put("herramientas", herramientaRepository.findByUsuarioId(uid).stream().map(h -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", h.getId());
            m.put("nombre", h.getNombre());
            return m;
        }).collect(Collectors.toList()));

        item.put("incidenciaSocial", incidenciaSocialRepository.findByUsuarioId(uid).stream().map(is -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", is.getId());
            m.put("titulo", is.getTitulo());
            m.put("ubicacion", is.getUbicacion());
            m.put("descripcion", is.getDescripcion());
            m.put("fecha", is.getFecha() != null ? is.getFecha().toString() : null);
            m.put("anio", is.getAnio());
            return m;
        }).collect(Collectors.toList()));

        item.put("propiedadIntelectual", propiedadIntelectualRepository.findByUsuarioId(uid).stream().map(pi -> {
            Map<String, Object> m = new HashMap<>();
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

        return ResponseEntity.ok(item);
    }

    /**
     * Suspender cuenta: enabled=false, locked=true.
     */
    @PatchMapping("/registros/{id}/suspender")
    public ResponseEntity<Map<String, String>> suspender(@PathVariable Long id, Authentication auth, HttpServletRequest http) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (u.getAuthUser() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Usuario sin cuenta de acceso"));
        }
        u.getAuthUser().setEnabled(false);
        u.getAuthUser().setLocked(true);
        authUserRepository.save(u.getAuthUser());
        auditLogService.registrarAdmin("SUSPENDER_USUARIO", "Cuenta suspendida: " + u.getAuthUser().getEmail(), getAdminId(auth), getAdminEmail(auth), "Usuario", id, getIp(http));
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Usuario suspendido"));
    }

    /**
     * Reactivar cuenta: enabled=true, locked=false.
     */
    @PatchMapping("/registros/{id}/reactivar")
    public ResponseEntity<Map<String, String>> reactivar(@PathVariable Long id, Authentication auth, HttpServletRequest http) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (u.getAuthUser() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Usuario sin cuenta de acceso"));
        }
        u.getAuthUser().setEnabled(true);
        u.getAuthUser().setLocked(false);
        authUserRepository.save(u.getAuthUser());
        auditLogService.registrarAdmin("REACTIVAR_USUARIO", "Cuenta reactivada: " + u.getAuthUser().getEmail(), getAdminId(auth), getAdminEmail(auth), "Usuario", id, getIp(http));
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Usuario reactivado"));
    }

    /**
     * Restablecer contraseña. Body opcional: { "nuevaPassword": "xxx" }. Si no se envía, se genera una temporal.
     */
    @PostMapping("/registros/{id}/reset-password")
    public ResponseEntity<Map<String, Object>> restablecerPassword(@PathVariable Long id,
                                                                   @RequestBody(required = false) Map<String, String> body,
                                                                   Authentication auth, HttpServletRequest http) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (u.getAuthUser() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Usuario sin cuenta de acceso"));
        }
        String nuevaPassword = body != null && body.containsKey("nuevaPassword") && body.get("nuevaPassword") != null && !body.get("nuevaPassword").isBlank()
                ? body.get("nuevaPassword")
                : "Temp" + (int) (Math.random() * 9000 + 1000) + "!";
        u.getAuthUser().setPasswordHash(passwordEncoder.encode(nuevaPassword));
        authUserRepository.save(u.getAuthUser());
        auditLogService.registrarAdmin("RESET_PASSWORD_ADMIN", "Contraseña restablecida por admin para: " + u.getAuthUser().getEmail(), getAdminId(auth), getAdminEmail(auth), "Usuario", id, getIp(http));
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Contraseña actualizada", "nuevaPassword", nuevaPassword));
    }

    /**
     * Otorgar o revocar rol de administrador a un usuario.
     */
    @PatchMapping("/registros/{id}/toggle-admin")
    public ResponseEntity<Map<String, Object>> toggleAdmin(@PathVariable Long id, @RequestBody Map<String, Boolean> body, Authentication auth, HttpServletRequest http) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (u.getAuthUser() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "El usuario no tiene cuenta de autenticación");
        }
        boolean hacerAdmin = Boolean.TRUE.equals(body.get("admin"));
        if (hacerAdmin) {
            u.getAuthUser().getRoles().add("ROLE_ADMIN");
        } else {
            u.getAuthUser().getRoles().remove("ROLE_ADMIN");
        }
        authUserRepository.save(u.getAuthUser());
        String accion = hacerAdmin ? "OTORGAR_ADMIN" : "REVOCAR_ADMIN";
        auditLogService.registrarAdmin(accion, (hacerAdmin ? "Rol admin otorgado a: " : "Rol admin revocado a: ") + u.getAuthUser().getEmail(), getAdminId(auth), getAdminEmail(auth), "Usuario", id, getIp(http));
        return ResponseEntity.ok(Map.of("status", "ok", "roles", u.getAuthUser().getRoles()));
    }

    /**
     * Otorgar o revocar rol de evaluador a un usuario.
     */
    @PatchMapping("/registros/{id}/toggle-evaluador")
    public ResponseEntity<Map<String, Object>> toggleEvaluador(@PathVariable Long id, @RequestBody Map<String, Boolean> body, Authentication auth, HttpServletRequest http) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (u.getAuthUser() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "El usuario no tiene cuenta de autenticación");
        }
        boolean hacerEvaluador = Boolean.TRUE.equals(body.get("evaluador"));
        if (hacerEvaluador) {
            u.getAuthUser().getRoles().add("ROLE_EVALUADOR");
        } else {
            u.getAuthUser().getRoles().remove("ROLE_EVALUADOR");
        }
        authUserRepository.save(u.getAuthUser());
        String accion = hacerEvaluador ? "OTORGAR_EVALUADOR" : "REVOCAR_EVALUADOR";
        auditLogService.registrarAdmin(accion, (hacerEvaluador ? "Rol evaluador otorgado a: " : "Rol evaluador revocado a: ") + u.getAuthUser().getEmail(), getAdminId(auth), getAdminEmail(auth), "Usuario", id, getIp(http));
        return ResponseEntity.ok(Map.of("status", "ok", "roles", u.getAuthUser().getRoles()));
    }

    /**
     * Eliminar usuario y todos sus datos (cuenta, documentos, trayectoria, etc.).
     */
    @DeleteMapping("/registros/{id}")
    public ResponseEntity<Map<String, String>> eliminar(@PathVariable Long id, Authentication auth, HttpServletRequest http) {
        auditLogService.registrarAdmin("ELIMINAR_USUARIO", "Usuario eliminado (ID " + id + ")", getAdminId(auth), getAdminEmail(auth), "Usuario", id, getIp(http));
        adminService.eliminarUsuario(id);
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Usuario eliminado"));
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

    private String getIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    private Long getAdminId(Authentication auth) {
        try { return Long.valueOf(auth.getName()); } catch (Exception e) { return null; }
    }

    private String getAdminEmail(Authentication auth) {
        try {
            Long id = Long.valueOf(auth.getName());
            return authUserRepository.findById(id).map(AuthUser::getEmail).orElse(auth.getName());
        } catch (Exception e) { return auth.getName(); }
    }

    private String normalizarTextoClave(String value, String fallback) {
        String limpio = value != null ? value.trim() : "";
        if (limpio.isBlank()) return fallback;
        return limpio.toUpperCase(Locale.ROOT);
    }

    private LinkedHashMap<String, Long> ordenarPorConteo(Map<String, Long> source, int limit) {
        return source.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(Math.max(1, limit))
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
    }

    private String normalizarGradoAcademico(String nivelNombre) {
        String grado = nivelNombre != null ? nivelNombre.trim() : "";
        return grado.isBlank() ? "SIN GRADO" : grado;
    }

    private int prioridadGradoAcademico(String gradoRaw) {
        String grado = gradoRaw != null ? gradoRaw.toUpperCase(Locale.ROOT) : "";
        if (grado.contains("DOCTOR")) return 6;
        if (grado.contains("MAESTR")) return 5;
        if (grado.contains("ESPECIAL")) return 4;
        if (grado.contains("LICENCIATURA") || grado.contains("INGENIER") || grado.contains("ARQUITECT")) return 3;
        if (grado.contains("TECNIC") || grado.contains("TSU")) return 2;
        if (grado.contains("BACHILLER")) return 1;
        return 0;
    }

    private String resolverGeneroDashboard(Usuario usuario) {
        Registro1 r = usuario != null ? usuario.getRegistro1() : null;
        if (r != null && r.getGenero() != null) {
            return switch (r.getGenero()) {
                case MASCULINO -> "HOMBRE";
                case FEMENINO -> "MUJER";
                case OTRO -> inferirGeneroDesdeCurp(r.getCurp());
            };
        }
        return inferirGeneroDesdeCurp(r != null ? r.getCurp() : null);
    }

    private String inferirGeneroDesdeCurp(String curpRaw) {
        if (curpRaw == null) return "NO ESPECIFICADO";
        String curp = curpRaw.trim().toUpperCase(Locale.ROOT);
        if (curp.length() < 11) return "NO ESPECIFICADO";
        char sexo = curp.charAt(10);
        if (sexo == 'H') return "HOMBRE";
        if (sexo == 'M' || sexo == 'F') return "MUJER";
        return "NO ESPECIFICADO";
    }
}
