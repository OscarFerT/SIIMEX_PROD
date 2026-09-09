package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.Convocatoria;
import com.example.proyecto.demo.Entity.ConvocatoriaFormato;
import com.example.proyecto.demo.Entity.AreaConocimiento;
import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Estancia;
import com.example.proyecto.demo.Entity.Institucion;
import com.example.proyecto.demo.Entity.Notificacion;
import com.example.proyecto.demo.Entity.Postulacion;
import com.example.proyecto.demo.Entity.PostulacionDocumento;
import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.AuthUserRepository;
import com.example.proyecto.demo.Repository.AreaConocimientoRepository;
import com.example.proyecto.demo.Repository.EstanciaRepository;
import com.example.proyecto.demo.Repository.InstitucionRepository;
import com.example.proyecto.demo.Repository.PostulacionDocumentoRepository;
import com.example.proyecto.demo.Repository.PostulacionRepository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.exception.ApiException;
import com.example.proyecto.demo.util.FileSecurityUtils;
import com.example.proyecto.demo.util.SimplePdfGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PostulacionService {
    private static final int PLAZO_CORRECCION_HORAS_DEFAULT = 120;
    private static final int PLAZO_CORRECCION_HORAS_MIN = 1;
    private static final int PLAZO_CORRECCION_HORAS_MAX = 24 * 30;
    private static final String CLAVE_CARTA_EVALUADOR_FIRMADA = "carta_evaluador_firmada";
    private static final String CLAVE_DICTAMEN_EVALUACION_FIRMADO = "dictamen_evaluacion_firmado";

    private final PostulacionRepository postulacionRepo;
    private final PostulacionDocumentoRepository postulacionDocumentoRepo;
    private final UsuarioRepository usuarioRepo;
    private final AuthUserRepository authUserRepository;
    private final AreaConocimientoRepository areaConocimientoRepository;
    private final InstitucionRepository institucionRepository;
    private final EstanciaRepository estanciaRepository;
    private final ConvocatoriaService convocatoriaService;
    private final ConvocatoriaFormatoService convocatoriaFormatoService;
    private final DocumentoService documentoService;
    private final ConfiguracionSistemaService configuracionSistemaService;
    private final CompatibilidadService compatibilidadService;
    private final MicrosoftGraphEmailService emailService;
    private final NotificacionService notificacionService;
    private final FeriadoService feriadoService;
    private final ListaNegraService listaNegraService;

    @Transactional
    public Postulacion crear(Long authUserId, Long convocatoriaId,
                             String cedula, String curp, String correo, String telefono,
                             String tipoApoyo,
                             String tipoSolicitud, LocalDate fechaEvento,
                             String tituloProyecto, String descripcionProyecto,
                             String observaciones, String criteriosJson,
                             Boolean aceptaAvisoPrivacidad,
                             MultipartFile cvFile,
                             Map<String, MultipartFile> documentosAdjuntos) throws IOException {
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        LocalDate fechaEventoNormalizada = normalizarFechaEvento(convocatoria, fechaEvento);
        validarCandadosYFechas(convocatoria, fechaEventoNormalizada);
        validarNoEsEvaluadorEnConvocatoria(convocatoriaId, authUserId);
        listaNegraService.validarNoBloqueado(usuario, correo, curp);

        if (!postulacionRepo.findByUsuarioIdAndConvocatoriaId(usuario.getId(), convocatoriaId).isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "Ya tienes una postulaci\u00f3n para esta convocatoria");
        }

        List<RequisitoDocumento> requisitos = parseRequisitosDocumentos(convocatoria.getRequisitosDocumentos());
        validarDocumentosRequeridos(requisitos, documentosAdjuntos != null ? documentosAdjuntos : Map.of());

        String tipoApoyoValidado = validarTipoApoyoConvocatoria(convocatoria, tipoApoyo);
        String tipoSolicitudNormalizada = normalizarTipoSolicitud(convocatoria, tipoSolicitud);
        String tituloProyectoNormalizado = normalizarTituloProyecto(convocatoria, tituloProyecto);
        String descripcionProyectoNormalizada = normalizarDescripcionProyecto(convocatoria, descripcionProyecto);
        String observacionesNormalizadas = observaciones != null ? observaciones.trim() : null;
        String criteriosJsonNormalizado = criteriosJson != null ? criteriosJson.trim() : null;
        validarReglasConfigurablesConvocatoria(
                convocatoria,
                cedula,
                curp,
                correo,
                telefono,
                tipoApoyoValidado,
                tipoSolicitudNormalizada,
                fechaEventoNormalizada,
                tituloProyectoNormalizado,
                descripcionProyectoNormalizada,
                observacionesNormalizadas,
                criteriosJsonNormalizado
        );

        Documento docCv = null;
        if (cvFile != null && !cvFile.isEmpty()) {
            docCv = guardarCurriculum(usuario.getId(), convocatoriaId, cvFile);
        }

        Postulacion p = Postulacion.builder()
                .usuario(usuario)
                .convocatoria(convocatoria)
                .cedula(cedula != null ? cedula.trim() : null)
                .curp(curp != null ? curp.trim().toUpperCase() : null)
                .correo(correo != null ? correo.trim() : "")
                .telefono(telefono != null ? telefono.trim() : null)
                .tipoApoyo(tipoApoyoValidado)
                .tipoSolicitud(tipoSolicitudNormalizada)
                .fechaEvento(fechaEventoNormalizada)
                .tituloProyecto(tituloProyectoNormalizado)
                .descripcionProyecto(descripcionProyectoNormalizada)
                .observaciones(observacionesNormalizadas)
                .criteriosJson(criteriosJsonNormalizado)
                .avisoPrivacidadAceptado(validarYResolverAvisoPrivacidad(convocatoria, aceptaAvisoPrivacidad, false))
                .fechaAceptacionAvisoPrivacidad(resolverFechaAceptacionAvisoPrivacidad(convocatoria, aceptaAvisoPrivacidad, false))
                .curriculumDocumento(docCv)
                .estado("PENDIENTE")
                .build();
        p = postulacionRepo.save(p);
        if (p.getFolio() == null || p.getFolio().isBlank()) {
            p.setFolio(generarFolioUnico(p));
            p = postulacionRepo.save(p);
        }

        if (documentosAdjuntos != null && !documentosAdjuntos.isEmpty()) {
            guardarDocumentosAdjuntos(p, usuario.getId(), convocatoriaId, documentosAdjuntos);
        }
        try {
            String nombre = obtenerNombreUsuario(p);
            notificacionService.crearParaAdmins(
                    "Nueva postulaci\u00f3n",
                    nombre + " se postul\u00f3 a \"" + convocatoria.getTitulo() + "\".",
                    Notificacion.TipoNotificacion.NUEVA_POSTULACION,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificaci\u00f3n admin de nueva postulaci\u00f3n: {}", e.getMessage());
        }
        return p;
    }

    public List<Map<String, Object>> listarMias(Long authUserId) {
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        List<Postulacion> lista = postulacionRepo.findByUsuarioIdWithConvocatoria(usuario.getId());
        boolean actualizados = false;
        for (Postulacion p : lista) {
            if (actualizarIncumplimientoInformesSiAplica(p)) {
                actualizados = true;
            }
        }
        if (actualizados) {
            postulacionRepo.saveAll(lista);
        }
        return lista.stream().map(this::toResumenMap).toList();
    }

    public Map<String, Object> obtenerMiaPorConvocatoria(Long authUserId, Long convocatoriaId) {
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        List<Postulacion> lista = postulacionRepo.findByUsuarioIdAndConvocatoriaIdWithConvocatoria(usuario.getId(), convocatoriaId);
        if (lista.isEmpty()) return null;
        Postulacion p = lista.get(0);
        if (actualizarIncumplimientoInformesSiAplica(p)) {
            p = postulacionRepo.save(p);
        }
        return toDetalleMap(p);
    }

    @Transactional
    public Postulacion actualizarMia(Long authUserId, Long postulacionId,
                                     String cedula, String curp, String correo, String telefono,
                                     String tipoApoyo,
                                     String tipoSolicitud, LocalDate fechaEvento,
                                     String tituloProyecto, String descripcionProyecto,
                                     String observaciones, String criteriosJson,
                                     Boolean aceptaAvisoPrivacidad,
                                     MultipartFile cvFile,
                                     Map<String, MultipartFile> documentosAdjuntos) throws IOException {
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulaci\u00f3n no encontrada"));

        if (p.getUsuario() == null || !usuario.getId().equals(p.getUsuario().getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "No puedes editar esta postulaci\u00f3n");
        }
        validarNoEsEvaluadorEnConvocatoria(
                p.getConvocatoria() != null ? p.getConvocatoria().getId() : null,
                authUserId
        );
        Set<String> estadosEditables = resolverEstadosEditablesConvocatoria(p.getConvocatoria());
        if (!esEditableParaUsuario(p.getEstado(), estadosEditables)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes editar postulaciones en estado: " + String.join(", ", estadosEditables));
        }
        validarVigenciaCorrecciones(p);
        LocalDate fechaEventoNormalizada = normalizarFechaEvento(p.getConvocatoria(), fechaEvento);
        validarCandadosYFechas(p.getConvocatoria(), fechaEventoNormalizada);
        listaNegraService.validarNoBloqueado(usuario, correo, curp);

        String tipoApoyoValidado = validarTipoApoyoConvocatoria(p.getConvocatoria(), tipoApoyo);
        String tipoSolicitudNormalizada = normalizarTipoSolicitud(p.getConvocatoria(), tipoSolicitud);
        String tituloProyectoNormalizado = normalizarTituloProyecto(p.getConvocatoria(), tituloProyecto);
        String descripcionProyectoNormalizada = normalizarDescripcionProyecto(p.getConvocatoria(), descripcionProyecto);
        String observacionesNormalizadas = observaciones != null ? observaciones.trim() : null;
        String criteriosJsonNormalizado = criteriosJson != null ? criteriosJson.trim() : null;
        validarReglasConfigurablesConvocatoria(
                p.getConvocatoria(),
                cedula,
                curp,
                correo,
                telefono,
                tipoApoyoValidado,
                tipoSolicitudNormalizada,
                fechaEventoNormalizada,
                tituloProyectoNormalizado,
                descripcionProyectoNormalizada,
                observacionesNormalizadas,
                criteriosJsonNormalizado
        );

        p.setCedula(cedula != null ? cedula.trim() : null);
        p.setCurp(curp != null ? curp.trim().toUpperCase() : null);
        p.setCorreo(correo != null ? correo.trim() : "");
        p.setTelefono(telefono != null ? telefono.trim() : null);
        p.setTipoApoyo(tipoApoyoValidado);
        p.setTipoSolicitud(tipoSolicitudNormalizada);
        p.setFechaEvento(fechaEventoNormalizada);
        p.setTituloProyecto(tituloProyectoNormalizado);
        p.setDescripcionProyecto(descripcionProyectoNormalizada);
        p.setObservaciones(observacionesNormalizadas);
        p.setCriteriosJson(criteriosJsonNormalizado);
        boolean avisoAceptado = validarYResolverAvisoPrivacidad(p.getConvocatoria(), aceptaAvisoPrivacidad, p.isAvisoPrivacidadAceptado());
        p.setAvisoPrivacidadAceptado(avisoAceptado);
        if (avisoAceptado && p.getFechaAceptacionAvisoPrivacidad() == null) {
            p.setFechaAceptacionAvisoPrivacidad(LocalDateTime.now());
        }
        boolean solicitudSubsanada = "CON_OBSERVACIONES".equalsIgnoreCase(p.getEstado());
        if (solicitudSubsanada) {
            p.setEstado("SUBSANADA");
            p.setFechaLimiteCorreccion(null);
        }
        if (p.getFolio() == null || p.getFolio().isBlank()) {
            p.setFolio(generarFolioUnico(p));
        }

        if (cvFile != null && !cvFile.isEmpty()) {
            Documento nuevoCv = guardarCurriculum(usuario.getId(), p.getConvocatoria().getId(), cvFile);
            p.setCurriculumDocumento(nuevoCv);
        }

        if (documentosAdjuntos != null && !documentosAdjuntos.isEmpty()) {
            List<RequisitoDocumento> requisitos = parseRequisitosDocumentos(p.getConvocatoria().getRequisitosDocumentos());
            validarDocumentosRequeridos(requisitos, documentosAdjuntos);
            postulacionDocumentoRepo.findByPostulacionId(p.getId()).forEach(postulacionDocumentoRepo::delete);
            guardarDocumentosAdjuntos(p, usuario.getId(), p.getConvocatoria().getId(), documentosAdjuntos);
        }

        Postulacion guardada = postulacionRepo.save(p);
        if (solicitudSubsanada) {
            try {
                String nombre = obtenerNombreUsuario(guardada);
                String convocatoriaTitulo = guardada.getConvocatoria() != null ? guardada.getConvocatoria().getTitulo() : "la convocatoria";
                notificacionService.crearParaAdmins(
                        "Solicitud subsanada",
                        nombre + " subsanó la solicitud " + (guardada.getFolio() != null ? guardada.getFolio() : "#" + guardada.getId()) + " de \"" + convocatoriaTitulo + "\".",
                        Notificacion.TipoNotificacion.SISTEMA,
                        "/admin/convocatorias/" + (guardada.getConvocatoria() != null ? guardada.getConvocatoria().getId() : "") + "/postulaciones");
            } catch (Exception e) {
                log.warn("No se pudo crear notificación admin de solicitud subsanada: {}", e.getMessage());
            }
        }
        return guardada;
    }

    public List<Postulacion> listarPorConvocatoria(Long convocatoriaId) {
        convocatoriaService.obtenerPorId(convocatoriaId);
        List<Postulacion> lista = postulacionRepo.findByConvocatoriaIdWithUsuario(convocatoriaId);
        boolean actualizados = false;
        for (Postulacion p : lista) {
            if (p.getFolio() == null || p.getFolio().isBlank()) {
                p.setFolio(generarFolioUnico(p));
                actualizados = true;
            }
            if (p.getTipoApoyo() == null || p.getTipoApoyo().isBlank()) {
                p.setTipoApoyo("No especificado");
                actualizados = true;
            }
            if (tipoSolicitudActivo(p.getConvocatoria()) && (p.getTipoSolicitud() == null || p.getTipoSolicitud().isBlank())) {
                p.setTipoSolicitud("NACIONAL");
                actualizados = true;
            }
            if (actualizarIncumplimientoInformesSiAplica(p)) {
                actualizados = true;
            }
        }
        if (actualizados) {
            postulacionRepo.saveAll(lista);
        }
        return lista;
    }

    public int calcularCompatibilidad(Postulacion p) {
        if (p.getUsuario() == null || p.getUsuario().getAuthUser() == null) return 0;
        return compatibilidadService.calcularCompatibilidad(
                p.getUsuario().getAuthUser().getId(),
                p.getConvocatoria().getId());
    }

    @Transactional
    public Postulacion aceptar(Long postulacionId) {
        return aceptar(postulacionId, null, null);
    }

    @Transactional
    public Postulacion aceptar(Long postulacionId, String mensajeCorreo, MultipartFile documentoAceptacionAdjunto) {
        validarDocumentoAceptacion(documentoAceptacionAdjunto);
        String mensajeNormalizado = normalizarTextoOpcional(mensajeCorreo, 4000);
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if ("ACEPTADA".equals(p.getEstado())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La postulacion ya esta aceptada");
        }
        if (moduloComiteActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria tiene comite activo; registra la aprobacion desde el modulo de comite");
        }
        validarSolicitudListaParaSeleccion(p, "aprobar");
        Integer limite = p.getConvocatoria() != null ? p.getConvocatoria().getLimiteAceptados() : null;
        if (limite != null && limite > 0) {
            long yaAceptados = postulacionRepo.countByConvocatoriaIdAndEstado(p.getConvocatoria().getId(), "ACEPTADA");
            if (yaAceptados >= limite) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Se alcanzo el limite de " + limite + " aceptados para esta convocatoria.");
            }
        }
        p.setEstado("ACEPTADA");
        p.setFechaAceptacionPostulacion(LocalDateTime.now());
        p.setFechaLimiteCorreccion(null);
        p.setObservacionesAceptacion(mensajeNormalizado);
        postulacionRepo.save(p);
        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Postulacion aceptada",
                    "Tu postulacion a \"" + p.getConvocatoria().getTitulo() + "\" fue aceptada.",
                    Notificacion.TipoNotificacion.POSTULACION_ACEPTADA,
                    "/app/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de aceptacion: {}", e.getMessage());
        }
        try {
            Convocatoria convocatoria = p.getConvocatoria();
            if (moduloAceptacionActivo(convocatoria)) {
                enviarCorreoAceptacion(p, mensajeNormalizado, documentoAceptacionAdjunto);
                log.info("Postulacion {} aceptada y correo enviado a {}", postulacionId, p.getCorreo());
            } else {
                log.info("Modulo de aceptacion desactivado para la postulacion {}; no se envio correo de aceptacion", postulacionId);
            }
        } catch (Exception e) {
            log.warn("No se pudo enviar correo de aceptacion: {}", e.getMessage());
        }
        return p;
    }
    @Transactional
    public Postulacion rechazar(Long postulacionId) {
        return rechazar(postulacionId, null);
    }

    @Transactional
    public Postulacion rechazar(Long postulacionId, String motivoRechazo) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulaci\u00f3n no encontrada"));
        if ("RECHAZADA".equals(p.getEstado())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La postulaci\u00f3n ya est\u00e1 rechazada");
        }
        p.setEstado("RECHAZADA");
        p.setFechaLimiteCorreccion(null);
        p.setObservacionesRevision(motivoRechazo != null ? motivoRechazo.trim() : null);
        p.setFechaRevision(LocalDateTime.now());
        postulacionRepo.save(p);
        return p;
    }

    @Transactional
    public Postulacion marcarConObservaciones(Long postulacionId, String observacionesRevision) {
        return marcarConObservaciones(postulacionId, observacionesRevision, null);
    }

    @Transactional
    public Postulacion marcarConObservaciones(Long postulacionId, String observacionesRevision, Integer plazoHorasSolicitado) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulaci\u00f3n no encontrada"));
        String obs = observacionesRevision != null ? observacionesRevision.trim() : "";
        if (obs.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes capturar observaciones para solicitar correcciones");
        }
        int plazoHoras = normalizarPlazoHoras(p.getConvocatoria(), plazoHorasSolicitado);
        LocalDateTime limite = LocalDateTime.now().plusHours(plazoHoras);
        p.setEstado("CON_OBSERVACIONES");
        p.setObservacionesRevision(obs);
        p.setFechaRevision(LocalDateTime.now());
        p.setFechaLimiteCorreccion(limite);
        postulacionRepo.save(p);
        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Solicitud con observaciones",
                    "Tu solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " requiere correcciones. Fecha límite: " + formatearFechaHora(limite) + ".",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/postulacion/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : ""));
        } catch (Exception e) {
            log.warn("No se pudo crear notificación de observaciones: {}", e.getMessage());
        }
        try {
            String nombre = obtenerNombreUsuario(p);
            String convocatoria = p.getConvocatoria() != null ? p.getConvocatoria().getTitulo() : null;
            emailService.sendPostulacionConObservaciones(
                    p.getCorreo(),
                    nombre,
                    convocatoria,
                    obs,
                    limite);
        } catch (Exception e) {
            log.warn("No se pudo enviar correo de observaciones: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion marcarRevisada(Long postulacionId) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulaci\u00f3n no encontrada"));
        p.setEstado("REVISADA");
        p.setFechaLimiteCorreccion(null);
        p.setFechaRevision(LocalDateTime.now());
        postulacionRepo.save(p);
        return p;
    }

    @Transactional
    public Postulacion marcarPendiente(Long postulacionId) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulaci\u00f3n no encontrada"));
        p.setEstado("PENDIENTE");
        p.setFechaLimiteCorreccion(null);
        p.setFechaRevision(LocalDateTime.now());
        postulacionRepo.save(p);
        return p;
    }

    @Transactional
    public Postulacion asignarEvaluador(Long postulacionId, String evaluadorEmail) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulación no encontrada"));
        if (!moduloEvaluadoresActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de evaluadores");
        }
        validarSolicitudListaParaSeleccion(p, "asignar evaluador");
        String email = evaluadorEmail != null ? evaluadorEmail.trim().toLowerCase(Locale.ROOT) : "";
        if (email.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes indicar el correo del evaluador");
        }
        AuthUser evaluador = authUserRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "No existe un usuario con ese correo"));
        Long convocatoriaId = p.getConvocatoria() != null ? p.getConvocatoria().getId() : null;
        if (convocatoriaId != null && postulacionRepo.countByConvocatoriaIdAndUsuarioAuthEmailIgnoreCase(convocatoriaId, email) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ese evaluador ya participa como postulante en la misma convocatoria");
        }
        if (evaluador.getRoles() == null) {
            evaluador.setRoles(new HashSet<>());
        }
        if (!evaluador.getRoles().contains("ROLE_EVALUADOR")) {
            evaluador.getRoles().add("ROLE_EVALUADOR");
            authUserRepository.save(evaluador);
        }
        p.setEvaluadorEmail(email);
        p.setFechaAsignacionEvaluador(LocalDateTime.now());
        generarCartaEvaluador(p, evaluador);
        return postulacionRepo.save(p);
    }

    public List<Postulacion> listarAsignadasAEvaluador(Long authUserId) {
        AuthUser evaluador = authUserRepository.findById(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Evaluador no encontrado"));
        String email = evaluador.getEmail() != null ? evaluador.getEmail().trim().toLowerCase(Locale.ROOT) : "";
        if (email.isBlank()) {
            return List.of();
        }
        List<Postulacion> lista = postulacionRepo.findByEvaluadorEmailWithUsuarioAndConvocatoria(email);
        boolean actualizados = false;
        for (Postulacion p : lista) {
            if (actualizarIncumplimientoInformesSiAplica(p)) {
                actualizados = true;
            }
        }
        if (actualizados) {
            postulacionRepo.saveAll(lista);
        }
        return lista;
    }

    @Transactional
    public Postulacion registrarEvaluacion(Long postulacionId, Long authUserId, boolean admin, String resultado, Integer puntaje, String comentarios) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!moduloEvaluadoresActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de evaluadores");
        }
        validarSolicitudListaParaSeleccion(p, "registrar evaluacion");

        AuthUser authUser = authUserRepository.findById(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario evaluador no encontrado"));

        if (!admin) {
            String emailAuth = authUser.getEmail() != null ? authUser.getEmail().trim().toLowerCase(Locale.ROOT) : "";
            String emailAsignado = p.getEvaluadorEmail() != null ? p.getEvaluadorEmail().trim().toLowerCase(Locale.ROOT) : "";
            if (emailAsignado.isBlank() || !emailAsignado.equals(emailAuth)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "No tienes permiso para evaluar esta postulacion");
            }
        }

        String resultadoNormalizado = normalizarResultadoEvaluacion(resultado);
        Integer puntajeMaximo = obtenerPuntajeMaximoEvaluacion(p);
        if (puntaje == null || puntaje < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El puntaje debe ser mayor o igual a 0");
        }
        if (puntajeMaximo != null && puntaje > puntajeMaximo) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El puntaje debe estar entre 0 y " + puntajeMaximo);
        }

        p.setResultadoEvaluacion(resultadoNormalizado);
        p.setPuntajeEvaluacion(puntaje);
        p.setComentariosEvaluacion(comentarios != null && !comentarios.trim().isBlank() ? comentarios.trim() : null);
        p.setFechaEvaluacion(LocalDateTime.now());
        generarDictamenEvaluacion(p, authUser);
        if (admin) {
            // La constancia solo se emite en la validación final del administrador.
            generarConstanciaEvaluador(p, authUser);
        } else {
            // Si el evaluador vuelve a modificar su evaluación, se invalida la constancia previa
            // hasta que el admin la vuelva a validar.
            p.setConstanciaEvaluadorDocumento(null);
        }
        postulacionRepo.save(p);

        if (admin) {
            try {
                notificacionService.crear(
                        p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                        "Solicitud evaluada",
                        "Tu solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " fue evaluada con resultado " + resultadoNormalizado + ".",
                        Notificacion.TipoNotificacion.SISTEMA,
                        "/app/convocatorias");
            } catch (Exception e) {
                log.warn("No se pudo crear notificacion de evaluacion: {}", e.getMessage());
            }
        } else {
            try {
                notificacionService.crearParaAdmins(
                        "Evaluación enviada por evaluador",
                        "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " requiere validación final del admin.",
                        Notificacion.TipoNotificacion.SISTEMA,
                        "/admin/convocatorias");
            } catch (Exception e) {
                log.warn("No se pudo crear notificacion admin de evaluación pendiente: {}", e.getMessage());
            }
        }

        return p;
    }

    @Transactional
    public Map<String, Object> subirDocumentoEvaluacionFirmado(
            Long postulacionId,
            Long authUserId,
            boolean admin,
            String tipoDocumento,
            MultipartFile archivo) throws IOException {
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        AuthUser authUser = authUserRepository.findById(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario evaluador no encontrado"));

        if (!admin) {
            String emailAuth = authUser.getEmail() != null ? authUser.getEmail().trim().toLowerCase(Locale.ROOT) : "";
            String emailAsignado = p.getEvaluadorEmail() != null ? p.getEvaluadorEmail().trim().toLowerCase(Locale.ROOT) : "";
            if (emailAsignado.isBlank() || !emailAsignado.equals(emailAuth)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "No tienes permiso para cargar documentos firmados de esta postulacion");
            }
        }

        if (archivo == null || archivo.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes seleccionar un archivo PDF");
        }
        if (!esPdf(archivo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo se permiten archivos PDF");
        }
        validarLimitePdf(archivo, "evaluacion.documentos", "El archivo firmado");

        String tipo = tipoDocumento != null ? tipoDocumento.trim().toUpperCase(Locale.ROOT) : "";
        String clave;
        String prefijo;
        if ("CARTA".equals(tipo)) {
            if (p.getCartaEvaluadorDocumento() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Primero debe existir la carta de evaluación");
            }
            clave = CLAVE_CARTA_EVALUADOR_FIRMADA;
            prefijo = "carta_evaluador";
        } else if ("DICTAMEN".equals(tipo)) {
            if (p.getDictamenEvaluacionDocumento() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Primero debe existir el dictamen de evaluación");
            }
            clave = CLAVE_DICTAMEN_EVALUACION_FIRMADO;
            prefijo = "dictamen_evaluacion";
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tipo de documento inválido. Usa CARTA o DICTAMEN");
        }

        String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
        Long usuarioIdPropietario = obtenerUsuarioIdPropietarioDocumento(authUser, p);
        Documento doc = documentoService.guardarDocumento(
                usuarioIdPropietario,
                archivo,
                Documento.TipoDocumento.ADJUNTO_POSTULACION,
                prefijo + "_firmado_" + folio + "_" + System.currentTimeMillis() + ".pdf",
                false
        );

        PostulacionDocumento pd = postulacionDocumentoRepo.findByPostulacionIdAndClave(p.getId(), clave)
                .orElseGet(() -> PostulacionDocumento.builder()
                        .postulacion(p)
                        .clave(clave)
                        .build());
        pd.setDocumento(doc);
        postulacionDocumentoRepo.save(pd);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("postulacionId", p.getId());
        response.put("tipo", tipo);
        response.put("clave", clave);
        response.put("documentoId", doc.getId());
        response.put("nombreArchivo", doc.getNombreArchivo());
        return response;
    }

    @Transactional
    public Postulacion registrarDecisionComite(Long postulacionId, String estadoComite, BigDecimal montoApoyoAsignado, String observacionesComite) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!moduloComiteActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de comité");
        }
        validarSolicitudListaParaSeleccion(p, "dictaminar en comite");

        String estado = normalizarEstadoComite(estadoComite);
        BigDecimal montoNormalizado = null;
        if ("APROBADA".equals(estado)) {
            if (montoApoyoAsignado == null || montoApoyoAsignado.compareTo(BigDecimal.ZERO) <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Para aprobar en comite debes asignar un monto mayor a 0");
            }
            montoNormalizado = montoApoyoAsignado.setScale(2, java.math.RoundingMode.HALF_UP);
            p.setEstado("ACEPTADA");
        } else if ("RECHAZADA".equals(estado)) {
            p.setEstado("RECHAZADA");
            montoNormalizado = null;
        } else {
            p.setEstado("REVISADA");
        }

        p.setEstadoComite(estado);
        p.setMontoApoyoAsignado(montoNormalizado);
        p.setObservacionesComite(observacionesComite != null && !observacionesComite.trim().isBlank() ? observacionesComite.trim() : null);
        p.setFechaComite(LocalDateTime.now());
        postulacionRepo.save(p);

        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Resultado de comite",
                    "Tu solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " fue dictaminada por comite: " + estado + ".",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de comite: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion emitirOficioAprobacion(Long postulacionId) {
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes emitir oficio para solicitudes aprobadas");
        }
        String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
        try {
            Documento doc = documentoService.guardarDocumentoGenerado(
                    p.getUsuario().getId(),
                    Documento.TipoDocumento.OFICIO_APROBACION,
                    "oficio_aprobacion_" + folio + ".pdf",
                    "application/pdf",
                    generarPdfOficioAprobacionSiimex(p),
                    true
            );
            p.setOficioAprobacionDocumento(doc);
            p.setFechaOficioAprobacion(LocalDateTime.now());
            p = postulacionRepo.save(p);
            notificarDocumentoEmitido(p, "Oficio de aprobacion emitido", "Tu oficio de aprobacion esta disponible para descarga.");
            enviarCorreoDocumentoEmitido(p, doc, "Oficio de aprobacion");
            return p;
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo generar el oficio de aprobacion");
        }
    }

    @Transactional
    public Postulacion emitirNombramiento(Long postulacionId) {
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes emitir nombramiento para solicitudes aprobadas");
        }
        if (p.getOficioAprobacionDocumento() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Primero debes emitir el oficio de aprobacion");
        }
        String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
        String convocatoria = p.getConvocatoria() != null && p.getConvocatoria().getTitulo() != null
                ? p.getConvocatoria().getTitulo()
                : "Convocatoria SIIMEX";
        String nombre = obtenerNombreUsuarioCompleto(p);
        List<String> lineas = List.of(
                "Nombramiento SIIMEX",
                "Folio de solicitud: " + folio,
                "Persona beneficiaria: " + nombre,
                "Convocatoria: " + convocatoria,
                "Fecha de nombramiento: " + LocalDate.now(),
                "Se emite el nombramiento correspondiente como persona beneficiaria del programa SIIMEX."
        );
        try {
            Documento doc = documentoService.guardarDocumentoGenerado(
                    p.getUsuario().getId(),
                    Documento.TipoDocumento.NOMBRAMIENTO,
                    "nombramiento_" + folio + ".pdf",
                    "application/pdf",
                    SimplePdfGenerator.generarDocumento("SIIMEX - Nombramiento", lineas),
                    true
            );
            p.setNombramientoDocumento(doc);
            p.setFechaNombramiento(LocalDateTime.now());
            p = postulacionRepo.save(p);
            notificarDocumentoEmitido(p, "Nombramiento emitido", "Tu nombramiento SIIMEX esta disponible para descarga.");
            enviarCorreoDocumentoEmitido(p, doc, "Nombramiento SIIMEX");
            return p;
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo generar el nombramiento");
        }
    }

    @Transactional
    public Postulacion actualizarInformacionBancaria(
            Long postulacionId,
            Long authUserId,
            boolean admin,
            String banco,
            String titularCuenta,
            String cuentaBancaria,
            String clabeInterbancaria,
            MultipartFile estadoCuentaArchivo,
            String medioNotificacion) throws IOException {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));

        if (!admin) {
            Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            if (p.getUsuario() == null || !usuario.getId().equals(p.getUsuario().getId())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "No puedes editar la informacion bancaria de esta postulacion");
            }
        }
        if (!moduloBancariaActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo bancario");
        }

        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La informacion bancaria solo puede capturarse para solicitudes aprobadas");
        }

        String bancoNorm = normalizarTextoOpcional(banco, 120);
        String titularNorm = normalizarTextoOpcional(titularCuenta, 180);
        String cuentaNorm = normalizarCuenta(cuentaBancaria);
        String clabeNorm = normalizarClabe(clabeInterbancaria);

        if (bancoNorm == null || titularNorm == null || cuentaNorm == null || clabeNorm == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes capturar banco, titular, numero de cuenta y CLABE");
        }
        validarEstadoCuentaArchivo(estadoCuentaArchivo, p.getEstadoCuentaDocumento() == null);

        if (estadoCuentaArchivo != null && !estadoCuentaArchivo.isEmpty()) {
            String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
            Documento doc = documentoService.guardarDocumento(
                    p.getUsuario().getId(),
                    estadoCuentaArchivo,
                    Documento.TipoDocumento.ESTADO_CUENTA,
                    "estado_cuenta_" + folio + "_" + System.currentTimeMillis() + extensionArchivo(estadoCuentaArchivo.getOriginalFilename()),
                    false
            );
            p.setEstadoCuentaDocumento(doc);
        }

        p.setBanco(bancoNorm);
        p.setTitularCuenta(titularNorm);
        p.setCuentaBancaria(cuentaNorm);
        p.setClabeInterbancaria(clabeNorm);
        p.setMedioNotificacion(null);
        p.setFechaActualizacionBancaria(LocalDateTime.now());
        postulacionRepo.save(p);

        return p;
    }
    @Transactional
    public Postulacion registrarEntregaApoyo(Long postulacionId, String observacionesEntregaApoyo) {
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!moduloBancariaActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo bancario");
        }
        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes registrar entrega para solicitudes aprobadas");
        }
        if (p.getNombramientoDocumento() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Primero debes emitir el nombramiento");
        }
        if (p.getMontoApoyoAsignado() == null || p.getMontoApoyoAsignado().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La solicitud debe tener monto de apoyo asignado");
        }
        p.setEstadoEntregaApoyo("APOYO_ENTREGADO");
        p.setFechaEntregaApoyo(LocalDateTime.now());
        p.setObservacionesEntregaApoyo(normalizarTextoOpcional(observacionesEntregaApoyo, 3000));
        if (p.getEstadoReciboPago() == null || p.getEstadoReciboPago().isBlank()) {
            p.setEstadoReciboPago("PENDIENTE_RECIBO");
        }
        p = postulacionRepo.save(p);
        return p;
    }

    @Transactional
    public Postulacion subirReciboPago(Long postulacionId, Long authUserId, MultipartFile archivo) throws IOException {
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (p.getUsuario() == null || !usuario.getId().equals(p.getUsuario().getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "No puedes cargar recibo para esta postulacion");
        }
        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El recibo solo puede cargarse para solicitudes aprobadas");
        }
        if (p.getNombramientoDocumento() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El recibo se habilita cuando el nombramiento haya sido emitido");
        }
        if (!"APOYO_ENTREGADO".equalsIgnoreCase(p.getEstadoEntregaApoyo())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El recibo se habilita cuando COMECYT registre la entrega del apoyo economico");
        }
        if (p.getReciboPagoDocumento() != null && !"RECIBO_RECHAZADO".equalsIgnoreCase(p.getEstadoReciboPago())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El recibo ya fue cargado y queda bloqueado hasta su revisión. Solo puede reemplazarse si COMECYT lo rechaza.");
        }
        validarReciboArchivo(archivo);
        Documento doc = documentoService.guardarDocumento(
                usuario.getId(),
                archivo,
                Documento.TipoDocumento.RECIBO_PAGO,
                "recibo_pago_" + (p.getFolio() != null ? p.getFolio() : p.getId()) + "_" + System.currentTimeMillis() + ".pdf",
                true
        );
        p.setReciboPagoDocumento(doc);
        p.setEstadoReciboPago("RECIBO_CARGADO");
        p.setFechaReciboPago(LocalDateTime.now());
        p.setFechaValidacionReciboPago(null);
        p.setObservacionesReciboPago(null);
        p = postulacionRepo.save(p);
        try {
            notificacionService.crearParaAdmins(
                    "Recibo de pago cargado",
                    "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " cargo recibo de pago.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : "") + "/bancaria");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion admin de recibo: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion validarReciboPago(Long postulacionId, String estadoReciboPago, String observacionesReciboPago) {
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (p.getReciboPagoDocumento() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La solicitud no tiene recibo de pago cargado");
        }
        String estado = normalizarEstadoReciboPago(estadoReciboPago);
        p.setEstadoReciboPago(estado);
        p.setFechaValidacionReciboPago(LocalDateTime.now());
        p.setObservacionesReciboPago(normalizarTextoOpcional(observacionesReciboPago, 3000));
        p = postulacionRepo.save(p);
        if (p.getObservacionesReciboPago() != null && !p.getObservacionesReciboPago().isBlank()) {
            try {
                notificacionService.crear(
                        p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                        "Observaciones de recibo de pago",
                        "Tu recibo de pago tiene observaciones: " + p.getObservacionesReciboPago(),
                        Notificacion.TipoNotificacion.SISTEMA,
                        "/app/postulacion/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : ""));
            } catch (Exception e) {
                log.warn("No se pudo crear notificacion de observaciones de recibo: {}", e.getMessage());
            }
        }
        return p;
    }

    @Transactional
    public Postulacion registrarCotejo(Long postulacionId, String estadoCotejo, String observacionesCotejo) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!moduloCotejoActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de cotejo");
        }
        String estado = normalizarEstadoCotejo(estadoCotejo);
        p.setEstadoCotejo(estado);
        p.setObservacionesCotejo(observacionesCotejo != null && !observacionesCotejo.trim().isBlank() ? observacionesCotejo.trim() : null);
        p.setFechaCotejo(LocalDateTime.now());
        postulacionRepo.save(p);

        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Resultado de cotejo",
                    "Tu solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " fue cotejada con estado " + estado + ".",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de cotejo: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion configurarInformes(Long postulacionId, LocalDate fechaLimiteParcial, LocalDate fechaLimiteFinal, String observacionesInforme) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!moduloInformesActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de informes");
        }
        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes configurar informes para solicitudes aprobadas");
        }
        TipoInformesRequeridos tipoInformesRequeridos = resolverTipoInformesRequeridos(p.getConvocatoria());
        boolean requiereParcial = tipoInformesRequeridos == TipoInformesRequeridos.PARCIAL || tipoInformesRequeridos == TipoInformesRequeridos.AMBOS;
        boolean requiereFinal = tipoInformesRequeridos == TipoInformesRequeridos.FINAL || tipoInformesRequeridos == TipoInformesRequeridos.AMBOS;

        if (!requiereParcial && !requiereFinal) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La convocatoria no requiere informes");
        }
        if (requiereParcial && fechaLimiteParcial == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes configurar la fecha limite del informe parcial");
        }
        if (requiereFinal && fechaLimiteFinal == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes configurar la fecha limite del informe final");
        }
        if (requiereParcial && requiereFinal && fechaLimiteFinal.isBefore(fechaLimiteParcial)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha limite del informe final no puede ser menor a la del parcial");
        }
        p.setFechaLimiteInformeParcial(requiereParcial ? fechaLimiteParcial : null);
        p.setFechaLimiteInformeFinal(requiereFinal ? fechaLimiteFinal : null);
        p.setObservacionesInforme(observacionesInforme != null && !observacionesInforme.trim().isBlank() ? observacionesInforme.trim() : null);
        actualizarEstadoInformeSegunRequisitos(p, false);
        postulacionRepo.save(p);

        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Configuración de informes",
                    "Se configuraron fechas límite para tus informes de seguimiento.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/postulacion/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : ""));
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de configuración de informes: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion subirInformeParcial(Long postulacionId, Long authUserId, MultipartFile archivo) throws IOException {
        Postulacion p = obtenerPostulacionDeUsuario(postulacionId, authUserId);
        if (!moduloInformesActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de informes");
        }
        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La carga de informes solo está disponible para solicitudes aprobadas");
        }
        if (!requiereInformeParcial(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no requiere informe parcial");
        }
        validarVentanaInformeParcial(p);
        if (!esPdf(archivo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El informe parcial debe ser un PDF");
        }
        validarLimitePdf(archivo, "postulacion.informes", "El informe parcial");
        Documento doc = documentoService.guardarDocumento(
                p.getUsuario().getId(),
                archivo,
                Documento.TipoDocumento.INFORME_PARCIAL,
                "informe_parcial_postulacion_" + p.getId() + "_" + System.currentTimeMillis() + ".pdf",
                false
        );
        p.setInformeParcialDocumento(doc);
        p.setFechaInformeParcial(LocalDateTime.now());
        actualizarEstadoInformeSegunRequisitos(p, false);
        p.setMotivoIncumplimientoInforme(null);
        postulacionRepo.save(p);

        try {
            notificacionService.crearParaAdmins(
                    "Informe parcial recibido",
                    "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " cargó informe parcial.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion admin de informe parcial: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion subirInformeFinal(Long postulacionId, Long authUserId, MultipartFile archivo) throws IOException {
        Postulacion p = obtenerPostulacionDeUsuario(postulacionId, authUserId);
        if (!moduloInformesActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de informes");
        }
        if (!puedeCapturarBancaria(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La carga de informes solo está disponible para solicitudes aprobadas");
        }
        if (!requiereInformeFinal(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no requiere informe final");
        }
        validarVentanaInformeFinal(p);
        if (!esPdf(archivo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El informe final debe ser un PDF");
        }
        validarLimitePdf(archivo, "postulacion.informes", "El informe final");
        Documento doc = documentoService.guardarDocumento(
                p.getUsuario().getId(),
                archivo,
                Documento.TipoDocumento.INFORME_FINAL,
                "informe_final_postulacion_" + p.getId() + "_" + System.currentTimeMillis() + ".pdf",
                false
        );
        p.setInformeFinalDocumento(doc);
        p.setFechaInformeFinal(LocalDateTime.now());
        actualizarEstadoInformeSegunRequisitos(p, false);
        p.setMotivoIncumplimientoInforme(null);
        postulacionRepo.save(p);

        try {
            notificacionService.crearParaAdmins(
                    "Informe final recibido",
                    "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " cargó informe final.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion admin de informe final: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion solicitarRenuncia(Long postulacionId, Long authUserId, String motivoRenuncia, MultipartFile oficioBaja) throws IOException {
        Postulacion p = obtenerPostulacionDeUsuario(postulacionId, authUserId);
        if (!moduloRenunciaActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de renuncia");
        }
        if (!puedeSolicitarRenuncia(p)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes solicitar renuncia para solicitudes aprobadas");
        }
        String estadoActual = p.getEstadoRenuncia() != null ? p.getEstadoRenuncia().trim().toUpperCase(Locale.ROOT) : "";
        if ("SOLICITADA".equals(estadoActual)) {
            throw new ApiException(HttpStatus.CONFLICT, "Ya existe una solicitud de renuncia pendiente de resolver");
        }
        if ("ACEPTADA".equals(estadoActual)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La renuncia ya fue aceptada");
        }
        String motivo = normalizarTextoRequerido(motivoRenuncia, "Debes capturar el motivo de renuncia", 3000);
        if (oficioBaja == null || oficioBaja.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes adjuntar el oficio formal de baja en PDF");
        }
        if (!esPdf(oficioBaja)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El oficio formal de baja debe ser un PDF");
        }
        validarLimitePdf(oficioBaja, "postulacion.documentos", "El oficio formal de baja");
        Documento oficioAnterior = p.getRenunciaDocumento();
        Documento oficio = documentoService.guardarDocumento(
                p.getUsuario().getId(),
                oficioBaja,
                Documento.TipoDocumento.RENUNCIA_APOYO,
                "oficio_baja_postulacion_" + p.getId() + "_" + System.currentTimeMillis() + ".pdf",
                false
        );
        p.setEstadoRenuncia("SOLICITADA");
        p.setMotivoRenuncia(motivo);
        p.setFechaSolicitudRenuncia(LocalDateTime.now());
        p.setFechaResolucionRenuncia(null);
        p.setObservacionesRenuncia(null);
        p.setRenunciaDocumento(oficio);
        p = postulacionRepo.save(p);
        if (oficioAnterior != null && oficioAnterior.getId() != null) {
            eliminarDocumentoPostulacion(oficioAnterior.getId(), p.getUsuario().getId());
        }
        try {
            notificacionService.crearParaAdmins(
                    "Solicitud de renuncia",
                    "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " registró renuncia de apoyo.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : "") + "/renuncias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion admin de renuncia: {}", e.getMessage());
        }
        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Renuncia enviada",
                    "Tu solicitud de renuncia para " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " fue enviada a revisión.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/postulacion/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : ""));
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion usuario de renuncia: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion resolverRenuncia(Long postulacionId, String estadoRenuncia, String observacionesRenuncia) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!moduloRenunciaActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de renuncia");
        }
        String estado = normalizarEstadoRenuncia(estadoRenuncia);
        if (!"SOLICITADA".equalsIgnoreCase(p.getEstadoRenuncia())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La solicitud no tiene una renuncia pendiente");
        }
        p.setEstadoRenuncia(estado);
        p.setFechaResolucionRenuncia(LocalDateTime.now());
        p.setObservacionesRenuncia(normalizarTextoOpcional(observacionesRenuncia, 3000));
        if ("ACEPTADA".equals(estado)) {
            p.setEstado("CANCELADA");
        }
        p = postulacionRepo.save(p);
        try {
            String txt = "Se resolvió tu solicitud de renuncia para " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + ": " + estado + ".";
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Resolución de renuncia",
                    txt,
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/postulacion/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : ""));
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de resolucion de renuncia: {}", e.getMessage());
        }
        return p;
    }

    @Transactional
    public Postulacion reenviarCorreoAceptacion(Long convocatoriaId, Long postulacionId) {
        return reenviarCorreoAceptacion(convocatoriaId, postulacionId, null, null);
    }

    @Transactional
    public Postulacion reenviarCorreoAceptacion(Long convocatoriaId, Long postulacionId, String mensajeCorreo, MultipartFile documentoAceptacionAdjunto) {
        validarDocumentoAceptacion(documentoAceptacionAdjunto);
        String mensajeNormalizado = normalizarTextoOpcional(mensajeCorreo, 4000);
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        validarPostulacionPerteneceConvocatoria(p, convocatoriaId);
        if (!moduloAceptacionActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el modulo de aceptacion");
        }
        if (!"ACEPTADA".equalsIgnoreCase(p.getEstado())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes enviar aceptacion a solicitudes aceptadas");
        }
        enviarCorreoAceptacion(p, mensajeNormalizado, documentoAceptacionAdjunto);
        p.setFechaAceptacionPostulacion(LocalDateTime.now());
        p.setObservacionesAceptacion(mensajeNormalizado != null ? mensajeNormalizado : "Correo de aceptacion reenviado por el administrador");
        return postulacionRepo.save(p);
    }
    @Transactional
    public Postulacion subirSeguroMedico(Long postulacionId, Long authUserId, String numeroSeguroMedico, MultipartFile archivo) throws IOException {
        Postulacion p = obtenerPostulacionDeUsuario(postulacionId, authUserId);
        if (!moduloSeguroMedicoActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de seguro médico");
        }
        validarSolicitudAceptadaParaModulo(p, "subir seguro médico");
        String numero = normalizarTextoOpcional(numeroSeguroMedico, 100);
        if (numero == null || numero.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Captura el número de seguro médico");
        }
        if (!esPdf(archivo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La evidencia de seguro médico debe ser un PDF");
        }
        validarLimitePdf(archivo, "postulacion.documentos", "La evidencia de seguro médico");
        Documento doc = documentoService.guardarDocumento(
                p.getUsuario().getId(),
                archivo,
                Documento.TipoDocumento.SEGURO_MEDICO,
                "seguro_medico_postulacion_" + p.getId() + "_" + System.currentTimeMillis() + ".pdf",
                false
        );
        p.setNumeroSeguroMedico(numero);
        p.setSeguroMedicoDocumento(doc);
        p.setEstadoSeguroMedico("SOLICITADO");
        p.setFechaSeguroMedico(LocalDateTime.now());
        postulacionRepo.save(p);

        try {
            notificacionService.crearParaAdmins(
                    "Seguro médico recibido",
                    "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " cargó evidencia de seguro médico.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion admin de seguro medico: {}", e.getMessage());
        }
        return p;
    }


    private void validarSolicitudAceptadaParaModulo(Postulacion p, String accion) {
        String estado = p != null && p.getEstado() != null ? p.getEstado().trim().toUpperCase(Locale.ROOT) : "";
        String estadoComite = p != null && p.getEstadoComite() != null ? p.getEstadoComite().trim().toUpperCase(Locale.ROOT) : "";
        if (!"ACEPTADA".equals(estado) && !"APROBADA".equals(estadoComite)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes " + accion + " cuando tu solicitud esté aceptada");
        }
    }
    @Transactional
    public Postulacion actualizarSeguroMedico(Long convocatoriaId, Long postulacionId, String estadoSeguroMedico, String observacionesSeguroMedico) {
        try {
            return actualizarSeguroMedico(convocatoriaId, postulacionId, estadoSeguroMedico, observacionesSeguroMedico, null, null);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar la evidencia del seguro médico");
        }
    }

    @Transactional
    public Postulacion actualizarSeguroMedico(Long convocatoriaId,
                                             Long postulacionId,
                                             String estadoSeguroMedico,
                                             String observacionesSeguroMedico,
                                             String numeroSeguroMedico,
                                             MultipartFile evidenciaSeguroMedico) throws IOException {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        validarPostulacionPerteneceConvocatoria(p, convocatoriaId);
        if (!moduloSeguroMedicoActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de seguro médico");
        }
        String estado = normalizarEstadoSeguroMedico(estadoSeguroMedico);
        p.setEstadoSeguroMedico(estado);
        p.setNumeroSeguroMedico(normalizarTextoOpcional(numeroSeguroMedico, 100));
        p.setObservacionesSeguroMedico(normalizarTextoOpcional(observacionesSeguroMedico, 3000));
        if (evidenciaSeguroMedico != null && !evidenciaSeguroMedico.isEmpty()) {
            Documento doc = documentoService.guardarDocumento(
                    p.getUsuario().getId(),
                    evidenciaSeguroMedico,
                    Documento.TipoDocumento.SEGURO_MEDICO,
                    evidenciaSeguroMedico.getOriginalFilename(),
                    false);
            p.setSeguroMedicoDocumento(doc);
        }
        p.setFechaSeguroMedico(LocalDateTime.now());
        notificarSeguimientoModulo(p, "Seguro médico actualizado", "El seguimiento de seguro médico de tu solicitud fue actualizado: " + estado + ".");
        return postulacionRepo.save(p);
    }

    @Transactional
    public Postulacion subirStatusAcademico(Long postulacionId, Long authUserId, String informacionStatusAcademico, MultipartFile archivo) throws IOException {
        Postulacion p = obtenerPostulacionDeUsuario(postulacionId, authUserId);
        if (!moduloStatusAcademicoActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de estatus académico");
        }
        validarSolicitudAceptadaParaModulo(p, "actualizar estatus académico");
        String informacion = normalizarTextoOpcional(informacionStatusAcademico, 4000);
        if (informacion == null || informacion.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Captura la informacion de actualización del estatus académico");
        }
        p.setInformacionStatusAcademico(informacion);
        if (archivo != null && !archivo.isEmpty()) {
            if (!esPdf(archivo)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "La evidencia de estatus académico debe ser PDF");
            }
            validarLimitePdf(archivo, "postulacion.documentos", "La evidencia de estatus académico");
            Documento doc = documentoService.guardarDocumento(
                    p.getUsuario().getId(),
                    archivo,
                    Documento.TipoDocumento.STATUS_ACADEMICO,
                    "estatus_academico_postulacion_" + p.getId() + "_" + System.currentTimeMillis() + ".pdf",
                    false
            );
            p.setStatusAcademicoDocumento(doc);
        }
        p.setEstadoStatusAcademico("ACTUALIZADO");
        p.setFechaStatusAcademico(LocalDateTime.now());
        p = postulacionRepo.save(p);
        try {
            notificacionService.crearParaAdmins(
                    "Estatus académico actualizado",
                    "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " actualizó información de estatus académico.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion admin de estatus academico: {}", e.getMessage());
        }
        return p;
    }
    @Transactional
    public Postulacion actualizarStatusAcademico(Long convocatoriaId, Long postulacionId, String estadoStatusAcademico, String observacionesStatusAcademico) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        validarPostulacionPerteneceConvocatoria(p, convocatoriaId);
        if (!moduloStatusAcademicoActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de actualización de estatus académico");
        }
        String estado = normalizarEstadoStatusAcademico(estadoStatusAcademico);
        p.setEstadoStatusAcademico(estado);
        p.setObservacionesStatusAcademico(normalizarTextoOpcional(observacionesStatusAcademico, 3000));
        p.setFechaStatusAcademico(LocalDateTime.now());
        notificarSeguimientoModulo(p, "Estatus académico actualizado", "El estatus académico de tu solicitud fue actualizado: " + estado + ".");
        return postulacionRepo.save(p);
    }

    @Transactional
    public Postulacion actualizarConstanciaFinal(Long convocatoriaId, Long postulacionId, String estadoConstanciaFinal, String observacionesConstanciaFinal) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        validarPostulacionPerteneceConvocatoria(p, convocatoriaId);
        if (!moduloConstanciasActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de constancias y cierre final");
        }
        String estado = normalizarEstadoConstanciaFinal(estadoConstanciaFinal);
        p.setEstadoConstanciaFinal(estado);
        p.setObservacionesConstanciaFinal(normalizarTextoOpcional(observacionesConstanciaFinal, 3000));
        return postulacionRepo.save(p);
    }

    @Transactional
    public Postulacion generarDocumentoFinal(Long convocatoriaId, Long postulacionId, String tipo, String observacionesConstanciaFinal) {
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        validarPostulacionPerteneceConvocatoria(p, convocatoriaId);
        if (!moduloConstanciasActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de constancias y cierre final");
        }
        if (!"ACEPTADA".equalsIgnoreCase(p.getEstado())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo puedes emitir documentos finales para solicitudes aceptadas");
        }
        String tipoNormalizado = tipo != null ? tipo.trim().toUpperCase(Locale.ROOT) : "CONSTANCIA";
        boolean cartaCierre = "CARTA_CIERRE".equals(tipoNormalizado) || "CARTA".equals(tipoNormalizado);
        String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
        try {
            Documento.TipoDocumento tipoDocumento = cartaCierre ? Documento.TipoDocumento.CARTA_CIERRE : Documento.TipoDocumento.CONSTANCIA_FINAL;
            Optional<ConvocatoriaFormato> formatoOficial = !cartaCierre && p.getConvocatoria() != null && p.getConvocatoria().getId() != null
                    ? convocatoriaFormatoService.obtenerFormatoConstanciaFinal(p.getConvocatoria().getId())
                    : Optional.empty();
            Documento doc;
            if (!cartaCierre && formatoOficial.isPresent()) {
                ConvocatoriaFormato formato = formatoOficial.get();
                String nombreArchivo = (cartaCierre ? "carta_cierre_" : "constancia_final_") + folio + extensionArchivo(formato.getNombreArchivo());
                doc = documentoService.guardarDocumentoEmitidoDesdeFormato(
                        p.getUsuario().getId(),
                        tipoDocumento,
                        nombreArchivo,
                        formato.getContentType(),
                        formato.getContenido(),
                        true
                );
            } else {
                String nombreArchivo = (cartaCierre ? "carta_cierre_" : "constancia_final_") + folio + ".pdf";
                doc = documentoService.guardarDocumentoGenerado(
                        p.getUsuario().getId(),
                        tipoDocumento,
                        nombreArchivo,
                        "application/pdf",
                        generarPdfDocumentoFinalSiimex(p, cartaCierre),
                        true
                );
            }
            if (cartaCierre) {
                p.setCartaCierreDocumento(doc);
                p.setFechaCartaCierre(LocalDateTime.now());
                p.setEstadoConstanciaFinal("CARTA_EMITIDA");
            } else {
                p.setConstanciaFinalDocumento(doc);
                p.setFechaConstanciaFinal(LocalDateTime.now());
                p.setEstadoConstanciaFinal("CONSTANCIA_EMITIDA");
            }
            p.setObservacionesConstanciaFinal(normalizarTextoOpcional(observacionesConstanciaFinal, 3000));
            Postulacion guardada = postulacionRepo.save(p);
            String etiquetaDocumento = cartaCierre ? "Carta de cierre" : "Constancia final";
            notificarDocumentoEmitido(
                    guardada,
                    etiquetaDocumento + " emitida",
                    "Tu " + etiquetaDocumento.toLowerCase(Locale.ROOT) + " SIIMEX esta disponible para descarga.");
            enviarCorreoDocumentoEmitido(guardada, doc, etiquetaDocumento + " SIIMEX");
            return guardada;
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo generar el documento final");
        }
    }

    private byte[] generarPdfOficioAprobacionSiimex(Postulacion p) {
        String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
        String convocatoria = obtenerTituloConvocatoria(p);
        String nombre = obtenerNombreUsuarioCompleto(p);
        String programa = resolverProgramaConvocatoria(p);
        String periodo = resolverPeriodoApoyo(p);
        String monto = formatearMonto(p.getMontoApoyoAsignado());
        boolean proyectoActivo = informacionProyectoActiva(p.getConvocatoria());
        String tituloProyecto = proyectoActivo ? valorOpcional(p.getTituloProyecto()) : null;

        List<SimplePdfGenerator.Campo> campos = new ArrayList<>();
        campos.add(new SimplePdfGenerator.Campo("Fecha", "Toluca, Estado de México, " + formatearFechaLarga(LocalDate.now())));
        campos.add(new SimplePdfGenerator.Campo("Persona beneficiaria", nombre));
        campos.add(new SimplePdfGenerator.Campo("Folio", folio));
        campos.add(new SimplePdfGenerator.Campo("Convocatoria", convocatoria));
        campos.add(new SimplePdfGenerator.Campo("Tipo de apoyo", valorDocumento(p.getTipoApoyo())));
        campos.add(new SimplePdfGenerator.Campo("Monto autorizado", monto));
        if (tituloProyecto != null) {
            campos.add(new SimplePdfGenerator.Campo("Título del proyecto", tituloProyecto));
        }

        List<String> parrafos = new ArrayList<>();
        parrafos.add("Con fundamento en las Reglas de Operación del programa " + programa + ", el Consejo Mexiquense de Ciencia y Tecnología (COMECyT) comunica que la solicitud registrada en SIIMEX ha sido APROBADA por el proceso de selección correspondiente.");
        if (tituloProyecto != null) {
            parrafos.add("El beneficio consiste en un apoyo económico de " + monto + " para desarrollar el proyecto denominado \"" + tituloProyecto + "\", durante el periodo " + periodo + ".");
        } else {
            parrafos.add("El beneficio consiste en un apoyo económico de " + monto + " correspondiente a la solicitud aprobada, durante el periodo " + periodo + ".");
        }
        parrafos.add("El apoyo se otorgará mediante transferencia bancaria, conforme a la disponibilidad presupuestal autorizada y al calendario operativo establecido por el COMECyT.");
        parrafos.add("Por lo anterior, se solicita que en un lapso no mayor a 5 días hábiles ingrese al sistema SIIMEX y actualice los apartados de Cuenta bancaria y Seguro médico. La cuenta bancaria deberá estar a nombre de la persona beneficiaria y el documento de seguro médico deberá contener nombre completo y vigencia.");
        parrafos.add("A partir de este momento obtiene la calidad de persona beneficiaria, por lo que deberá conocer y cumplir los derechos, obligaciones, causas de incumplimiento, sanciones y corresponsabilidades establecidas en la convocatoria y sus reglas aplicables.");

        SimplePdfGenerator.Tabla tabla = new SimplePdfGenerator.Tabla(
                List.of("Concepto", "Registro en sistema"),
                construirCalendarioPagos(p)
        );
        return SimplePdfGenerator.generarMachoteSiimex(
                "OFICIO DE APROBACIÓN",
                programa,
                campos,
                parrafos,
                tabla,
                "A T E N T A M E N T E\nCONSEJO MEXIQUENSE DE CIENCIA Y TECNOLOGÍA"
        );
    }

    private byte[] generarPdfDocumentoFinalSiimex(Postulacion p, boolean cartaCierre) {
        if (!cartaCierre) {
            String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
            List<String> lineas = List.of(
                    "Constancia final SIIMEX",
                    "Folio de solicitud: " + folio,
                    "Persona beneficiaria: " + obtenerNombreUsuarioCompleto(p),
                    "Convocatoria: " + obtenerTituloConvocatoria(p),
                    "Fecha de emisión: " + formatearFechaLarga(LocalDate.now()),
                    "Se emite la presente constancia final por su participación en el proceso SIIMEX."
            );
            return SimplePdfGenerator.generarDocumento("SIIMEX - Constancia final", lineas);
        }

        String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
        String programa = resolverProgramaConvocatoria(p);
        boolean proyectoActivo = informacionProyectoActiva(p.getConvocatoria());
        String tituloProyecto = proyectoActivo ? valorOpcional(p.getTituloProyecto()) : null;
        String asesor = valorOpcional(resolverAsesorResponsable(p));

        List<SimplePdfGenerator.Campo> campos = new ArrayList<>();
        campos.add(new SimplePdfGenerator.Campo("Persona beneficiaria", obtenerNombreUsuarioCompleto(p)));
        campos.add(new SimplePdfGenerator.Campo("Folio", folio));
        String institucion = valorOpcional(resolverInstitucionReceptora(p));
        if (institucion != null) {
            campos.add(new SimplePdfGenerator.Campo("Institución receptora", institucion));
        }
        if (tituloProyecto != null) {
            campos.add(new SimplePdfGenerator.Campo("Título del proyecto", tituloProyecto));
        }
        if (asesor != null) {
            campos.add(new SimplePdfGenerator.Campo("Asesor(a) responsable", asesor));
        }
        campos.add(new SimplePdfGenerator.Campo("Periodo de apoyo", resolverPeriodoApoyo(p)));
        campos.add(new SimplePdfGenerator.Campo("Apoyo económico entregado", formatearMonto(p.getMontoApoyoAsignado())));
        campos.add(new SimplePdfGenerator.Campo("Convocatoria", obtenerTituloConvocatoria(p)));

        List<String> parrafos = new ArrayList<>();
        parrafos.add("Con base en las Reglas de Operación aplicables al programa " + programa + ", la persona beneficiaria debe registrar en el sistema electrónico el informe final de resultados, sus evidencias y los productos comprometidos durante el periodo de apoyo recibido.");
        parrafos.add("El Consejo Mexiquense de Ciencia y Tecnología, a través de la Dirección de Investigación Científica y Formación de Recursos Humanos, hace constar que la documentación final fue entregada y cotejada dentro del proceso correspondiente.");
        if (tituloProyecto != null) {
            parrafos.add("Derivado de lo anterior, se da por concluido el proyecto \"" + tituloProyecto + "\" registrado en SIIMEX, quedando cerrada la solicitud identificada con el folio " + folio + ".");
        } else {
            parrafos.add("Derivado de lo anterior, se da por concluida la solicitud identificada con el folio " + folio + " dentro del proceso registrado en SIIMEX.");
        }
        parrafos.add("Se hace explícito que, respecto de esta solicitud, la persona beneficiaria no mantiene sanciones ni adeudos administrativos con el Consejo Mexiquense de Ciencia y Tecnología.");
        parrafos.add("Se expide la presente carta de cierre en Toluca, Estado de México, a " + formatearFechaLarga(LocalDate.now()) + ".");

        return SimplePdfGenerator.generarMachoteSiimex(
                "CARTA DE CIERRE",
                programa,
                campos,
                parrafos,
                null,
                "ATENTAMENTE\nDIRECCIÓN DE INVESTIGACIÓN CIENTÍFICA Y FORMACIÓN DE RECURSOS HUMANOS"
        );
    }

    private String obtenerTituloConvocatoria(Postulacion p) {
        return p.getConvocatoria() != null && p.getConvocatoria().getTitulo() != null && !p.getConvocatoria().getTitulo().isBlank()
                ? p.getConvocatoria().getTitulo().trim()
                : "Convocatoria SIIMEX";
    }

    private String resolverProgramaConvocatoria(Postulacion p) {
        String titulo = obtenerTituloConvocatoria(p);
        int year = p.getConvocatoria() != null && p.getConvocatoria().getFechaCierre() != null
                ? p.getConvocatoria().getFechaCierre().getYear()
                : LocalDate.now().getYear();
        return titulo + " - Promoción " + year;
    }

    private String resolverInstitucionReceptora(Postulacion p) {
        if (p == null || p.getUsuario() == null || p.getUsuario().getId() == null) {
            return null;
        }
        Long usuarioId = p.getUsuario().getId();
        try {
            Optional<String> institucionPerfil = institucionRepository.findByUsuarioId(usuarioId).stream()
                    .map(Institucion::getNombre)
                    .filter(v -> v != null && !v.trim().isBlank())
                    .map(String::trim)
                    .findFirst();
            if (institucionPerfil.isPresent()) return institucionPerfil.get();
        } catch (Exception e) {
            log.warn("No se pudo leer institución del perfil para usuario {}: {}", usuarioId, e.getMessage());
        }
        if (p.getUsuario().getPerfilMigracion() != null) {
            String institucion = p.getUsuario().getPerfilMigracion().getInstitucionReceptora();
            if (institucion != null && !institucion.isBlank()) return institucion.trim();
        }
        try {
            return estanciaRepository.findByUsuarioId(usuarioId).stream()
                    .map(Estancia::getInstitucionReceptora)
                    .filter(v -> v != null && !v.trim().isBlank())
                    .map(String::trim)
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("No se pudo leer estancia del perfil para usuario {}: {}", usuarioId, e.getMessage());
            return null;
        }
    }

    private String resolverAsesorResponsable(Postulacion p) {
        Map<String, Object> criterios = parseCriteriosRespuestas(p != null ? p.getCriteriosJson() : null);
        return valorCriterio(criterios,
                "asesor",
                "asesor_responsable",
                "nombre_asesor",
                "tutor",
                "tutor_responsable",
                "director_proyecto");
    }

    private String valorCriterio(Map<String, Object> criterios, String... claves) {
        if (criterios == null || criterios.isEmpty() || claves == null) return null;
        Set<String> buscadas = new LinkedHashSet<>();
        for (String clave : claves) {
            String normalizada = normalizarClaveRegla(clave);
            if (!normalizada.isBlank()) buscadas.add(normalizada);
        }
        for (Map.Entry<String, Object> entry : criterios.entrySet()) {
            String key = normalizarClaveRegla(entry.getKey());
            if (!buscadas.contains(key)) continue;
            Object raw = entry.getValue();
            String value = raw != null ? String.valueOf(raw).trim() : "";
            if (!value.isBlank()) return value;
        }
        return null;
    }

    private String resolverPeriodoApoyo(Postulacion p) {
        if (p.getConvocatoria() != null && p.getConvocatoria().getFechaApertura() != null && p.getConvocatoria().getFechaCierre() != null) {
            return "del " + formatearFechaLarga(p.getConvocatoria().getFechaApertura().toLocalDate())
                    + " al " + formatearFechaLarga(p.getConvocatoria().getFechaCierre().toLocalDate());
        }
        if (p.getFechaEvento() != null) {
            return "a partir del " + formatearFechaLarga(p.getFechaEvento());
        }
        return "No especificado";
    }

    private List<List<String>> construirCalendarioPagos(Postulacion p) {
        List<List<String>> filas = new ArrayList<>();
        filas.add(List.of("Monto autorizado", formatearMonto(p != null ? p.getMontoApoyoAsignado() : null)));
        filas.add(List.of("Estatus de entrega", formatearEstadoSistema(
                p != null ? p.getEstadoEntregaApoyo() : null,
                "Pendiente de entrega")));
        if (p != null && p.getFechaEntregaApoyo() != null) {
            filas.add(List.of("Fecha de entrega", formatearFechaHoraDocumento(p.getFechaEntregaApoyo())));
        }
        filas.add(List.of("Recibo de pago", p != null && p.getReciboPagoDocumento() != null
                ? "Cargado en sistema"
                : "Pendiente de carga"));
        if (p != null && valorOpcional(p.getEstadoReciboPago()) != null) {
            filas.add(List.of("Validación de recibo", formatearEstadoSistema(p.getEstadoReciboPago(), "Pendiente")));
        }
        if (p != null && p.getFechaValidacionReciboPago() != null) {
            filas.add(List.of("Fecha de validación", formatearFechaHoraDocumento(p.getFechaValidacionReciboPago())));
        }
        return filas;
    }

    private String formatearMonto(BigDecimal monto) {
        if (monto == null) return "No especificado";
        java.text.NumberFormat nf = java.text.NumberFormat.getCurrencyInstance(new Locale("es", "MX"));
        return nf.format(monto) + " MXN";
    }

    private String formatearFechaLarga(LocalDate fecha) {
        if (fecha == null) return "No especificada";
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", new Locale("es", "MX"));
        return fecha.format(fmt);
    }
    private String formatearFechaHoraDocumento(LocalDateTime fecha) {
        if (fecha == null) return "No especificada";
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy HH:mm", new Locale("es", "MX"));
        return fecha.format(fmt);
    }

    private String formatearEstadoSistema(String value, String fallback) {
        String limpio = valorOpcional(value);
        if (limpio == null) return fallback;
        String clave = limpio.trim().toUpperCase(Locale.ROOT);
        return switch (clave) {
            case "APOYO_ENTREGADO" -> "Apoyo entregado";
            case "PENDIENTE_RECIBO" -> "Pendiente de recibo";
            case "RECIBO_CARGADO" -> "Recibo cargado";
            case "RECIBO_VALIDADO" -> "Recibo validado";
            case "RECIBO_RECHAZADO" -> "Recibo rechazado";
            default -> {
                String[] partes = limpio.replace('_', ' ').toLowerCase(Locale.ROOT).split("\\s+");
                List<String> normalizadas = new ArrayList<>();
                for (String parte : partes) {
                    if (parte.isBlank()) continue;
                    normalizadas.add(parte.substring(0, 1).toUpperCase(Locale.ROOT) + parte.substring(1));
                }
                yield normalizadas.isEmpty() ? fallback : String.join(" ", normalizadas);
            }
        };
    }

    private String valorOpcional(String value) {
        return value != null && !value.trim().isBlank() ? value.trim() : null;
    }
    private String valorDocumento(String value) {
        return value != null && !value.trim().isBlank() ? value.trim() : "No especificado";
    }
    @Transactional
    public Postulacion marcarIncumplimientoInformes(Long postulacionId, String motivo) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (!moduloInformesActivo(p.getConvocatoria())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Esta convocatoria no tiene activo el módulo de informes");
        }
        String motivoFinal = motivo != null && !motivo.trim().isBlank()
                ? motivo.trim()
                : "Incumplimiento de fechas de informes";
        aplicarIncumplimientoInformes(p, motivoFinal);
        return postulacionRepo.save(p);
    }

    @Transactional
    public int ejecutarReglasAutomaticasInformes() {
        List<Postulacion> candidatas = postulacionRepo.findAprobadasConInformesActivos();
        int actualizadas = 0;
        for (Postulacion p : candidatas) {
            if (!moduloInformesActivo(p.getConvocatoria())) {
                continue;
            }
            if (actualizarIncumplimientoInformesSiAplica(p)) {
                actualizadas++;
            }
        }
        if (actualizadas > 0) {
            postulacionRepo.saveAll(candidatas);
        }
        return actualizadas;
    }

    public List<Map<String, Object>> listarEvaluadoresDisponibles(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        if (!moduloEvaluadoresActivo(convocatoria)) {
            return List.of();
        }
        Set<String> postulantes = new HashSet<>();
        postulacionRepo.findUsuarioAuthEmailsByConvocatoriaId(convocatoriaId).forEach(email -> {
            if (email != null && !email.isBlank()) {
                postulantes.add(email.trim().toLowerCase(Locale.ROOT));
            }
        });

        List<Usuario> candidatos = usuarioRepo.findAllWithAuthUser().stream()
                .filter(u -> u.getAuthUser() != null)
                .filter(u -> u.getAuthUser().getEmail() != null && !u.getAuthUser().getEmail().isBlank())
                .filter(u -> u.getAuthUser().isEnabled())
                .filter(u -> !postulantes.contains(u.getAuthUser().getEmail().trim().toLowerCase(Locale.ROOT)))
                .sorted(Comparator.comparing(
                        u -> ((u.getNombre() != null ? u.getNombre() : "") + " " + (u.getApellidoPaterno() != null ? u.getApellidoPaterno() : "")).trim(),
                        String.CASE_INSENSITIVE_ORDER
                ))
                .toList();

        Map<Long, AreaConocimiento> areaByUsuarioId = new HashMap<>();
        List<Long> usuarioIds = candidatos.stream()
                .map(Usuario::getId)
                .filter(Objects::nonNull)
                .toList();
        if (!usuarioIds.isEmpty()) {
            areaConocimientoRepository.findByUsuarioIdIn(usuarioIds).forEach(area -> {
                if (area != null && area.getUsuario() != null && area.getUsuario().getId() != null) {
                    areaByUsuarioId.putIfAbsent(area.getUsuario().getId(), area);
                }
            });
        }

        return candidatos.stream().map(u -> {
            AreaConocimiento area = areaByUsuarioId.get(u.getId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("nombre", u.getNombre());
            m.put("apellidoPaterno", u.getApellidoPaterno());
            m.put("apellidoMaterno", u.getApellidoMaterno());
            m.put("email", u.getAuthUser().getEmail());
            m.put("roles", u.getAuthUser().getRoles());
            m.put("esEvaluador", u.getAuthUser().getRoles() != null && u.getAuthUser().getRoles().contains("ROLE_EVALUADOR"));
            m.put("areaNombre", area != null ? area.getAreaNombre() : null);
            m.put("campoNombre", area != null ? area.getCampoNombre() : null);
            m.put("disciplinaNombre", area != null ? area.getDisciplinaNombre() : null);
            m.put("subdisciplinaNombre", area != null ? area.getSubdisciplinaNombre() : null);
            return m;
        }).toList();
    }

    public boolean moduloComiteActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloComiteActivo(convocatoria);
    }

    public boolean moduloCotejoActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloCotejoActivo(convocatoria);
    }

    public boolean moduloInformesActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloInformesActivo(convocatoria);
    }

    public boolean moduloRenunciaActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloRenunciaActivo(convocatoria);
    }
    public boolean moduloSeguroMedicoActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloSeguroMedicoActivo(convocatoria);
    }

    public boolean moduloAceptacionActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloAceptacionActivo(convocatoria);
    }

    public boolean moduloConstanciasActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloConstanciasActivo(convocatoria);
    }

    public boolean moduloStatusAcademicoActivoPorConvocatoria(Long convocatoriaId) {
        Convocatoria convocatoria = convocatoriaService.obtenerPorId(convocatoriaId);
        return moduloStatusAcademicoActivo(convocatoria);
    }

    private void validarPostulacionPerteneceConvocatoria(Postulacion postulacion, Long convocatoriaId) {
        Long convocatoriaRealId = postulacion != null && postulacion.getConvocatoria() != null
                ? postulacion.getConvocatoria().getId()
                : null;
        if (convocatoriaId == null || convocatoriaRealId == null || !convocatoriaRealId.equals(convocatoriaId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La solicitud no pertenece a esta convocatoria");
        }
    }

    private void validarNoEsEvaluadorEnConvocatoria(Long convocatoriaId, Long authUserId) {
        if (convocatoriaId == null || authUserId == null) {
            return;
        }
        String email = authUserRepository.findById(authUserId)
                .map(AuthUser::getEmail)
                .map(v -> v != null ? v.trim().toLowerCase(Locale.ROOT) : "")
                .orElse("");
        if (email.isBlank()) {
            return;
        }
        long asignacionesComoEvaluador = postulacionRepo.countByConvocatoriaIdAndEvaluadorEmailIgnoreCase(convocatoriaId, email);
        if (asignacionesComoEvaluador > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No puedes postularte en esta convocatoria porque estás asignado como evaluador");
        }
    }

    @Transactional
    public void eliminar(Long postulacionId) {
        Postulacion p = postulacionRepo.findById(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulación no encontrada"));
        Long usuarioId = p.getUsuario() != null ? p.getUsuario().getId() : null;
        Set<Long> documentosParaEliminar = recolectarDocumentosDePostulacion(p);
        List<PostulacionDocumento> docs = postulacionDocumentoRepo.findByPostulacionId(postulacionId);
        docs.forEach(pd -> agregarDocumentoParaEliminar(documentosParaEliminar, pd.getDocumento()));

        if (!docs.isEmpty()) {
            postulacionDocumentoRepo.deleteAll(docs);
            postulacionDocumentoRepo.flush();
        }
        desvincularDocumentosPostulacion(p);
        postulacionRepo.saveAndFlush(p);
        postulacionRepo.delete(p);
        postulacionRepo.flush();

        if (usuarioId != null) {
            documentosParaEliminar.forEach(documentoId -> eliminarDocumentoPostulacion(documentoId, usuarioId));
        }
        log.info("Postulación {} eliminada con {} vinculo(s) y {} documento(s) asociado(s)", postulacionId, docs.size(), documentosParaEliminar.size());
    }

    private Set<Long> recolectarDocumentosDePostulacion(Postulacion p) {
        Set<Long> ids = new LinkedHashSet<>();
        agregarDocumentoParaEliminar(ids, p.getCurriculumDocumento());
        agregarDocumentoParaEliminar(ids, p.getCartaEvaluadorDocumento());
        agregarDocumentoParaEliminar(ids, p.getDictamenEvaluacionDocumento());
        agregarDocumentoParaEliminar(ids, p.getConstanciaEvaluadorDocumento());
        agregarDocumentoParaEliminar(ids, p.getOficioAprobacionDocumento());
        agregarDocumentoParaEliminar(ids, p.getNombramientoDocumento());
        agregarDocumentoParaEliminar(ids, p.getInformeParcialDocumento());
        agregarDocumentoParaEliminar(ids, p.getInformeFinalDocumento());
        agregarDocumentoParaEliminar(ids, p.getEstadoCuentaDocumento());
        agregarDocumentoParaEliminar(ids, p.getReciboPagoDocumento());
        agregarDocumentoParaEliminar(ids, p.getSeguroMedicoDocumento());
        agregarDocumentoParaEliminar(ids, p.getConstanciaFinalDocumento());
        agregarDocumentoParaEliminar(ids, p.getCartaCierreDocumento());
        agregarDocumentoParaEliminar(ids, p.getStatusAcademicoDocumento());
        agregarDocumentoParaEliminar(ids, p.getRenunciaDocumento());
        return ids;
    }

    private void agregarDocumentoParaEliminar(Set<Long> ids, Documento documento) {
        if (documento != null && documento.getId() != null) {
            ids.add(documento.getId());
        }
    }

    private void desvincularDocumentosPostulacion(Postulacion p) {
        p.setCurriculumDocumento(null);
        p.setCartaEvaluadorDocumento(null);
        p.setDictamenEvaluacionDocumento(null);
        p.setConstanciaEvaluadorDocumento(null);
        p.setOficioAprobacionDocumento(null);
        p.setNombramientoDocumento(null);
        p.setInformeParcialDocumento(null);
        p.setInformeFinalDocumento(null);
        p.setEstadoCuentaDocumento(null);
        p.setReciboPagoDocumento(null);
        p.setSeguroMedicoDocumento(null);
        p.setConstanciaFinalDocumento(null);
        p.setCartaCierreDocumento(null);
        p.setStatusAcademicoDocumento(null);
        p.setRenunciaDocumento(null);
    }

    private void eliminarDocumentoPostulacion(Long documentoId, Long usuarioId) {
        try {
            documentoService.eliminarDocumento(documentoId, usuarioId);
        } catch (Exception e) {
            log.warn("No se pudo eliminar documento {} asociado a postulacion eliminada: {}", documentoId, e.getMessage());
        }
    }

    private String obtenerNombreUsuario(Postulacion p) {
        Usuario u = p.getUsuario();
        if (u == null) return "";
        String n = (u.getNombre() != null ? u.getNombre() : "").trim();
        String ap = (u.getApellidoPaterno() != null ? u.getApellidoPaterno() : "").trim();
        if (!n.isEmpty() || !ap.isEmpty()) return (n + " " + ap).trim();
        return p.getCorreo();
    }

    private String obtenerNombreUsuarioCompleto(Postulacion p) {
        Usuario u = p != null ? p.getUsuario() : null;
        if (u == null) return p != null && p.getCorreo() != null ? p.getCorreo() : "";
        String nombre = String.join(" ",
                u.getNombre() != null ? u.getNombre().trim() : "",
                u.getApellidoPaterno() != null ? u.getApellidoPaterno().trim() : "",
                u.getApellidoMaterno() != null ? u.getApellidoMaterno().trim() : "").trim();
        return !nombre.isBlank() ? nombre : (p.getCorreo() != null ? p.getCorreo() : "");
    }

    private void enviarCorreoAceptacion(Postulacion p) {
        enviarCorreoAceptacion(p, null, null);
    }

    private void enviarCorreoAceptacion(Postulacion p, String mensajePersonalizado, MultipartFile documentoAceptacionAdjunto) {
        Convocatoria convocatoria = p.getConvocatoria();
        String nombre = obtenerNombreUsuario(p);
        String tituloConvocatoria = convocatoria != null ? convocatoria.getTitulo() : null;
        if (documentoAceptacionAdjunto != null && !documentoAceptacionAdjunto.isEmpty()) {
            try {
                String nombreArchivo = FileSecurityUtils.sanitizeFilename(
                        documentoAceptacionAdjunto.getOriginalFilename(),
                        "aceptacion_siimex.pdf");
                String contentType = documentoAceptacionAdjunto.getContentType();
                if (contentType == null || contentType.isBlank()) {
                    contentType = FileSecurityUtils.safeContentTypeForFilename(nombreArchivo);
                }
                emailService.sendPostulacionAceptadaPersonalizada(
                        p.getCorreo(),
                        nombre,
                        tituloConvocatoria,
                        mensajePersonalizado,
                        nombreArchivo,
                        contentType,
                        documentoAceptacionAdjunto.getBytes());
                return;
            } catch (IOException e) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo adjuntar el documento de aceptacion");
            }
        }

        Optional<ConvocatoriaFormato> documentoAceptacion = convocatoria != null && convocatoria.getId() != null
                ? convocatoriaFormatoService.obtenerDocumentoAceptacion(convocatoria.getId())
                : Optional.empty();
        if (documentoAceptacion.isPresent()) {
            ConvocatoriaFormato doc = documentoAceptacion.get();
            emailService.sendPostulacionAceptadaPersonalizada(
                    p.getCorreo(),
                    nombre,
                    tituloConvocatoria,
                    mensajePersonalizado,
                    doc.getNombreArchivo(),
                    doc.getContentType(),
                    doc.getContenido());
        } else {
            emailService.sendPostulacionAceptadaPersonalizada(
                    p.getCorreo(),
                    nombre,
                    tituloConvocatoria,
                    mensajePersonalizado,
                    null,
                    null,
                    null);
        }
    }

    private void validarEstadoCuentaArchivo(MultipartFile archivo, boolean requerido) {
        if (archivo == null || archivo.isEmpty()) {
            if (requerido) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Debes adjuntar el estado de cuenta");
            }
            return;
        }
        if (!esFormatoSolicitud(archivo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El estado de cuenta debe ser PDF, DOCX o XLSX");
        }
        validarLimitePdf(archivo, "postulacion.documentos", "El estado de cuenta");
    }

    private void validarDocumentoAceptacion(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) return;
        if (!esFormatoSolicitud(archivo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El documento de aceptacion debe ser PDF, DOCX o XLSX");
        }
        validarLimitePdf(archivo, "postulacion.documentos", "El documento de aceptacion");
    }
    private void notificarSeguimientoModulo(Postulacion p, String titulo, String mensaje) {
        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    titulo,
                    mensaje,
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/postulacion/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : ""));
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de seguimiento: {}", e.getMessage());
        }
    }

    private void notificarDocumentoEmitido(Postulacion p, String titulo, String mensaje) {
        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    titulo,
                    mensaje,
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/postulacion/" + (p.getConvocatoria() != null ? p.getConvocatoria().getId() : ""));
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de documento emitido: {}", e.getMessage());
        }
    }


    private String extensionArchivo(String nombreArchivo) {
        String ext = FileSecurityUtils.extensionOf(nombreArchivo);
        return ext == null || ext.isBlank() ? ".pdf" : "." + ext;
    }
    private void enviarCorreoDocumentoEmitido(Postulacion p, Documento doc, String tipoDocumento) {
        try {
            String correo = p != null ? p.getCorreo() : null;
            if (correo == null || correo.isBlank()) return;
            String nombre = obtenerNombreUsuarioCompleto(p);
            String convocatoria = p.getConvocatoria() != null ? p.getConvocatoria().getTitulo() : null;
            String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
            emailService.sendDocumentoPostulacionEmitido(correo, nombre, convocatoria, folio, tipoDocumento, doc);
        } catch (Exception e) {
            log.warn("No se pudo enviar correo de documento emitido ({}): {}", tipoDocumento, e.getMessage());
        }
    }

    private Documento guardarCurriculum(Long usuarioId, Long convocatoriaId, MultipartFile cvFile) throws IOException {
        if (!esPdf(cvFile)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El curr\u00edculum debe ser un PDF");
        }
        validarLimitePdf(cvFile, "postulacion.curriculum", "El curriculum");
        return documentoService.guardarDocumento(
                usuarioId, cvFile,
                Documento.TipoDocumento.CV_POSTULACION,
                "postulacion_" + convocatoriaId + "_" + System.currentTimeMillis() + ".pdf",
                false);
    }

    private boolean validarYResolverAvisoPrivacidad(Convocatoria convocatoria, Boolean aceptaAvisoPrivacidad, boolean valorActual) {
        boolean obligatorio = convocatoria != null && convocatoria.isAvisoPrivacidadObligatorio();
        if (obligatorio) {
            if (!Boolean.TRUE.equals(aceptaAvisoPrivacidad) && !valorActual) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Debes aceptar el aviso de privacidad para postularte");
            }
            return true;
        }
        return Boolean.TRUE.equals(aceptaAvisoPrivacidad) || valorActual;
    }

    private LocalDateTime resolverFechaAceptacionAvisoPrivacidad(Convocatoria convocatoria, Boolean aceptaAvisoPrivacidad, boolean valorActual) {
        boolean aceptado = validarYResolverAvisoPrivacidad(convocatoria, aceptaAvisoPrivacidad, valorActual);
        return aceptado ? LocalDateTime.now() : null;
    }

    private void generarCartaEvaluador(Postulacion p, AuthUser evaluador) {
        try {
            if (p == null || p.getUsuario() == null || evaluador == null) return;
            String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
            String convocatoria = p.getConvocatoria() != null && p.getConvocatoria().getTitulo() != null
                    ? p.getConvocatoria().getTitulo()
                    : "Convocatoria";
            List<String> lineas = List.of(
                    "Carta de invitacion para evaluacion",
                    "Folio de solicitud: " + folio,
                    "Convocatoria: " + convocatoria,
                    "Evaluador asignado: " + (evaluador.getEmail() != null ? evaluador.getEmail() : "N/A"),
                    "Fecha de asignacion: " + LocalDateTime.now()
            );
            byte[] pdf = SimplePdfGenerator.generarDocumento("SIIMEX - Carta de evaluador", lineas);
            Long usuarioId = obtenerUsuarioIdPropietarioDocumento(evaluador, p);
            Documento doc = documentoService.guardarDocumentoGenerado(
                    usuarioId,
                    Documento.TipoDocumento.CARTA_EVALUADOR,
                    "carta_evaluador_" + folio + ".pdf",
                    "application/pdf",
                    pdf,
                    true
            );
            p.setCartaEvaluadorDocumento(doc);
        } catch (Exception e) {
            log.warn("No se pudo generar carta de evaluador para postulacion {}: {}", p != null ? p.getId() : null, e.getMessage());
        }
    }

    private void generarDictamenEvaluacion(Postulacion p, AuthUser authUser) {
        try {
            if (p == null || p.getUsuario() == null || authUser == null) return;
            String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
            String convocatoria = p.getConvocatoria() != null && p.getConvocatoria().getTitulo() != null
                    ? p.getConvocatoria().getTitulo()
                    : "Convocatoria";
            String evaluador = authUser != null && authUser.getEmail() != null ? authUser.getEmail() : (p.getEvaluadorEmail() != null ? p.getEvaluadorEmail() : "N/A");
            List<String> lineas = new ArrayList<>();
            lineas.add("Dictamen de evaluacion");
            lineas.add("Folio de solicitud: " + folio);
            lineas.add("Convocatoria: " + convocatoria);
            lineas.add("Evaluador: " + evaluador);
            lineas.add("Resultado: " + (p.getResultadoEvaluacion() != null ? p.getResultadoEvaluacion() : "N/A"));
            lineas.add("Puntaje: " + (p.getPuntajeEvaluacion() != null ? p.getPuntajeEvaluacion() : 0));
            lineas.add("Comentarios: " + (p.getComentariosEvaluacion() != null ? p.getComentariosEvaluacion() : "Sin comentarios"));
            lineas.add("Fecha de evaluacion: " + (p.getFechaEvaluacion() != null ? p.getFechaEvaluacion() : LocalDateTime.now()));
            byte[] pdf = SimplePdfGenerator.generarDocumento("SIIMEX - Dictamen de evaluacion", lineas);
            Documento doc = documentoService.guardarDocumentoGenerado(
                    obtenerUsuarioIdPropietarioDocumento(authUser, p),
                    Documento.TipoDocumento.DICTAMEN_EVALUADOR,
                    "dictamen_evaluacion_" + folio + ".pdf",
                    "application/pdf",
                    pdf,
                    true
            );
            p.setDictamenEvaluacionDocumento(doc);
        } catch (Exception e) {
            log.warn("No se pudo generar dictamen de evaluacion para postulacion {}: {}", p != null ? p.getId() : null, e.getMessage());
        }
    }

    private void generarConstanciaEvaluador(Postulacion p, AuthUser authUser) {
        try {
            if (p == null || p.getUsuario() == null || authUser == null) return;
            String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
            String convocatoria = p.getConvocatoria() != null && p.getConvocatoria().getTitulo() != null
                    ? p.getConvocatoria().getTitulo()
                    : "Convocatoria";
            List<String> lineas = List.of(
                    "Constancia de participacion como evaluador",
                    "Evaluador: " + (authUser.getEmail() != null ? authUser.getEmail() : "N/A"),
                    "Solicitud evaluada: " + folio,
                    "Convocatoria: " + convocatoria,
                    "Resultado emitido: " + (p.getResultadoEvaluacion() != null ? p.getResultadoEvaluacion() : "N/A"),
                    "Fecha: " + LocalDate.now()
            );
            byte[] pdf = SimplePdfGenerator.generarDocumento("SIIMEX - Constancia de evaluador", lineas);
            Documento doc = documentoService.guardarDocumentoGenerado(
                    obtenerUsuarioIdPropietarioDocumento(authUser, p),
                    Documento.TipoDocumento.CONSTANCIA_EVALUADOR,
                    "constancia_evaluador_" + folio + ".pdf",
                    "application/pdf",
                    pdf,
                    true
            );
            p.setConstanciaEvaluadorDocumento(doc);
        } catch (Exception e) {
            log.warn("No se pudo generar constancia de evaluador para postulacion {}: {}", p != null ? p.getId() : null, e.getMessage());
        }
    }

    private Long obtenerUsuarioIdPropietarioDocumento(AuthUser authUser, Postulacion p) {
        if (authUser != null && authUser.getId() != null) {
            Optional<Usuario> usuarioEvaluador = usuarioRepo.findByAuthUserIdWithRegistro1(authUser.getId());
            if (usuarioEvaluador.isPresent()) {
                return usuarioEvaluador.get().getId();
            }
        }
        return p != null && p.getUsuario() != null ? p.getUsuario().getId() : null;
    }

    private Map<String, Object> toResumenMap(Postulacion p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("folio", p.getFolio());
        m.put("convocatoriaId", p.getConvocatoria() != null ? p.getConvocatoria().getId() : null);
        m.put("convocatoriaTitulo", p.getConvocatoria() != null ? p.getConvocatoria().getTitulo() : null);
        m.put("tipoApoyo", p.getTipoApoyo());
        m.put("tipoSolicitud", p.getTipoSolicitud());
        m.put("fechaEvento", p.getFechaEvento() != null ? p.getFechaEvento().toString() : null);
        m.put("tituloProyecto", p.getTituloProyecto());
        m.put("evaluadorEmail", p.getEvaluadorEmail());
        m.put("fechaAsignacionEvaluador", p.getFechaAsignacionEvaluador() != null ? p.getFechaAsignacionEvaluador().toString() : null);
        m.put("fechaLimiteCorreccion", p.getFechaLimiteCorreccion() != null ? p.getFechaLimiteCorreccion().toString() : null);
        m.put("estado", p.getEstado());
        m.put("resultadoEvaluacion", p.getResultadoEvaluacion());
        m.put("puntajeEvaluacion", p.getPuntajeEvaluacion());
        m.put("comentariosEvaluacion", p.getComentariosEvaluacion());
        m.put("fechaEvaluacion", p.getFechaEvaluacion() != null ? p.getFechaEvaluacion().toString() : null);
        m.put("cartaEvaluadorDocumentoId", p.getCartaEvaluadorDocumento() != null ? p.getCartaEvaluadorDocumento().getId() : null);
        m.put("cartaEvaluadorNombreArchivo", p.getCartaEvaluadorDocumento() != null ? p.getCartaEvaluadorDocumento().getNombreArchivo() : null);
        m.put("dictamenEvaluacionDocumentoId", p.getDictamenEvaluacionDocumento() != null ? p.getDictamenEvaluacionDocumento().getId() : null);
        m.put("dictamenEvaluacionNombreArchivo", p.getDictamenEvaluacionDocumento() != null ? p.getDictamenEvaluacionDocumento().getNombreArchivo() : null);
        m.put("constanciaEvaluadorDocumentoId", p.getConstanciaEvaluadorDocumento() != null ? p.getConstanciaEvaluadorDocumento().getId() : null);
        m.put("constanciaEvaluadorNombreArchivo", p.getConstanciaEvaluadorDocumento() != null ? p.getConstanciaEvaluadorDocumento().getNombreArchivo() : null);
        m.put("oficioAprobacionDocumentoId", p.getOficioAprobacionDocumento() != null ? p.getOficioAprobacionDocumento().getId() : null);
        m.put("oficioAprobacionNombreArchivo", p.getOficioAprobacionDocumento() != null ? p.getOficioAprobacionDocumento().getNombreArchivo() : null);
        m.put("fechaOficioAprobacion", p.getFechaOficioAprobacion() != null ? p.getFechaOficioAprobacion().toString() : null);
        m.put("nombramientoDocumentoId", p.getNombramientoDocumento() != null ? p.getNombramientoDocumento().getId() : null);
        m.put("nombramientoNombreArchivo", p.getNombramientoDocumento() != null ? p.getNombramientoDocumento().getNombreArchivo() : null);
        m.put("fechaNombramiento", p.getFechaNombramiento() != null ? p.getFechaNombramiento().toString() : null);
        m.put("estadoComite", p.getEstadoComite());
        m.put("montoApoyoAsignado", p.getMontoApoyoAsignado());
        m.put("observacionesComite", p.getObservacionesComite());
        m.put("fechaComite", p.getFechaComite() != null ? p.getFechaComite().toString() : null);
        m.put("banco", p.getBanco());
        m.put("titularCuenta", p.getTitularCuenta());
        m.put("cuentaBancaria", p.getCuentaBancaria());
        m.put("clabeInterbancaria", p.getClabeInterbancaria());
        m.put("estadoCuentaDocumentoId", p.getEstadoCuentaDocumento() != null ? p.getEstadoCuentaDocumento().getId() : null);
        m.put("estadoCuentaNombreArchivo", p.getEstadoCuentaDocumento() != null ? p.getEstadoCuentaDocumento().getNombreArchivo() : null);
        m.put("medioNotificacion", p.getMedioNotificacion());
        m.put("fechaActualizacionBancaria", p.getFechaActualizacionBancaria() != null ? p.getFechaActualizacionBancaria().toString() : null);
        m.put("estadoEntregaApoyo", p.getEstadoEntregaApoyo());
        m.put("fechaEntregaApoyo", p.getFechaEntregaApoyo() != null ? p.getFechaEntregaApoyo().toString() : null);
        m.put("observacionesEntregaApoyo", p.getObservacionesEntregaApoyo());
        m.put("estadoCotejo", p.getEstadoCotejo());
        m.put("observacionesCotejo", p.getObservacionesCotejo());
        m.put("fechaCotejo", p.getFechaCotejo() != null ? p.getFechaCotejo().toString() : null);
        TipoInformesRequeridos tipoInformesRequeridos = resolverTipoInformesRequeridos(p.getConvocatoria());
        String estadoInforme = p.getEstadoInforme();
        if ((estadoInforme == null || estadoInforme.isBlank()) && tipoInformesRequeridos == TipoInformesRequeridos.NINGUNO) {
            estadoInforme = "NO_REQUIERE";
        }
        m.put("informesRequeridos", tipoInformesRequeridos.name());
        m.put("requiereInformeParcial", tipoInformesRequeridos == TipoInformesRequeridos.PARCIAL || tipoInformesRequeridos == TipoInformesRequeridos.AMBOS);
        m.put("requiereInformeFinal", tipoInformesRequeridos == TipoInformesRequeridos.FINAL || tipoInformesRequeridos == TipoInformesRequeridos.AMBOS);
        m.put("estadoInforme", estadoInforme);
        m.put("fechaLimiteInformeParcial", p.getFechaLimiteInformeParcial() != null ? p.getFechaLimiteInformeParcial().toString() : null);
        m.put("fechaLimiteInformeFinal", p.getFechaLimiteInformeFinal() != null ? p.getFechaLimiteInformeFinal().toString() : null);
        m.put("fechaInformeParcial", p.getFechaInformeParcial() != null ? p.getFechaInformeParcial().toString() : null);
        m.put("fechaInformeFinal", p.getFechaInformeFinal() != null ? p.getFechaInformeFinal().toString() : null);
        m.put("observacionesInforme", p.getObservacionesInforme());
        m.put("motivoIncumplimientoInforme", p.getMotivoIncumplimientoInforme());
        m.put("estadoRenuncia", p.getEstadoRenuncia());
        m.put("motivoRenuncia", p.getMotivoRenuncia());
        m.put("fechaSolicitudRenuncia", p.getFechaSolicitudRenuncia() != null ? p.getFechaSolicitudRenuncia().toString() : null);
        m.put("fechaResolucionRenuncia", p.getFechaResolucionRenuncia() != null ? p.getFechaResolucionRenuncia().toString() : null);
        m.put("observacionesRenuncia", p.getObservacionesRenuncia());
        m.put("renunciaDocumentoId", p.getRenunciaDocumento() != null ? p.getRenunciaDocumento().getId() : null);
        m.put("renunciaNombreArchivo", p.getRenunciaDocumento() != null ? p.getRenunciaDocumento().getNombreArchivo() : null);
        m.put("avisoPrivacidadAceptado", p.isAvisoPrivacidadAceptado());
        m.put("fechaAceptacionAvisoPrivacidad", p.getFechaAceptacionAvisoPrivacidad() != null ? p.getFechaAceptacionAvisoPrivacidad().toString() : null);
        m.put("informeParcialDocumentoId", p.getInformeParcialDocumento() != null ? p.getInformeParcialDocumento().getId() : null);
        m.put("informeParcialNombreArchivo", p.getInformeParcialDocumento() != null ? p.getInformeParcialDocumento().getNombreArchivo() : null);
        m.put("informeFinalDocumentoId", p.getInformeFinalDocumento() != null ? p.getInformeFinalDocumento().getId() : null);
        m.put("informeFinalNombreArchivo", p.getInformeFinalDocumento() != null ? p.getInformeFinalDocumento().getNombreArchivo() : null);
        m.put("reciboPagoDocumentoId", p.getReciboPagoDocumento() != null ? p.getReciboPagoDocumento().getId() : null);
        m.put("reciboPagoNombreArchivo", p.getReciboPagoDocumento() != null ? p.getReciboPagoDocumento().getNombreArchivo() : null);
        m.put("estadoReciboPago", p.getEstadoReciboPago());
        m.put("fechaReciboPago", p.getFechaReciboPago() != null ? p.getFechaReciboPago().toString() : null);
        m.put("fechaValidacionReciboPago", p.getFechaValidacionReciboPago() != null ? p.getFechaValidacionReciboPago().toString() : null);
        m.put("observacionesReciboPago", p.getObservacionesReciboPago());
        m.put("estadoStatusAcademico", p.getEstadoStatusAcademico());
        m.put("fechaStatusAcademico", p.getFechaStatusAcademico() != null ? p.getFechaStatusAcademico().toString() : null);
        m.put("observacionesStatusAcademico", p.getObservacionesStatusAcademico());
        m.put("informacionStatusAcademico", p.getInformacionStatusAcademico());
        m.put("statusAcademicoDocumentoId", p.getStatusAcademicoDocumento() != null ? p.getStatusAcademicoDocumento().getId() : null);
        m.put("statusAcademicoNombreArchivo", p.getStatusAcademicoDocumento() != null ? p.getStatusAcademicoDocumento().getNombreArchivo() : null);
        m.put("fechaCreacion", p.getFechaCreacion() != null ? p.getFechaCreacion().toString() : null);
        return m;
    }

    private record RequisitoDocumento(String clave, String etiqueta, boolean requerido) {}

    private List<RequisitoDocumento> parseRequisitosDocumentos(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> arr = (List<Map<String, Object>>) new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, List.class);
            List<RequisitoDocumento> out = new ArrayList<>();
            for (Map<String, Object> m : arr) {
                String clave = m.get("clave") != null ? String.valueOf(m.get("clave")).trim().replaceAll("\\s+", "_") : null;
                if (clave == null || clave.isEmpty()) continue;
                String etiqueta = m.get("etiqueta") != null ? String.valueOf(m.get("etiqueta")).trim() : clave;
                boolean requerido = Boolean.TRUE.equals(m.get("requerido"));
                out.add(new RequisitoDocumento(clave, etiqueta, requerido));
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private void validarDocumentosRequeridos(List<RequisitoDocumento> requisitos, Map<String, MultipartFile> adjuntos) {
        for (RequisitoDocumento r : requisitos) {
            if (!r.requerido()) continue;
            MultipartFile f = adjuntos != null ? adjuntos.get(r.clave()) : null;
            if (f == null || f.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Falta documento requerido: " + r.etiqueta());
            }
            if (!esFormatoSolicitud(f)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, r.etiqueta() + ": solo se permiten archivos PDF, DOCX o XLSX");
            }
            validarLimitePdf(f, "postulacion.documentos", r.etiqueta());
        }
    }

    private void guardarDocumentosAdjuntos(Postulacion p, Long usuarioId, Long convocatoriaId,
                                           Map<String, MultipartFile> adjuntos) throws IOException {
        for (Map.Entry<String, MultipartFile> e : adjuntos.entrySet()) {
            MultipartFile f = e.getValue();
            if (f == null || f.isEmpty()) continue;
            String clave = e.getKey();
            if (!esFormatoSolicitud(f)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Documento adjunto (" + clave + "): solo se permiten archivos PDF, DOCX o XLSX");
            }
            validarLimitePdf(f, "postulacion.documentos", "Documento adjunto (" + clave + ")");

            String ext = f.getOriginalFilename() != null && f.getOriginalFilename().contains(".")
                    ? f.getOriginalFilename().substring(f.getOriginalFilename().lastIndexOf('.'))
                    : ".pdf";
            Documento doc = documentoService.guardarDocumento(
                    usuarioId, f,
                    Documento.TipoDocumento.ADJUNTO_POSTULACION,
                    "postulacion_" + convocatoriaId + "_" + clave + "_" + System.currentTimeMillis() + ext,
                    false);
            PostulacionDocumento pd = PostulacionDocumento.builder()
                    .postulacion(p)
                    .clave(clave)
                    .documento(doc)
                    .build();
            postulacionDocumentoRepo.save(pd);
        }
    }

    private void validarLimitePdf(MultipartFile archivo, String limiteKey, String etiqueta) {
        if (archivo != null && !archivo.isEmpty() && archivo.getSize() > configuracionSistemaService.obtenerLimitePdfBytes(limiteKey)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, configuracionSistemaService.mensajeLimitePdf(etiqueta, limiteKey));
        }
    }

    private boolean esPdf(MultipartFile file) {
        if (file == null || file.isEmpty()) return false;
        String contentType = file.getContentType();
        String nombre = file.getOriginalFilename();
        boolean mimePdf = contentType != null && contentType.toLowerCase(Locale.ROOT).contains("pdf");
        boolean extPdf = nombre != null && nombre.toLowerCase(Locale.ROOT).endsWith(".pdf");
        return mimePdf || extPdf;
    }

    private boolean esFormatoSolicitud(MultipartFile file) {
        if (file == null || file.isEmpty()) return false;
        if (esPdf(file)) return true;
        return FileSecurityUtils.isOfficeDocument(file);
    }

    private String validarTipoApoyoConvocatoria(Convocatoria convocatoria, String tipoApoyo) {
        String limpio = tipoApoyo != null ? tipoApoyo.trim() : "";
        if (limpio.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El tipo de apoyo es obligatorio");
        }
        List<String> disponibles = parseTiposApoyo(convocatoria != null ? convocatoria.getTiposApoyo() : null);
        if (disponibles.isEmpty()) {
            return limpio;
        }
        for (String t : disponibles) {
            if (t.equalsIgnoreCase(limpio)) {
                return t;
            }
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El tipo de apoyo no está permitido para esta convocatoria");
    }

    private List<String> parseTiposApoyo(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            @SuppressWarnings("unchecked")
            List<Object> arr = (List<Object>) new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, List.class);
            List<String> out = new ArrayList<>();
            for (Object o : arr) {
                String v = o != null ? String.valueOf(o).trim() : "";
                if (!v.isBlank()) out.add(v);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private record ReglaConfigurableConvocatoria(String clave, String valor, String descripcion) {}

    private record CriterioFormularioConfig(String clave, String etiqueta, boolean requerido) {}

    private enum TipoInformesRequeridos { NINGUNO, PARCIAL, FINAL, AMBOS }

    private List<ReglaConfigurableConvocatoria> parseReglasConfigurables(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            @SuppressWarnings("unchecked")
            List<Object> arr = (List<Object>) new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, List.class);
            List<ReglaConfigurableConvocatoria> out = new ArrayList<>();
            for (Object item : arr) {
                if (!(item instanceof Map<?, ?> rawMap)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) rawMap;
                String clave = m.get("clave") != null ? String.valueOf(m.get("clave")).trim() : "";
                if (clave.isBlank()) continue;
                String valor = m.get("valor") != null ? String.valueOf(m.get("valor")).trim() : "";
                String descripcion = m.get("descripcion") != null ? String.valueOf(m.get("descripcion")).trim() : "";
                out.add(new ReglaConfigurableConvocatoria(clave, valor, descripcion));
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<CriterioFormularioConfig> parseCriteriosFormularioConfig(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> arr = (List<Map<String, Object>>) new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, List.class);
            List<CriterioFormularioConfig> out = new ArrayList<>();
            for (Map<String, Object> m : arr) {
                String clave = m.get("clave") != null ? String.valueOf(m.get("clave")).trim() : "";
                if (clave.isBlank()) continue;
                String etiqueta = m.get("etiqueta") != null ? String.valueOf(m.get("etiqueta")).trim() : clave;
                boolean requerido = resolverBooleano(m.get("requerido"), false);
                out.add(new CriterioFormularioConfig(clave, etiqueta, requerido));
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, Object> parseCriteriosRespuestas(String criteriosJson) {
        if (criteriosJson == null || criteriosJson.isBlank()) return Map.of();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> raw = (Map<String, Object>) new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(criteriosJson, Map.class);
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<String, Object> e : raw.entrySet()) {
                if (e.getKey() == null) continue;
                String k = e.getKey().trim();
                if (k.isBlank()) continue;
                out.put(k, e.getValue());
            }
            return out;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private void validarReglasConfigurablesConvocatoria(
            Convocatoria convocatoria,
            String cedula,
            String curp,
            String correo,
            String telefono,
            String tipoApoyo,
            String tipoSolicitud,
            LocalDate fechaEvento,
            String tituloProyecto,
            String descripcionProyecto,
            String observaciones,
            String criteriosJson
    ) {
        if (convocatoria == null) return;

        Map<String, Object> criterios = parseCriteriosRespuestas(criteriosJson);
        validarCriteriosRequeridos(convocatoria, criterios);

        List<ReglaConfigurableConvocatoria> reglas = parseReglasConfigurables(convocatoria.getReglasConfigurables());
        if (reglas.isEmpty()) return;

        String cedulaNorm = cedula != null ? cedula.trim() : "";
        String curpNorm = curp != null ? curp.trim().toUpperCase(Locale.ROOT) : "";
        String correoNorm = correo != null ? correo.trim().toLowerCase(Locale.ROOT) : "";
        String telefonoNorm = telefono != null ? telefono.trim() : "";
        String tipoApoyoNorm = tipoApoyo != null ? tipoApoyo.trim() : "";
        String tipoSolicitudNorm = tipoSolicitud != null ? tipoSolicitud.trim().toUpperCase(Locale.ROOT) : "";
        boolean tipoSolicitudActiva = tipoSolicitudActivo(convocatoria);
        boolean fechaEventoActiva = fechaEventoActivo(convocatoria);
        boolean informacionProyectoActiva = informacionProyectoActiva(convocatoria);
        String tituloNorm = tituloProyecto != null ? tituloProyecto.trim() : "";
        String descripcionNorm = descripcionProyecto != null ? descripcionProyecto.trim() : "";
        String observacionesNorm = observaciones != null ? observaciones.trim() : "";

        Long diasAnticipacion = null;
        LocalDate hoy = LocalDate.now();
        LocalDateTime ahora = LocalDateTime.now();

        for (ReglaConfigurableConvocatoria regla : reglas) {
            String key = normalizarClaveRegla(regla.clave());
            if (key.isBlank()) continue;

            if (key.startsWith("criterio.")) {
                aplicarReglaCriterio(regla, key, criterios);
                continue;
            }

            switch (key) {
                case "requerir_cedula", "cedula_obligatoria" -> {
                    if (resolverBooleano(regla.valor(), false) && cedulaNorm.isBlank()) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la cédula es obligatoria"));
                    }
                }
                case "requerir_curp", "curp_obligatoria" -> {
                    if (resolverBooleano(regla.valor(), false) && curpNorm.isBlank()) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la CURP es obligatoria"));
                    }
                }
                case "requerir_telefono", "telefono_obligatorio" -> {
                    if (resolverBooleano(regla.valor(), false) && telefonoNorm.isBlank()) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el teléfono es obligatorio"));
                    }
                }
                case "requerir_observaciones", "observaciones_obligatorias" -> {
                    if (resolverBooleano(regla.valor(), false) && observacionesNorm.isBlank()) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "las observaciones son obligatorias"));
                    }
                }
                case "titulo_proyecto_min_chars" -> {
                    if (!informacionProyectoActiva) break;
                    int min = resolverEnteroNoNegativo(regla);
                    if (tituloNorm.length() < min) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el título del proyecto debe tener al menos " + min + " caracteres"));
                    }
                }
                case "titulo_proyecto_max_chars" -> {
                    if (!informacionProyectoActiva) break;
                    int max = resolverEnteroNoNegativo(regla);
                    if (tituloNorm.length() > max) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el título del proyecto no debe superar " + max + " caracteres"));
                    }
                }
                case "descripcion_proyecto_min_chars" -> {
                    if (!informacionProyectoActiva) break;
                    int min = resolverEnteroNoNegativo(regla);
                    if (descripcionNorm.length() < min) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la descripción del proyecto debe tener al menos " + min + " caracteres"));
                    }
                }
                case "descripcion_proyecto_max_chars" -> {
                    if (!informacionProyectoActiva) break;
                    int max = resolverEnteroNoNegativo(regla);
                    if (descripcionNorm.length() > max) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la descripción del proyecto no debe superar " + max + " caracteres"));
                    }
                }
                case "observaciones_max_chars" -> {
                    int max = resolverEnteroNoNegativo(regla);
                    if (observacionesNorm.length() > max) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "las observaciones no deben superar " + max + " caracteres"));
                    }
                }
                case "correo_dominios_permitidos", "dominios_correo_permitidos" -> {
                    if (correoNorm.isBlank()) break;
                    Set<String> dominios = parseListaValores(regla.valor());
                    if (dominios.isEmpty()) break;
                    String dominio = extraerDominio(correoNorm);
                    if (dominio == null || !dominios.contains(dominio)) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el correo debe pertenecer a alguno de estos dominios: " + String.join(", ", dominios)));
                    }
                }
                case "tipo_solicitud_permitida", "tipo_solicitud_permitido" -> {
                    if (!tipoSolicitudActiva) break;
                    Set<String> permitidos = parseListaValores(regla.valor());
                    if (!permitidos.isEmpty() && !permitidos.contains(tipoSolicitudNorm.toLowerCase(Locale.ROOT))) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el tipo de solicitud no está permitido"));
                    }
                }
                case "tipo_apoyo_permitido", "tipo_apoyo_permitida" -> {
                    Set<String> permitidos = parseListaValores(regla.valor());
                    if (!permitidos.isEmpty() && !permitidos.contains(tipoApoyoNorm.toLowerCase(Locale.ROOT))) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el tipo de apoyo no está permitido"));
                    }
                }
                case "fecha_evento_no_fin_semana" -> {
                    if (!fechaEventoActiva) break;
                    if (resolverBooleano(regla.valor(), false) && fechaEvento != null) {
                        java.time.DayOfWeek dow = fechaEvento.getDayOfWeek();
                        if (dow == java.time.DayOfWeek.SATURDAY || dow == java.time.DayOfWeek.SUNDAY) {
                            throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la fecha del evento no puede ser sábado o domingo"));
                        }
                    }
                }
                case "fecha_evento_min_dias" -> {
                    if (!fechaEventoActiva) break;
                    if (!Boolean.FALSE.equals(convocatoria.getDiasMinAnticipacionHabilitado())) {
                        int min = resolverEnteroNoNegativo(regla);
                        if (fechaEvento != null) {
                            if (diasAnticipacion == null) diasAnticipacion = feriadoService.diasNaturalesSinFeriados(hoy, fechaEvento);
                            if (diasAnticipacion < min) {
                                throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la fecha del evento requiere al menos " + min + " días de anticipación"));
                            }
                        }
                    }
                }
                case "fecha_evento_max_dias" -> {
                    if (!fechaEventoActiva) break;
                    if (!Boolean.FALSE.equals(convocatoria.getDiasMaxAnticipacionHabilitado())) {
                        int max = resolverEnteroNoNegativo(regla);
                        if (fechaEvento != null) {
                            if (diasAnticipacion == null) diasAnticipacion = feriadoService.diasNaturalesSinFeriados(hoy, fechaEvento);
                            if (diasAnticipacion > max) {
                                throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la fecha del evento no debe superar " + max + " días de anticipación"));
                            }
                        }
                    }
                }
                case "postulacion_fecha_inicio", "fecha_inicio_postulacion", "solicitud_fecha_inicio", "postulacion_desde" -> {
                    LocalDateTime fechaInicio = resolverFechaHoraRegla(regla, false);
                    if (ahora.isBefore(fechaInicio)) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la recepción de solicitudes inicia el " + fechaInicio));
                    }
                }
                case "postulacion_fecha_fin", "fecha_fin_postulacion", "solicitud_fecha_fin", "postulacion_hasta", "limite_solicitud_fecha" -> {
                    LocalDateTime fechaFin = resolverFechaHoraRegla(regla, true);
                    if (ahora.isAfter(fechaFin)) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "la recepción de solicitudes cerró el " + fechaFin));
                    }
                }
                default -> {
                    // Regla desconocida: se ignora para permitir evolución progresiva de claves.
                }
            }
        }
    }

    private void validarCriteriosRequeridos(Convocatoria convocatoria, Map<String, Object> criterios) {
        List<CriterioFormularioConfig> criteriosConfig = parseCriteriosFormularioConfig(
                convocatoria != null ? convocatoria.getCriteriosFormulario() : null
        );
        if (criteriosConfig.isEmpty()) return;

        for (CriterioFormularioConfig c : criteriosConfig) {
            if (!c.requerido()) continue;
            Object value = criterios != null ? criterios.get(c.clave()) : null;
            if (esValorVacio(value)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Falta responder el criterio obligatorio: " + c.etiqueta());
            }
        }
    }

    private void aplicarReglaCriterio(ReglaConfigurableConvocatoria regla, String key, Map<String, Object> criterios) {
        String resto = key.substring("criterio.".length());
        int idx = resto.lastIndexOf('.');
        if (idx <= 0 || idx >= resto.length() - 1) return;

        String criterioClave = resto.substring(0, idx).trim();
        String operador = resto.substring(idx + 1).trim();
        if (criterioClave.isBlank() || operador.isBlank()) return;

        Object value = criterios != null ? criterios.get(criterioClave) : null;
        String etiqueta = "criterio \"" + criterioClave + "\"";

        switch (operador) {
            case "requerido" -> {
                if (resolverBooleano(regla.valor(), false) && esValorVacio(value)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el " + etiqueta + " es obligatorio"));
                }
            }
            case "min" -> {
                if (esValorVacio(value)) return;
                int min = resolverEnteroNoNegativo(regla);
                BigDecimal numero = resolverNumero(value);
                if (numero != null) {
                    if (numero.compareTo(BigDecimal.valueOf(min)) < 0) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el " + etiqueta + " debe ser mayor o igual a " + min));
                    }
                } else {
                    String txt = String.valueOf(value).trim();
                    if (txt.length() < min) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el " + etiqueta + " debe tener al menos " + min + " caracteres"));
                    }
                }
            }
            case "max" -> {
                if (esValorVacio(value)) return;
                int max = resolverEnteroNoNegativo(regla);
                BigDecimal numero = resolverNumero(value);
                if (numero != null) {
                    if (numero.compareTo(BigDecimal.valueOf(max)) > 0) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el " + etiqueta + " debe ser menor o igual a " + max));
                    }
                } else {
                    String txt = String.valueOf(value).trim();
                    if (txt.length() > max) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el " + etiqueta + " no debe superar " + max + " caracteres"));
                    }
                }
            }
            case "opciones" -> {
                if (esValorVacio(value)) return;
                Set<String> opciones = parseListaValores(regla.valor());
                if (opciones.isEmpty()) return;
                String actual = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
                if (!opciones.contains(actual)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "el valor del " + etiqueta + " no está permitido"));
                }
            }
            default -> {
                // Operador desconocido en regla de criterio.
            }
        }
    }

    private String normalizarClaveRegla(String clave) {
        if (clave == null) return "";
        return clave.trim()
                .toLowerCase(Locale.ROOT)
                .replace(' ', '_')
                .replace('-', '_');
    }

    private String construirMensajeRegla(ReglaConfigurableConvocatoria regla, String detalle) {
        String etiqueta = regla != null && regla.descripcion() != null && !regla.descripcion().isBlank()
                ? regla.descripcion().trim()
                : (regla != null ? regla.clave() : "regla");
        return "Regla de convocatoria \"" + etiqueta + "\": " + detalle;
    }

    private int resolverEnteroNoNegativo(ReglaConfigurableConvocatoria regla) {
        String raw = regla != null && regla.valor() != null ? regla.valor().trim() : "";
        try {
            int value = Integer.parseInt(raw);
            if (value < 0) throw new NumberFormatException("negativo");
            return value;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "valor numérico inválido en configuración"));
        }
    }

    private LocalDate resolverFechaRegla(ReglaConfigurableConvocatoria regla) {
        String raw = regla != null && regla.valor() != null ? regla.valor().trim() : "";
        if (raw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "debe incluir una fecha"));
        }
        try {
            return LocalDate.parse(raw);
        } catch (Exception ignored) {
            // Intentar formatos alternos comunes.
        }
        try {
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
            return LocalDate.parse(raw, fmt);
        } catch (Exception ignored) {
            // Continúa con error final.
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "fecha inválida. Usa formato yyyy-MM-dd o dd/MM/yyyy"));
    }

    private LocalDateTime resolverFechaHoraRegla(ReglaConfigurableConvocatoria regla, boolean finDelDia) {
        String raw = regla != null && regla.valor() != null ? regla.valor().trim() : "";
        if (raw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "debe incluir una fecha y hora"));
        }
        String normalized = raw.replace(' ', 'T');
        try {
            return LocalDateTime.parse(normalized);
        } catch (Exception ignored) {
            // Intentar formatos alternos comunes.
        }
        try {
            LocalDate fecha = LocalDate.parse(raw);
            return finDelDia ? fecha.atTime(23, 59, 59) : fecha.atStartOfDay();
        } catch (Exception ignored) {
            // Intentar formato mexicano.
        }
        try {
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
            return LocalDateTime.parse(raw, fmt);
        } catch (Exception ignored) {
            // Intentar fecha mexicana sin hora.
        }
        try {
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
            LocalDate fecha = LocalDate.parse(raw, fmt);
            return finDelDia ? fecha.atTime(23, 59, 59) : fecha.atStartOfDay();
        } catch (Exception ignored) {
            // Continúa con error final.
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "fecha/hora inválida. Usa formato yyyy-MM-ddTHH:mm o dd/MM/yyyy HH:mm"));
    }

    private boolean resolverBooleano(Object value, boolean fallback) {
        if (value == null) return fallback;
        String v = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        if (v.isBlank()) return fallback;
        return "true".equals(v) || "1".equals(v) || "si".equals(v) || "sí".equals(v) || "yes".equals(v) || "on".equals(v);
    }

    private Set<String> parseListaValores(String value) {
        if (value == null || value.isBlank()) return Set.of();
        Set<String> out = new LinkedHashSet<>();
        for (String item : value.split("[,;|]")) {
            String v = item != null ? item.trim().toLowerCase(Locale.ROOT) : "";
            if (!v.isBlank()) out.add(v);
        }
        return out;
    }

    private Set<String> resolverEstadosEditablesConvocatoria(Convocatoria convocatoria) {
        List<ReglaConfigurableConvocatoria> reglas = parseReglasConfigurables(convocatoria != null ? convocatoria.getReglasConfigurables() : null);
        ReglaConfigurableConvocatoria regla = buscarRegla(
                reglas,
                "postulacion_estados_editables",
                "estados_editables_postulacion",
                "edicion_estados_permitidos"
        );
        if (regla == null || regla.valor() == null || regla.valor().trim().isBlank()) {
            return new LinkedHashSet<>(List.of("PENDIENTE", "CON_OBSERVACIONES"));
        }
        Set<String> estados = new LinkedHashSet<>();
        for (String item : regla.valor().split("[,;|]")) {
            String estado = item != null ? item.trim().toUpperCase(Locale.ROOT) : "";
            if (!estado.isBlank()) {
                estados.add(estado);
            }
        }
        if (estados.isEmpty()) {
            estados.add("PENDIENTE");
            estados.add("CON_OBSERVACIONES");
        }
        return estados;
    }

    private Integer resolverEnteroReglaConvocatoria(Convocatoria convocatoria, String... claves) {
        List<ReglaConfigurableConvocatoria> reglas = parseReglasConfigurables(convocatoria != null ? convocatoria.getReglasConfigurables() : null);
        ReglaConfigurableConvocatoria regla = buscarRegla(reglas, claves);
        if (regla == null || regla.valor() == null || regla.valor().trim().isBlank()) return null;
        try {
            return Integer.parseInt(regla.valor().trim());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, construirMensajeRegla(regla, "valor numérico inválido en configuración"));
        }
    }

    private boolean resolverModuloActivoConvocatoria(Convocatoria convocatoria, boolean fallback, String... claves) {
        List<ReglaConfigurableConvocatoria> reglas = parseReglasConfigurables(
                convocatoria != null ? convocatoria.getReglasConfigurables() : null
        );
        ReglaConfigurableConvocatoria regla = buscarRegla(reglas, claves);
        if (regla == null) return fallback;
        return resolverBooleano(regla.valor(), fallback);
    }

    private boolean moduloEvaluadoresActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_evaluadores_activo",
                "modulo_evaluadores",
                "requiere_evaluadores"
        );
    }

    private boolean moduloComiteActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_comite_activo",
                "modulo_comite",
                "requiere_comite"
        );
    }

    private boolean moduloCotejoActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_cotejo_activo",
                "modulo_cotejo",
                "requiere_cotejo"
        );
    }

    private boolean moduloInformesActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_informes_activo",
                "modulo_informes",
                "requiere_informes"
        );
    }

    private boolean moduloBancariaActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_bancaria_activo",
                "modulo_bancaria",
                "requiere_bancaria"
        );
    }

    private boolean moduloSeguroMedicoActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_seguro_medico_activo",
                "modulo_seguro_medico",
                "requiere_seguro_medico"
        );
    }

    private boolean moduloAceptacionActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_aceptacion_activo",
                "modulo_aceptacion",
                "requiere_aceptacion"
        );
    }

    private boolean moduloConstanciasActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_constancias_activo",
                "modulo_constancias",
                "requiere_constancias",
                "modulo_carta_cierre_activo",
                "modulo_carta_cierre",
                "requiere_carta_cierre"
        );
    }

    private boolean moduloStatusAcademicoActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_status_academico_activo",
                "modulo_status_academico",
                "requiere_status_academico",
                "modulo_estatus_academico_activo",
                "modulo_estatus_academico",
                "requiere_estatus_academico"
        );
    }

    private boolean moduloRenunciaActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "modulo_renuncia_activo",
                "modulo_renuncia",
                "requiere_renuncia"
        );
    }

    private boolean esValorVacio(Object value) {
        if (value == null) return true;
        if (value instanceof String s) return s.trim().isBlank();
        if (value instanceof Collection<?> c) return c.isEmpty();
        if (value instanceof Map<?, ?> m) return m.isEmpty();
        return false;
    }

    private BigDecimal resolverNumero(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return new BigDecimal(n.toString());
        String raw = String.valueOf(value).trim();
        if (raw.isBlank()) return null;
        try {
            return new BigDecimal(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private String extraerDominio(String correo) {
        if (correo == null) return null;
        int idx = correo.lastIndexOf('@');
        if (idx <= 0 || idx >= correo.length() - 1) return null;
        return correo.substring(idx + 1).trim().toLowerCase(Locale.ROOT);
    }

    private String generarFolioUnico(Postulacion p) {
        String prefijo = resolverPrefijoFolio(p.getConvocatoria());
        Long id = p.getId() != null ? p.getId() : 0L;
        return prefijo + "-" + String.format("%06d", id);
    }

    private String resolverPrefijoFolio(Convocatoria convocatoria) {
        if (convocatoria == null) return "SOL";
        String base = convocatoria.getFolioPrefijo();
        if (base == null || base.isBlank()) {
            base = convocatoria.getArea();
        }
        if (base == null || base.isBlank()) {
            base = convocatoria.getTitulo();
        }
        String limpio = base != null
                ? base.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "")
                : "";
        if (limpio.isBlank()) return "SOL";
        return limpio.length() > 12 ? limpio.substring(0, 12) : limpio;
    }

    private boolean esEditableParaUsuario(String estado, Set<String> estadosEditables) {
        if (estado == null) return false;
        String e = estado.trim().toUpperCase(Locale.ROOT);
        if (e.isBlank()) return false;
        Set<String> permitidos = (estadosEditables == null || estadosEditables.isEmpty())
                ? Set.of("PENDIENTE", "CON_OBSERVACIONES")
                : estadosEditables;
        return permitidos.contains(e);
    }

    private void validarSolicitudListaParaSeleccion(Postulacion p, String accion) {
        String estado = p != null && p.getEstado() != null ? p.getEstado().trim().toUpperCase(Locale.ROOT) : "";
        if ("REVISADA".equals(estado) || "ACEPTADA".equals(estado) || "RECHAZADA".equals(estado)) {
            return;
        }
        if ("SUBSANADA".equals(estado)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Antes de " + accion + " debes revisar la subsanacion y marcar la solicitud como REVISADA");
        }
        if ("CON_OBSERVACIONES".equals(estado)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Antes de " + accion + " la solicitud debe ser corregida y marcada como REVISADA");
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Antes de " + accion + " la solicitud debe estar marcada como REVISADA");
    }

    private void validarVigenciaCorrecciones(Postulacion p) {
        if (p == null) return;
        String estado = p.getEstado() != null ? p.getEstado().trim().toUpperCase(Locale.ROOT) : "";
        if (!"CON_OBSERVACIONES".equals(estado)) return;
        LocalDateTime limite = p.getFechaLimiteCorreccion();
        if (limite != null && LocalDateTime.now().isAfter(limite)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El plazo para corregir esta solicitud venció el " + formatearFechaHora(limite));
        }
    }

    private int normalizarPlazoHoras(Convocatoria convocatoria, Integer horasSolicitadas) {
        Integer horasDefaultRegla = resolverEnteroReglaConvocatoria(convocatoria,
                "plazo_correccion_horas_default",
                "plazo_correccion_horas");
        Integer horasMinRegla = resolverEnteroReglaConvocatoria(convocatoria, "plazo_correccion_horas_min");
        Integer horasMaxRegla = resolverEnteroReglaConvocatoria(convocatoria, "plazo_correccion_horas_max");

        int minPermitido = horasMinRegla != null ? horasMinRegla : PLAZO_CORRECCION_HORAS_MIN;
        int maxPermitido = horasMaxRegla != null ? horasMaxRegla : PLAZO_CORRECCION_HORAS_MAX;

        minPermitido = Math.max(PLAZO_CORRECCION_HORAS_MIN, minPermitido);
        maxPermitido = Math.min(PLAZO_CORRECCION_HORAS_MAX, maxPermitido);
        if (maxPermitido < minPermitido) {
            maxPermitido = minPermitido;
        }

        int defaultHoras = horasDefaultRegla != null ? horasDefaultRegla : PLAZO_CORRECCION_HORAS_DEFAULT;
        if (defaultHoras < minPermitido || defaultHoras > maxPermitido) {
            defaultHoras = Math.min(maxPermitido, Math.max(minPermitido, defaultHoras));
        }

        int h = horasSolicitadas != null ? horasSolicitadas : defaultHoras;
        if (h < minPermitido || h > maxPermitido) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El plazo de corrección debe estar entre " + minPermitido + " y " + maxPermitido + " horas");
        }
        return h;
    }

    private String formatearFechaHora(LocalDateTime value) {
        if (value == null) return "";
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        return value.format(fmt);
    }

    private boolean fechaEventoActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "fecha_evento_activa",
                "fecha_evento_habilitada",
                "solicitar_fecha_evento"
        );
    }

    private LocalDate normalizarFechaEvento(Convocatoria convocatoria, LocalDate fechaEvento) {
        return fechaEventoActivo(convocatoria) ? fechaEvento : null;
    }

    private boolean informacionProyectoActiva(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "informacion_proyecto_activa",
                "proyecto_info_activo",
                "solicitar_informacion_proyecto"
        );
    }

    private String normalizarTituloProyecto(Convocatoria convocatoria, String value) {
        if (!informacionProyectoActiva(convocatoria)) {
            return null;
        }
        return normalizarTextoRequerido(value, "El título del proyecto es obligatorio", 220);
    }

    private String normalizarDescripcionProyecto(Convocatoria convocatoria, String value) {
        if (!informacionProyectoActiva(convocatoria)) {
            return null;
        }
        return normalizarTextoRequerido(value, "La descripción del proyecto es obligatoria", 4000);
    }

    private boolean tipoSolicitudActivo(Convocatoria convocatoria) {
        return resolverModuloActivoConvocatoria(
                convocatoria,
                true,
                "tipo_solicitud_activo",
                "tipo_solicitud_habilitado",
                "solicitar_tipo_solicitud"
        );
    }

    private String normalizarTipoSolicitud(Convocatoria convocatoria, String tipoSolicitud) {
        if (!tipoSolicitudActivo(convocatoria)) {
            return null;
        }
        String v = tipoSolicitud != null ? tipoSolicitud.trim().toUpperCase(Locale.ROOT) : "";
        if (!"NACIONAL".equals(v) && !"INTERNACIONAL".equals(v)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El tipo de solicitud debe ser NACIONAL o INTERNACIONAL");
        }
        return v;
    }

    private String normalizarResultadoEvaluacion(String resultado) {
        String v = resultado != null ? resultado.trim().toUpperCase(Locale.ROOT) : "";
        if ("APROBADA".equals(v) || "NO_APROBADA".equals(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El resultado de evaluacion debe ser APROBADA o NO_APROBADA");
    }

    private String normalizarEstadoComite(String estadoComite) {
        String v = estadoComite != null ? estadoComite.trim().toUpperCase(Locale.ROOT) : "";
        if ("APROBADA".equals(v) || "RECHAZADA".equals(v) || "PENDIENTE".equals(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El estado de comite debe ser APROBADA, RECHAZADA o PENDIENTE");
    }

    private String normalizarEstadoCotejo(String estadoCotejo) {
        String v = estadoCotejo != null ? estadoCotejo.trim().toUpperCase(Locale.ROOT) : "";
        if ("APROBADA".equals(v) || "CON_OBSERVACIONES".equals(v) || "PENDIENTE".equals(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El estado de cotejo debe ser APROBADA, CON_OBSERVACIONES o PENDIENTE");
    }

    private String normalizarEstadoRenuncia(String estadoRenuncia) {
        String v = estadoRenuncia != null ? estadoRenuncia.trim().toUpperCase(Locale.ROOT) : "";
        if ("ACEPTADA".equals(v) || "RECHAZADA".equals(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El estado de renuncia debe ser ACEPTADA o RECHAZADA");
    }

    private String normalizarEstadoReciboPago(String estadoReciboPago) {
        String v = estadoReciboPago != null ? estadoReciboPago.trim().toUpperCase(Locale.ROOT) : "";
        if ("RECIBO_VALIDADO".equals(v) || "RECIBO_RECHAZADO".equals(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El estado del recibo debe ser RECIBO_VALIDADO o RECIBO_RECHAZADO");
    }

    private String normalizarEstadoSeguroMedico(String estadoSeguroMedico) {
        String v = estadoSeguroMedico != null ? estadoSeguroMedico.trim().toUpperCase(Locale.ROOT) : "";
        if (Set.of("PENDIENTE", "SOLICITADO", "ENTREGADO", "VALIDADO", "NO_APLICA").contains(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El estado de seguro médico debe ser PENDIENTE, SOLICITADO, ENTREGADO, VALIDADO o NO_APLICA");
    }

    private String normalizarEstadoStatusAcademico(String estadoStatusAcademico) {
        String v = estadoStatusAcademico != null ? estadoStatusAcademico.trim().toUpperCase(Locale.ROOT) : "";
        if (Set.of("PENDIENTE", "SOLICITADO", "ACTUALIZADO", "VALIDADO", "OBSERVADO", "NO_APLICA").contains(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El estado académico debe ser PENDIENTE, SOLICITADO, ACTUALIZADO, VALIDADO, OBSERVADO o NO_APLICA");
    }

    private String normalizarEstadoConstanciaFinal(String estadoConstanciaFinal) {
        String v = estadoConstanciaFinal != null ? estadoConstanciaFinal.trim().toUpperCase(Locale.ROOT) : "";
        if (Set.of("PENDIENTE", "EN_PROCESO", "CONSTANCIA_EMITIDA", "CARTA_EMITIDA", "COMPLETO", "NO_APLICA").contains(v)) {
            return v;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "El estado de constancias debe ser PENDIENTE, EN_PROCESO, CONSTANCIA_EMITIDA, CARTA_EMITIDA, COMPLETO o NO_APLICA");
    }

    private void validarReciboArchivo(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Debes adjuntar el recibo de pago");
        }
        if (!esPdf(archivo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El recibo de pago debe ser un PDF");
        }
        validarLimitePdf(archivo, "postulacion.reciboPago", "El recibo de pago");
    }

    private boolean puedeSolicitarRenuncia(Postulacion p) {
        if (p == null) return false;
        String estado = p.getEstado() != null ? p.getEstado().trim().toUpperCase(Locale.ROOT) : "";
        String estadoComite = p.getEstadoComite() != null ? p.getEstadoComite().trim().toUpperCase(Locale.ROOT) : "";
        boolean aprobada = "ACEPTADA".equals(estado) || "APROBADA".equals(estadoComite);
        if (!aprobada) return false;
        String estadoRenuncia = p.getEstadoRenuncia() != null ? p.getEstadoRenuncia().trim().toUpperCase(Locale.ROOT) : "";
        return !"ACEPTADA".equals(estadoRenuncia);
    }

    private boolean puedeCapturarBancaria(Postulacion p) {
        if (p == null) return false;
        String estadoRenuncia = p.getEstadoRenuncia() != null ? p.getEstadoRenuncia().trim().toUpperCase(Locale.ROOT) : "";
        if ("SOLICITADA".equals(estadoRenuncia) || "ACEPTADA".equals(estadoRenuncia)) return false;
        String estadoComite = p.getEstadoComite() != null ? p.getEstadoComite().trim().toUpperCase(Locale.ROOT) : "";
        if ("APROBADA".equals(estadoComite)) return true;
        String estado = p.getEstado() != null ? p.getEstado().trim().toUpperCase(Locale.ROOT) : "";
        return "ACEPTADA".equals(estado);
    }

    private boolean puedeGestionarInformes(Postulacion p) {
        if (!puedeCapturarBancaria(p)) return false;
        return resolverTipoInformesRequeridos(p != null ? p.getConvocatoria() : null) != TipoInformesRequeridos.NINGUNO;
    }

    private boolean requiereInformeParcial(Postulacion p) {
        TipoInformesRequeridos tipo = resolverTipoInformesRequeridos(p != null ? p.getConvocatoria() : null);
        return tipo == TipoInformesRequeridos.PARCIAL || tipo == TipoInformesRequeridos.AMBOS;
    }

    private boolean requiereInformeFinal(Postulacion p) {
        TipoInformesRequeridos tipo = resolverTipoInformesRequeridos(p != null ? p.getConvocatoria() : null);
        return tipo == TipoInformesRequeridos.FINAL || tipo == TipoInformesRequeridos.AMBOS;
    }

    private TipoInformesRequeridos resolverTipoInformesRequeridos(Convocatoria convocatoria) {
        List<ReglaConfigurableConvocatoria> reglas = parseReglasConfigurables(convocatoria != null ? convocatoria.getReglasConfigurables() : null);
        if (reglas.isEmpty()) return TipoInformesRequeridos.AMBOS;

        ReglaConfigurableConvocatoria reglaTipo = buscarRegla(
                reglas,
                "informes_requeridos",
                "tipo_informes_requeridos",
                "cantidad_informes_requeridos"
        );
        if (reglaTipo != null && reglaTipo.valor() != null && !reglaTipo.valor().trim().isBlank()) {
            return resolverTipoInformesDesdeValor(reglaTipo.valor().trim());
        }

        ReglaConfigurableConvocatoria reglaParcial = buscarRegla(reglas, "requiere_informe_parcial", "informe_parcial_requerido");
        ReglaConfigurableConvocatoria reglaFinal = buscarRegla(reglas, "requiere_informe_final", "informe_final_requerido");
        if (reglaParcial == null && reglaFinal == null) {
            return TipoInformesRequeridos.AMBOS;
        }
        boolean requiereParcial = reglaParcial != null && resolverBooleano(reglaParcial.valor(), false);
        boolean requiereFinal = reglaFinal != null && resolverBooleano(reglaFinal.valor(), false);
        if (requiereParcial && requiereFinal) return TipoInformesRequeridos.AMBOS;
        if (requiereParcial) return TipoInformesRequeridos.PARCIAL;
        if (requiereFinal) return TipoInformesRequeridos.FINAL;
        return TipoInformesRequeridos.NINGUNO;
    }

    private ReglaConfigurableConvocatoria buscarRegla(List<ReglaConfigurableConvocatoria> reglas, String... claves) {
        if (reglas == null || reglas.isEmpty() || claves == null || claves.length == 0) return null;
        Set<String> buscadas = new LinkedHashSet<>();
        for (String k : claves) {
            String normalizada = normalizarClaveRegla(k);
            if (!normalizada.isBlank()) buscadas.add(normalizada);
        }
        if (buscadas.isEmpty()) return null;
        for (ReglaConfigurableConvocatoria regla : reglas) {
            String key = normalizarClaveRegla(regla != null ? regla.clave() : null);
            if (!key.isBlank() && buscadas.contains(key)) {
                return regla;
            }
        }
        return null;
    }

    private TipoInformesRequeridos resolverTipoInformesDesdeValor(String raw) {
        String valor = raw != null ? raw.trim().toLowerCase(Locale.ROOT) : "";
        if (valor.isBlank()) return TipoInformesRequeridos.AMBOS;
        String normalizado = java.text.Normalizer.normalize(valor, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('-', '_')
                .replace(' ', '_');
        return switch (normalizado) {
            case "ninguno", "sin_informes", "no_aplica", "no", "0" -> TipoInformesRequeridos.NINGUNO;
            case "parcial", "solo_parcial", "1" -> TipoInformesRequeridos.PARCIAL;
            case "final", "solo_final" -> TipoInformesRequeridos.FINAL;
            case "ambos", "parcial_y_final", "2", "todos" -> TipoInformesRequeridos.AMBOS;
            default -> {
                log.warn("Valor de informes_requeridos no reconocido: {}. Se usa AMBOS por compatibilidad.", raw);
                yield TipoInformesRequeridos.AMBOS;
            }
        };
    }

    private void actualizarEstadoInformeSegunRequisitos(Postulacion p, boolean conservarIncumplido) {
        if (p == null) return;
        if (conservarIncumplido && "INCUMPLIDO".equalsIgnoreCase(p.getEstadoInforme())) return;
        p.setEstadoInforme(calcularEstadoInformeSegunRequisitos(p));
    }

    private String calcularEstadoInformeSegunRequisitos(Postulacion p) {
        if (p == null) return null;
        TipoInformesRequeridos tipo = resolverTipoInformesRequeridos(p.getConvocatoria());
        boolean parcial = p.getInformeParcialDocumento() != null;
        boolean fin = p.getInformeFinalDocumento() != null;
        return switch (tipo) {
            case NINGUNO -> "NO_REQUIERE";
            case PARCIAL -> parcial ? "COMPLETO" : "PENDIENTE";
            case FINAL -> fin ? "COMPLETO" : "PENDIENTE";
            case AMBOS -> {
                if (parcial && fin) yield "COMPLETO";
                if (parcial || fin) yield "PARCIAL_RECIBIDO";
                yield "PENDIENTE";
            }
        };
    }

    private Postulacion obtenerPostulacionDeUsuario(Long postulacionId, Long authUserId) {
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        Postulacion p = postulacionRepo.findByIdWithCurriculum(postulacionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postulacion no encontrada"));
        if (p.getUsuario() == null || !usuario.getId().equals(p.getUsuario().getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "No puedes editar esta postulacion");
        }
        return p;
    }

    private void validarVentanaInformeParcial(Postulacion p) {
        if (p.getFechaLimiteInformeParcial() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Aun no se ha configurado la fecha limite del informe parcial");
        }
        if (LocalDate.now().isAfter(p.getFechaLimiteInformeParcial())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha limite del informe parcial ya vencio");
        }
    }

    private void validarVentanaInformeFinal(Postulacion p) {
        if (p.getFechaLimiteInformeFinal() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Aun no se ha configurado la fecha limite del informe final");
        }
        if (LocalDate.now().isAfter(p.getFechaLimiteInformeFinal())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha limite del informe final ya vencio");
        }
    }

    private boolean actualizarIncumplimientoInformesSiAplica(Postulacion p) {
        if (p == null || !puedeGestionarInformes(p)) return false;
        if ("COMPLETO".equalsIgnoreCase(p.getEstadoInforme())) return false;
        if ("INCUMPLIDO".equalsIgnoreCase(p.getEstadoInforme())) return false;

        TipoInformesRequeridos tipo = resolverTipoInformesRequeridos(p.getConvocatoria());
        boolean requiereParcial = tipo == TipoInformesRequeridos.PARCIAL || tipo == TipoInformesRequeridos.AMBOS;
        boolean requiereFinal = tipo == TipoInformesRequeridos.FINAL || tipo == TipoInformesRequeridos.AMBOS;
        if (!requiereParcial && !requiereFinal) return false;

        LocalDate hoy = LocalDate.now();
        boolean vencioFinal = requiereFinal
                && p.getFechaLimiteInformeFinal() != null
                && hoy.isAfter(p.getFechaLimiteInformeFinal())
                && p.getInformeFinalDocumento() == null;
        boolean vencioParcial = requiereParcial
                && p.getFechaLimiteInformeParcial() != null
                && hoy.isAfter(p.getFechaLimiteInformeParcial())
                && p.getInformeParcialDocumento() == null;
        if (!vencioFinal && !vencioParcial) return false;

        String motivo;
        if (vencioFinal && vencioParcial) {
            motivo = "Incumplimiento de fecha limite de informe parcial y final";
        } else if (vencioFinal) {
            motivo = "Incumplimiento de fecha limite del informe final";
        } else {
            motivo = "Incumplimiento de fecha limite del informe parcial";
        }
        aplicarIncumplimientoInformes(p, motivo);
        return true;
    }

    private void aplicarIncumplimientoInformes(Postulacion p, String motivo) {
        if (p == null) return;
        p.setEstadoInforme("INCUMPLIDO");
        p.setMotivoIncumplimientoInforme(motivo);
        p.setEstado("CANCELADA");
        try {
            notificacionService.crear(
                    p.getUsuario() != null ? p.getUsuario().getAuthUser() : null,
                    "Incumplimiento de informes",
                    "Tu solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " fue cancelada por incumplimiento de informes.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/app/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion de incumplimiento de informes: {}", e.getMessage());
        }
        try {
            notificacionService.crearParaAdmins(
                    "Solicitud cancelada por incumplimiento",
                    "La solicitud " + (p.getFolio() != null ? p.getFolio() : "#" + p.getId()) + " fue cancelada por incumplimiento de informes.",
                    Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificacion admin de incumplimiento de informes: {}", e.getMessage());
        }
    }

    private String normalizarTextoOpcional(String value, int maxLen) {
        String limpio = value != null ? value.trim() : "";
        if (limpio.isBlank()) return null;
        return limpio.length() > maxLen ? limpio.substring(0, maxLen) : limpio;
    }

    private String normalizarCuenta(String value) {
        String limpio = value != null ? value.replaceAll("\\s+", "").trim() : "";
        if (limpio.isBlank()) return null;
        if (!limpio.matches("^[0-9]{8,34}$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La cuenta bancaria debe contener entre 8 y 34 digitos");
        }
        return limpio;
    }

    private String normalizarClabe(String value) {
        String limpio = value != null ? value.replaceAll("\\s+", "").trim() : "";
        if (limpio.isBlank()) return null;
        if (!limpio.matches("^[0-9]{18}$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La CLABE debe tener 18 digitos");
        }
        return limpio;
    }

    private Integer obtenerPuntajeMaximoEvaluacion(Postulacion p) {
        if (p == null || p.getConvocatoria() == null) {
            return 100;
        }
        Convocatoria convocatoria = p.getConvocatoria();
        if (Boolean.FALSE.equals(convocatoria.getPuntajeMaximoEvaluacionHabilitado())) {
            return null;
        }
        Integer max = convocatoria.getPuntajeMaximoEvaluacion();
        if (max == null || max <= 0) return 100;
        return max;
    }

    private String normalizarTextoRequerido(String value, String msg, int maxLen) {
        String limpio = value != null ? value.trim() : "";
        if (limpio.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, msg);
        }
        return limpio.length() > maxLen ? limpio.substring(0, maxLen) : limpio;
    }

    private void validarCandadosYFechas(Convocatoria convocatoria, LocalDate fechaEvento) {
        if (convocatoria == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Convocatoria inválida");
        }
        if (!convocatoria.isVigente()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La convocatoria no está vigente");
        }
        LocalDate hoy = LocalDate.now();
        LocalDateTime ahora = LocalDateTime.now();
        if (convocatoria.getFechaApertura() != null && ahora.isBefore(convocatoria.getFechaApertura())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La convocatoria aún no abre");
        }
        if (convocatoria.getFechaCierre() != null && ahora.isAfter(convocatoria.getFechaCierre())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La convocatoria ya cerró; la solicitud está bloqueada por fechas");
        }
        if (!fechaEventoActivo(convocatoria)) {
            return;
        }
        if (fechaEvento == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha del evento es obligatoria");
        }
        long diasAnticipacion = feriadoService.diasNaturalesSinFeriados(hoy, fechaEvento);
        boolean validarMin = !Boolean.FALSE.equals(convocatoria.getDiasMinAnticipacionHabilitado());
        boolean validarMax = !Boolean.FALSE.equals(convocatoria.getDiasMaxAnticipacionHabilitado());
        int diasMin = convocatoria.getDiasMinAnticipacion() != null ? Math.max(0, convocatoria.getDiasMinAnticipacion()) : 20;
        int diasMax = convocatoria.getDiasMaxAnticipacion() != null
                ? (validarMin ? Math.max(diasMin, convocatoria.getDiasMaxAnticipacion()) : Math.max(0, convocatoria.getDiasMaxAnticipacion()))
                : 60;
        if (validarMin && diasAnticipacion < diasMin) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha del evento debe tener al menos " + diasMin + " días hábiles de anticipación (excluyendo feriados configurados)");
        }
        if (validarMax && diasAnticipacion > diasMax) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha del evento no puede exceder " + diasMax + " días hábiles de anticipación (excluyendo feriados configurados)");
        }
    }

    private Map<String, Object> toDetalleMap(Postulacion p) {
        Map<String, Object> m = toResumenMap(p);
        m.put("cedula", p.getCedula());
        m.put("curp", p.getCurp());
        m.put("correo", p.getCorreo());
        m.put("telefono", p.getTelefono());
        m.put("observaciones", p.getObservaciones());
        m.put("observacionesRevision", p.getObservacionesRevision());
        m.put("fechaRevision", p.getFechaRevision() != null ? p.getFechaRevision().toString() : null);
        m.put("fechaLimiteCorreccion", p.getFechaLimiteCorreccion() != null ? p.getFechaLimiteCorreccion().toString() : null);
        m.put("descripcionProyecto", p.getDescripcionProyecto());
        m.put("criteriosJson", p.getCriteriosJson());
        m.put("estadoSeguroMedico", p.getEstadoSeguroMedico());
        m.put("fechaSeguroMedico", p.getFechaSeguroMedico() != null ? p.getFechaSeguroMedico().toString() : null);
        m.put("numeroSeguroMedico", p.getNumeroSeguroMedico());
        m.put("seguroMedicoDocumentoId", p.getSeguroMedicoDocumento() != null ? p.getSeguroMedicoDocumento().getId() : null);
        m.put("seguroMedicoNombreArchivo", p.getSeguroMedicoDocumento() != null ? p.getSeguroMedicoDocumento().getNombreArchivo() : null);
        m.put("observacionesSeguroMedico", p.getObservacionesSeguroMedico());
        m.put("estadoStatusAcademico", p.getEstadoStatusAcademico());
        m.put("fechaStatusAcademico", p.getFechaStatusAcademico() != null ? p.getFechaStatusAcademico().toString() : null);
        m.put("observacionesStatusAcademico", p.getObservacionesStatusAcademico());
        m.put("informacionStatusAcademico", p.getInformacionStatusAcademico());
        m.put("statusAcademicoDocumentoId", p.getStatusAcademicoDocumento() != null ? p.getStatusAcademicoDocumento().getId() : null);
        m.put("statusAcademicoNombreArchivo", p.getStatusAcademicoDocumento() != null ? p.getStatusAcademicoDocumento().getNombreArchivo() : null);
        m.put("curriculumDocumentoId", p.getCurriculumDocumento() != null ? p.getCurriculumDocumento().getId() : null);
        m.put("curriculumNombreArchivo", p.getCurriculumDocumento() != null ? p.getCurriculumDocumento().getNombreArchivo() : null);
        m.put("documentosAdjuntos", listarDocumentosAdjuntos(p.getId()));
        return m;
    }

    public List<Map<String, Object>> listarDocumentosAdjuntos(Long postulacionId) {
        return postulacionDocumentoRepo.findByPostulacionIdWithDocumento(postulacionId).stream()
                .map(pd -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("clave", pd.getClave());
                    m.put("documentoId", pd.getDocumento().getId());
                    m.put("nombreArchivo", pd.getDocumento().getNombreArchivo());
                    return m;
                })
                .toList();
    }
}


































