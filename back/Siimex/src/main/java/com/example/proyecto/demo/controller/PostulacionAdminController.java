package com.example.proyecto.demo.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Postulacion;
import com.example.proyecto.demo.exception.ApiException;
import com.example.proyecto.demo.Service.DocumentoService;
import com.example.proyecto.demo.Service.PostulacionService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/admin/convocatorias/{convocatoriaId}/postulaciones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PostulacionAdminController {

    private final PostulacionService postulacionService;
    private final DocumentoService documentoService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listar(@PathVariable Long convocatoriaId) {
        List<Postulacion> lista = postulacionService.listarPorConvocatoria(convocatoriaId);
        List<Map<String, Object>> items = lista.stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("usuarioId", p.getUsuario() != null ? p.getUsuario().getId() : null);
            Long fotoId = p.getUsuario() != null
                    ? documentoService.obtenerDocumentoPorUsuarioYTipo(p.getUsuario().getId(), Documento.TipoDocumento.FOTO_PERFIL)
                            .map(Documento::getId).orElse(null)
                    : null;
            m.put("fotoDocumentoId", fotoId);
            m.put("cedula", p.getCedula());
            m.put("curp", p.getCurp());
            m.put("correo", p.getCorreo());
            m.put("telefono", p.getTelefono());
            m.put("folio", p.getFolio());
            m.put("tipoApoyo", p.getTipoApoyo());
            m.put("tipoSolicitud", p.getTipoSolicitud());
            m.put("fechaEvento", p.getFechaEvento() != null ? p.getFechaEvento().toString() : null);
            m.put("tituloProyecto", p.getTituloProyecto());
            m.put("descripcionProyecto", p.getDescripcionProyecto());
            m.put("observaciones", p.getObservaciones());
            m.put("observacionesRevision", p.getObservacionesRevision());
            m.put("fechaRevision", p.getFechaRevision() != null ? p.getFechaRevision().toString() : null);
            m.put("fechaLimiteCorreccion", p.getFechaLimiteCorreccion() != null ? p.getFechaLimiteCorreccion().toString() : null);
            m.put("evaluadorEmail", p.getEvaluadorEmail());
            m.put("fechaAsignacionEvaluador", p.getFechaAsignacionEvaluador() != null ? p.getFechaAsignacionEvaluador().toString() : null);
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
            m.put("medioNotificacion", p.getMedioNotificacion());
            m.put("fechaActualizacionBancaria", p.getFechaActualizacionBancaria() != null ? p.getFechaActualizacionBancaria().toString() : null);
            m.put("estadoEntregaApoyo", p.getEstadoEntregaApoyo());
            m.put("fechaEntregaApoyo", p.getFechaEntregaApoyo() != null ? p.getFechaEntregaApoyo().toString() : null);
            m.put("observacionesEntregaApoyo", p.getObservacionesEntregaApoyo());
            m.put("estadoCotejo", p.getEstadoCotejo());
            m.put("observacionesCotejo", p.getObservacionesCotejo());
            m.put("fechaCotejo", p.getFechaCotejo() != null ? p.getFechaCotejo().toString() : null);
            m.put("estadoInforme", p.getEstadoInforme());
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
            m.put("criteriosJson", p.getCriteriosJson());
            m.put("fechaCreacion", p.getFechaCreacion() != null ? p.getFechaCreacion().toString() : null);
            m.put("estado", p.getEstado());
            m.put("nombre", p.getUsuario() != null
                    ? ((p.getUsuario().getNombre() != null ? p.getUsuario().getNombre() : "") + " " +
                    (p.getUsuario().getApellidoPaterno() != null ? p.getUsuario().getApellidoPaterno() : "")).trim()
                    : "");
            m.put("compatibilidad", postulacionService.calcularCompatibilidad(p));
            m.put("tieneCurriculum", p.getCurriculumDocumento() != null);
            m.put("curriculumDocumentoId", p.getCurriculumDocumento() != null ? p.getCurriculumDocumento().getId() : null);
            m.put("curriculumNombreArchivo", p.getCurriculumDocumento() != null ? p.getCurriculumDocumento().getNombreArchivo() : null);
            m.put("documentosAdjuntos", postulacionService.listarDocumentosAdjuntos(p.getId()));
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(items);
    }

    @GetMapping("/evaluadores-disponibles")
    public ResponseEntity<List<Map<String, Object>>> listarEvaluadoresDisponibles(@PathVariable Long convocatoriaId) {
        return ResponseEntity.ok(postulacionService.listarEvaluadoresDisponibles(convocatoriaId));
    }

    @PostMapping("/{postulacionId}/aceptar")
    public ResponseEntity<Map<String, Object>> aceptar(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId) {
        Postulacion p = postulacionService.aceptar(postulacionId);
        return ResponseEntity.ok(Map.of(
                "id", p.getId(),
                "estado", p.getEstado(),
                "message", "Postulación aceptada y correo enviado"
        ));
    }

    @PostMapping("/{postulacionId}/rechazar")
    public ResponseEntity<Map<String, Object>> rechazar(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody(required = false) Map<String, String> body) {
        String motivo = body != null ? body.get("motivo") : null;
        Postulacion p = postulacionService.rechazar(postulacionId, motivo);
        return ResponseEntity.ok(Map.of(
                "id", p.getId(),
                "estado", p.getEstado(),
                "message", "Postulación rechazada y correo enviado"
        ));
    }

    @PostMapping("/{postulacionId}/observaciones")
    public ResponseEntity<Map<String, Object>> observaciones(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body) {
        String observaciones = body != null && body.get("observaciones") != null
                ? String.valueOf(body.get("observaciones"))
                : null;
        Integer plazoHoras = null;
        if (body != null && body.get("plazoHoras") != null) {
            try {
                Object raw = body.get("plazoHoras");
                plazoHoras = Integer.parseInt(String.valueOf(raw));
            } catch (Exception ignored) {
                plazoHoras = null;
            }
        }
        Postulacion p = postulacionService.marcarConObservaciones(postulacionId, observaciones, plazoHoras);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estado", p.getEstado());
        response.put("fechaLimiteCorreccion", p.getFechaLimiteCorreccion() != null ? p.getFechaLimiteCorreccion().toString() : null);
        response.put("message", "Solicitud marcada con observaciones");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/oficio-aprobacion")
    public ResponseEntity<Map<String, Object>> emitirOficioAprobacion(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId) {
        Postulacion p = postulacionService.emitirOficioAprobacion(postulacionId);
        return ResponseEntity.ok(Map.of(
                "id", p.getId(),
                "oficioAprobacionDocumentoId", p.getOficioAprobacionDocumento() != null ? p.getOficioAprobacionDocumento().getId() : null,
                "fechaOficioAprobacion", p.getFechaOficioAprobacion() != null ? p.getFechaOficioAprobacion().toString() : null,
                "message", "Oficio de aprobacion emitido"
        ));
    }

    @PostMapping("/{postulacionId}/nombramiento")
    public ResponseEntity<Map<String, Object>> emitirNombramiento(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId) {
        Postulacion p = postulacionService.emitirNombramiento(postulacionId);
        return ResponseEntity.ok(Map.of(
                "id", p.getId(),
                "nombramientoDocumentoId", p.getNombramientoDocumento() != null ? p.getNombramientoDocumento().getId() : null,
                "fechaNombramiento", p.getFechaNombramiento() != null ? p.getFechaNombramiento().toString() : null,
                "message", "Nombramiento emitido"
        ));
    }

    @PostMapping("/{postulacionId}/revisar")
    public ResponseEntity<Map<String, Object>> revisar(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId) {
        Postulacion p = postulacionService.marcarRevisada(postulacionId);
        return ResponseEntity.ok(Map.of(
                "id", p.getId(),
                "estado", p.getEstado(),
                "message", "Solicitud marcada como revisada"
        ));
    }

    @RequestMapping(value = "/{postulacionId}/pendiente", method = {RequestMethod.POST, RequestMethod.PATCH})
    public ResponseEntity<Map<String, Object>> pendiente(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId) {
        Postulacion p = postulacionService.marcarPendiente(postulacionId);
        return ResponseEntity.ok(Map.of(
                "id", p.getId(),
                "estado", p.getEstado(),
                "message", "Solicitud regresada a pendiente"
        ));
    }

    @PostMapping("/{postulacionId}/asignar-evaluador")
    public ResponseEntity<Map<String, Object>> asignarEvaluador(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, String> body) {
        String email = body != null ? body.get("email") : null;
        Postulacion p = postulacionService.asignarEvaluador(postulacionId, email);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("evaluadorEmail", p.getEvaluadorEmail());
        response.put("cartaEvaluadorDocumentoId", p.getCartaEvaluadorDocumento() != null ? p.getCartaEvaluadorDocumento().getId() : null);
        response.put("message", "Evaluador asignado correctamente");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/evaluacion")
    public ResponseEntity<Map<String, Object>> registrarEvaluacion(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body,
            org.springframework.security.core.Authentication auth) {
        Long authUserId = auth != null && auth.getPrincipal() instanceof Long ? (Long) auth.getPrincipal() : null;
        if (authUserId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "No autenticado"));
        }
        String resultado = body != null && body.get("resultado") != null ? String.valueOf(body.get("resultado")) : null;
        Integer puntaje = null;
        if (body != null && body.get("puntaje") != null) {
            try {
                puntaje = Integer.parseInt(String.valueOf(body.get("puntaje")));
            } catch (Exception ignored) {
                puntaje = null;
            }
        }
        String comentarios = body != null && body.get("comentarios") != null ? String.valueOf(body.get("comentarios")) : null;
        Postulacion p = postulacionService.registrarEvaluacion(postulacionId, authUserId, true, resultado, puntaje, comentarios);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("resultadoEvaluacion", p.getResultadoEvaluacion());
        response.put("puntajeEvaluacion", p.getPuntajeEvaluacion());
        response.put("comentariosEvaluacion", p.getComentariosEvaluacion());
        response.put("fechaEvaluacion", p.getFechaEvaluacion() != null ? p.getFechaEvaluacion().toString() : null);
        response.put("dictamenEvaluacionDocumentoId", p.getDictamenEvaluacionDocumento() != null ? p.getDictamenEvaluacionDocumento().getId() : null);
        response.put("constanciaEvaluadorDocumentoId", p.getConstanciaEvaluadorDocumento() != null ? p.getConstanciaEvaluadorDocumento().getId() : null);
        response.put("message", "Evaluacion registrada");
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/{postulacionId}/evaluacion/documento-firmado", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirDocumentoEvaluacionFirmado(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestParam("tipo") String tipo,
            @RequestPart("file") MultipartFile file,
            Authentication auth) {
        Long authUserId = auth != null && auth.getPrincipal() instanceof Long ? (Long) auth.getPrincipal() : null;
        if (authUserId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "No autenticado"));
        }
        try {
            Map<String, Object> data = postulacionService.subirDocumentoEvaluacionFirmado(
                    postulacionId,
                    authUserId,
                    true,
                    tipo,
                    file
            );
            Map<String, Object> response = new HashMap<>(data);
            response.put("message", "Documento firmado cargado correctamente");
            return ResponseEntity.ok(response);
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus()).body(Map.of(
                    "message",
                    e.getMessage() != null ? e.getMessage() : "No se pudo cargar el documento firmado"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    e.getMessage() != null ? e.getMessage() : "No se pudo cargar el documento firmado"));
        }
    }

    @PostMapping("/{postulacionId}/comite")
    public ResponseEntity<Map<String, Object>> registrarComite(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body) {
        String estadoComite = body != null && body.get("estadoComite") != null ? String.valueOf(body.get("estadoComite")) : null;
        String observacionesComite = body != null && body.get("observacionesComite") != null ? String.valueOf(body.get("observacionesComite")) : null;
        java.math.BigDecimal monto = null;
        if (body != null && body.get("montoApoyoAsignado") != null && !String.valueOf(body.get("montoApoyoAsignado")).trim().isBlank()) {
            try {
                monto = new java.math.BigDecimal(String.valueOf(body.get("montoApoyoAsignado")).trim());
            } catch (Exception ignored) {
                monto = null;
            }
        }
        Postulacion p = postulacionService.registrarDecisionComite(postulacionId, estadoComite, monto, observacionesComite);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estadoComite", p.getEstadoComite());
        response.put("montoApoyoAsignado", p.getMontoApoyoAsignado());
        response.put("observacionesComite", p.getObservacionesComite());
        response.put("fechaComite", p.getFechaComite() != null ? p.getFechaComite().toString() : null);
        response.put("estado", p.getEstado());
        response.put("message", "Decision de comite registrada");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/comite/listas")
    public ResponseEntity<Map<String, Object>> listarComite(
            @PathVariable Long convocatoriaId,
            @RequestParam(name = "estadoComite", required = false) String estadoComite) {
        if (!postulacionService.moduloComiteActivoPorConvocatoria(convocatoriaId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Esta convocatoria no tiene activo el módulo de comité",
                    "convocatoriaId", convocatoriaId,
                    "registros", List.of()
            ));
        }
        String filtroEstado = estadoComite != null ? estadoComite.trim().toUpperCase(java.util.Locale.ROOT) : "";
        List<Postulacion> lista = postulacionService.listarPorConvocatoria(convocatoriaId);

        List<Map<String, Object>> registros = lista.stream()
                .filter(p -> !filtroEstado.isBlank() ? filtroEstado.equalsIgnoreCase(p.getEstadoComite()) : true)
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", p.getId());
                    m.put("folio", p.getFolio());
                    m.put("nombre", p.getUsuario() != null
                            ? ((p.getUsuario().getNombre() != null ? p.getUsuario().getNombre() : "") + " " +
                            (p.getUsuario().getApellidoPaterno() != null ? p.getUsuario().getApellidoPaterno() : "")).trim()
                            : "");
                    m.put("correo", p.getCorreo());
                    m.put("estado", p.getEstado());
                    m.put("resultadoEvaluacion", p.getResultadoEvaluacion());
                    m.put("puntajeEvaluacion", p.getPuntajeEvaluacion());
                    m.put("estadoComite", p.getEstadoComite());
                    m.put("montoApoyoAsignado", p.getMontoApoyoAsignado());
                    m.put("observacionesComite", p.getObservacionesComite());
                    m.put("fechaComite", p.getFechaComite() != null ? p.getFechaComite().toString() : null);
                    return m;
                })
                .toList();

        long total = registros.size();
        long aprobadas = registros.stream().filter(r -> "APROBADA".equalsIgnoreCase(String.valueOf(r.get("estadoComite")))).count();
        long rechazadas = registros.stream().filter(r -> "RECHAZADA".equalsIgnoreCase(String.valueOf(r.get("estadoComite")))).count();
        long pendientes = registros.stream().filter(r -> "PENDIENTE".equalsIgnoreCase(String.valueOf(r.get("estadoComite"))) || r.get("estadoComite") == null).count();
        List<Map<String, Object>> registrosAprobados = registros.stream()
                .filter(r -> "APROBADA".equalsIgnoreCase(String.valueOf(r.get("estadoComite"))))
                .toList();
        List<Map<String, Object>> registrosRechazados = registros.stream()
                .filter(r -> "RECHAZADA".equalsIgnoreCase(String.valueOf(r.get("estadoComite"))))
                .toList();
        List<Map<String, Object>> registrosPendientes = registros.stream()
                .filter(r -> "PENDIENTE".equalsIgnoreCase(String.valueOf(r.get("estadoComite"))) || r.get("estadoComite") == null)
                .toList();

        java.math.BigDecimal montoTotalAprobado = registros.stream()
                .map(r -> r.get("montoApoyoAsignado"))
                .filter(java.util.Objects::nonNull)
                .map(v -> {
                    try {
                        return new java.math.BigDecimal(String.valueOf(v));
                    } catch (Exception ex) {
                        return java.math.BigDecimal.ZERO;
                    }
                })
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        Map<String, Object> response = new HashMap<>();
        response.put("convocatoriaId", convocatoriaId);
        response.put("total", total);
        response.put("aprobadas", aprobadas);
        response.put("rechazadas", rechazadas);
        response.put("pendientes", pendientes);
        response.put("montoTotalAprobado", montoTotalAprobado);
        response.put("registrosAprobados", registrosAprobados);
        response.put("registrosRechazados", registrosRechazados);
        response.put("registrosPendientes", registrosPendientes);
        response.put("registros", registros);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/renuncias")
    public ResponseEntity<Map<String, Object>> listarRenuncias(
            @PathVariable Long convocatoriaId,
            @RequestParam(name = "estadoRenuncia", required = false) String estadoRenuncia) {
        if (!postulacionService.moduloRenunciaActivoPorConvocatoria(convocatoriaId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Esta convocatoria no tiene activo el módulo de renuncia",
                    "convocatoriaId", convocatoriaId,
                    "registros", List.of()
            ));
        }
        String filtroEstado = estadoRenuncia != null ? estadoRenuncia.trim().toUpperCase(java.util.Locale.ROOT) : "";
        List<Postulacion> lista = postulacionService.listarPorConvocatoria(convocatoriaId);

        List<Map<String, Object>> registros = lista.stream()
                .filter(p -> p.getEstadoRenuncia() != null && !p.getEstadoRenuncia().isBlank())
                .filter(p -> filtroEstado.isBlank() || filtroEstado.equalsIgnoreCase(p.getEstadoRenuncia()))
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", p.getId());
                    m.put("folio", p.getFolio());
                    m.put("nombre", p.getUsuario() != null
                            ? ((p.getUsuario().getNombre() != null ? p.getUsuario().getNombre() : "") + " " +
                            (p.getUsuario().getApellidoPaterno() != null ? p.getUsuario().getApellidoPaterno() : "")).trim()
                            : "");
                    m.put("correo", p.getCorreo());
                    m.put("estado", p.getEstado());
                    m.put("estadoRenuncia", p.getEstadoRenuncia());
                    m.put("motivoRenuncia", p.getMotivoRenuncia());
                    m.put("fechaSolicitudRenuncia", p.getFechaSolicitudRenuncia() != null ? p.getFechaSolicitudRenuncia().toString() : null);
                    m.put("fechaResolucionRenuncia", p.getFechaResolucionRenuncia() != null ? p.getFechaResolucionRenuncia().toString() : null);
                    m.put("observacionesRenuncia", p.getObservacionesRenuncia());
                    m.put("montoApoyoAsignado", p.getMontoApoyoAsignado());
                    m.put("estadoComite", p.getEstadoComite());
                    return m;
                })
                .toList();

        long total = registros.size();
        long solicitadas = registros.stream().filter(r -> "SOLICITADA".equalsIgnoreCase(String.valueOf(r.get("estadoRenuncia")))).count();
        long aceptadas = registros.stream().filter(r -> "ACEPTADA".equalsIgnoreCase(String.valueOf(r.get("estadoRenuncia")))).count();
        long rechazadas = registros.stream().filter(r -> "RECHAZADA".equalsIgnoreCase(String.valueOf(r.get("estadoRenuncia")))).count();

        Map<String, Object> response = new HashMap<>();
        response.put("convocatoriaId", convocatoriaId);
        response.put("total", total);
        response.put("solicitadas", solicitadas);
        response.put("aceptadas", aceptadas);
        response.put("rechazadas", rechazadas);
        response.put("registros", registros);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/renuncia/resolver")
    public ResponseEntity<Map<String, Object>> resolverRenuncia(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body) {
        String estadoRenuncia = body != null && body.get("estadoRenuncia") != null ? String.valueOf(body.get("estadoRenuncia")) : null;
        String observacionesRenuncia = body != null && body.get("observacionesRenuncia") != null ? String.valueOf(body.get("observacionesRenuncia")) : null;
        Postulacion p = postulacionService.resolverRenuncia(postulacionId, estadoRenuncia, observacionesRenuncia);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estado", p.getEstado());
        response.put("estadoRenuncia", p.getEstadoRenuncia());
        response.put("fechaResolucionRenuncia", p.getFechaResolucionRenuncia() != null ? p.getFechaResolucionRenuncia().toString() : null);
        response.put("observacionesRenuncia", p.getObservacionesRenuncia());
        response.put("message", "Renuncia resuelta");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/bancaria")
    public ResponseEntity<Map<String, Object>> actualizarBancariaAdmin(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body,
            org.springframework.security.core.Authentication auth) {
        Long authUserId = auth != null && auth.getPrincipal() instanceof Long ? (Long) auth.getPrincipal() : null;
        if (authUserId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "No autenticado"));
        }
        String banco = body != null && body.get("banco") != null ? String.valueOf(body.get("banco")) : null;
        String titularCuenta = body != null && body.get("titularCuenta") != null ? String.valueOf(body.get("titularCuenta")) : null;
        String cuentaBancaria = body != null && body.get("cuentaBancaria") != null ? String.valueOf(body.get("cuentaBancaria")) : null;
        String clabeInterbancaria = body != null && body.get("clabeInterbancaria") != null ? String.valueOf(body.get("clabeInterbancaria")) : null;
        String medioNotificacion = body != null && body.get("medioNotificacion") != null ? String.valueOf(body.get("medioNotificacion")) : null;

        Postulacion p = postulacionService.actualizarInformacionBancaria(
                postulacionId,
                authUserId,
                true,
                banco,
                titularCuenta,
                cuentaBancaria,
                clabeInterbancaria,
                medioNotificacion
        );
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("banco", p.getBanco());
        response.put("titularCuenta", p.getTitularCuenta());
        response.put("cuentaBancaria", p.getCuentaBancaria());
        response.put("clabeInterbancaria", p.getClabeInterbancaria());
        response.put("medioNotificacion", p.getMedioNotificacion());
        response.put("fechaActualizacionBancaria", p.getFechaActualizacionBancaria() != null ? p.getFechaActualizacionBancaria().toString() : null);
        response.put("message", "Informacion bancaria actualizada");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/apoyo/entregar")
    public ResponseEntity<Map<String, Object>> registrarEntregaApoyo(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody(required = false) Map<String, Object> body) {
        String observacionesEntregaApoyo = body != null && body.get("observacionesEntregaApoyo") != null
                ? String.valueOf(body.get("observacionesEntregaApoyo"))
                : null;
        Postulacion p = postulacionService.registrarEntregaApoyo(postulacionId, observacionesEntregaApoyo);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estadoEntregaApoyo", p.getEstadoEntregaApoyo());
        response.put("fechaEntregaApoyo", p.getFechaEntregaApoyo() != null ? p.getFechaEntregaApoyo().toString() : null);
        response.put("observacionesEntregaApoyo", p.getObservacionesEntregaApoyo());
        response.put("estadoReciboPago", p.getEstadoReciboPago());
        response.put("message", "Entrega de apoyo registrada");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/cotejo")
    public ResponseEntity<Map<String, Object>> registrarCotejo(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body) {
        String estadoCotejo = body != null && body.get("estadoCotejo") != null ? String.valueOf(body.get("estadoCotejo")) : null;
        String observacionesCotejo = body != null && body.get("observacionesCotejo") != null ? String.valueOf(body.get("observacionesCotejo")) : null;
        Postulacion p = postulacionService.registrarCotejo(postulacionId, estadoCotejo, observacionesCotejo);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estadoCotejo", p.getEstadoCotejo());
        response.put("observacionesCotejo", p.getObservacionesCotejo());
        response.put("fechaCotejo", p.getFechaCotejo() != null ? p.getFechaCotejo().toString() : null);
        response.put("message", "Cotejo actualizado");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/informes/configurar")
    public ResponseEntity<Map<String, Object>> configurarInformes(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body) {
        java.time.LocalDate fechaParcial = null;
        java.time.LocalDate fechaFinal = null;
        if (body != null && body.get("fechaLimiteInformeParcial") != null && !String.valueOf(body.get("fechaLimiteInformeParcial")).isBlank()) {
            try {
                fechaParcial = java.time.LocalDate.parse(String.valueOf(body.get("fechaLimiteInformeParcial")));
            } catch (Exception ex) {
                return ResponseEntity.badRequest().body(Map.of("message", "Fecha límite de informe parcial inválida"));
            }
        }
        if (body != null && body.get("fechaLimiteInformeFinal") != null && !String.valueOf(body.get("fechaLimiteInformeFinal")).isBlank()) {
            try {
                fechaFinal = java.time.LocalDate.parse(String.valueOf(body.get("fechaLimiteInformeFinal")));
            } catch (Exception ex) {
                return ResponseEntity.badRequest().body(Map.of("message", "Fecha límite de informe final inválida"));
            }
        }
        String observacionesInforme = body != null && body.get("observacionesInforme") != null ? String.valueOf(body.get("observacionesInforme")) : null;
        Postulacion p = postulacionService.configurarInformes(postulacionId, fechaParcial, fechaFinal, observacionesInforme);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estadoInforme", p.getEstadoInforme());
        response.put("fechaLimiteInformeParcial", p.getFechaLimiteInformeParcial() != null ? p.getFechaLimiteInformeParcial().toString() : null);
        response.put("fechaLimiteInformeFinal", p.getFechaLimiteInformeFinal() != null ? p.getFechaLimiteInformeFinal().toString() : null);
        response.put("observacionesInforme", p.getObservacionesInforme());
        response.put("message", "Fechas de informes configuradas");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/informes/incumplimiento")
    public ResponseEntity<Map<String, Object>> incumplimientoInformes(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody(required = false) Map<String, Object> body) {
        String motivo = body != null && body.get("motivo") != null ? String.valueOf(body.get("motivo")) : null;
        Postulacion p = postulacionService.marcarIncumplimientoInformes(postulacionId, motivo);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estado", p.getEstado());
        response.put("estadoInforme", p.getEstadoInforme());
        response.put("motivoIncumplimientoInforme", p.getMotivoIncumplimientoInforme());
        response.put("message", "Solicitud marcada con incumplimiento de informes");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{postulacionId}/recibo-pago/validar")
    public ResponseEntity<Map<String, Object>> validarReciboPago(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body) {
        String estadoReciboPago = body != null && body.get("estadoReciboPago") != null ? String.valueOf(body.get("estadoReciboPago")) : null;
        String observacionesReciboPago = body != null && body.get("observacionesReciboPago") != null ? String.valueOf(body.get("observacionesReciboPago")) : null;
        Postulacion p = postulacionService.validarReciboPago(postulacionId, estadoReciboPago, observacionesReciboPago);
        Map<String, Object> response = new HashMap<>();
        response.put("id", p.getId());
        response.put("estadoReciboPago", p.getEstadoReciboPago());
        response.put("fechaValidacionReciboPago", p.getFechaValidacionReciboPago() != null ? p.getFechaValidacionReciboPago().toString() : null);
        response.put("observacionesReciboPago", p.getObservacionesReciboPago());
        response.put("message", "Recibo de pago actualizado");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{postulacionId}")
    public ResponseEntity<Map<String, String>> eliminar(
            @PathVariable Long convocatoriaId,
            @PathVariable Long postulacionId) {
        postulacionService.eliminar(postulacionId);
        return ResponseEntity.ok(Map.of("message", "Postulación eliminada correctamente"));
    }

    @PostMapping("/informes/ejecutar-reglas")
    public ResponseEntity<Map<String, Object>> ejecutarReglasInformes(@PathVariable Long convocatoriaId) {
        if (!postulacionService.moduloInformesActivoPorConvocatoria(convocatoriaId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Esta convocatoria no tiene activo el módulo de informes",
                    "convocatoriaId", convocatoriaId,
                    "actualizadas", 0
            ));
        }
        int actualizadas = postulacionService.ejecutarReglasAutomaticasInformes();
        Map<String, Object> response = new HashMap<>();
        response.put("actualizadas", actualizadas);
        response.put("message", "Reglas automáticas de informes ejecutadas");
        return ResponseEntity.ok(response);
    }
}
