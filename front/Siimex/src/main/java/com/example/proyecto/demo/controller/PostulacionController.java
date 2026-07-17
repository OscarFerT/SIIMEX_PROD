package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Postulacion;
import com.example.proyecto.demo.Service.DocumentoService;
import com.example.proyecto.demo.Service.PostulacionService;
import com.example.proyecto.demo.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/postulaciones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PostulacionController {

    private final PostulacionService postulacionService;
    private final DocumentoService documentoService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> crear(
            @RequestParam("convocatoriaId") Long convocatoriaId,
            @RequestParam("cedula") String cedula,
            @RequestParam("curp") String curp,
            @RequestParam("correo") String correo,
            @RequestParam("telefono") String telefono,
            @RequestParam(value = "tipoApoyo", required = false) String tipoApoyo,
            @RequestParam(value = "tipoSolicitud", required = false) String tipoSolicitud,
            @RequestParam(value = "fechaEvento", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaEvento,
            @RequestParam(value = "tituloProyecto", required = false) String tituloProyecto,
            @RequestParam(value = "descripcionProyecto", required = false) String descripcionProyecto,
            @RequestParam(value = "observaciones", required = false) String observaciones,
            @RequestParam(value = "criteriosJson", required = false) String criteriosJson,
            @RequestParam(value = "aceptaAvisoPrivacidad", required = false) Boolean aceptaAvisoPrivacidad,
            @RequestParam("cv") MultipartFile cv,
            HttpServletRequest request,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        Map<String, MultipartFile> docsAdjuntos = extraerDocumentosAdjuntos(request);
        try {
            Postulacion p = postulacionService.crear(
                    authUserId, convocatoriaId,
                    cedula, curp, correo, telefono,
                    tipoApoyo, tipoSolicitud, fechaEvento, tituloProyecto, descripcionProyecto,
                    observaciones, criteriosJson, aceptaAvisoPrivacidad, cv, docsAdjuntos);
            return ResponseEntity.ok(Map.of(
                    "id", p.getId(),
                    "message", "Postulación enviada correctamente"
            ));
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error al enviar postulación"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error al enviar postulación"));
        }
    }

    @GetMapping("/mias")
    public ResponseEntity<?> listarMias(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        List<Map<String, Object>> items = postulacionService.listarMias(authUserId);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/evaluador/asignadas")
    @PreAuthorize("hasAnyRole('ADMIN','EVALUADOR')")
    public ResponseEntity<?> listarAsignadasEvaluador(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        List<Postulacion> lista = postulacionService.listarAsignadasAEvaluador(authUserId);
        List<Map<String, Object>> items = lista.stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("usuarioId", p.getUsuario() != null ? p.getUsuario().getId() : null);
            Long fotoId = p.getUsuario() != null
                    ? documentoService.obtenerDocumentoPorUsuarioYTipo(p.getUsuario().getId(), Documento.TipoDocumento.FOTO_PERFIL)
                    .map(Documento::getId).orElse(null)
                    : null;
            m.put("fotoDocumentoId", fotoId);
            m.put("folio", p.getFolio());
            m.put("nombre", p.getUsuario() != null
                    ? ((p.getUsuario().getNombre() != null ? p.getUsuario().getNombre() : "") + " " +
                    (p.getUsuario().getApellidoPaterno() != null ? p.getUsuario().getApellidoPaterno() : "")).trim()
                    : "");
            m.put("correo", p.getCorreo());
            m.put("cedula", p.getCedula());
            m.put("curp", p.getCurp());
            m.put("telefono", p.getTelefono());
            m.put("convocatoriaId", p.getConvocatoria() != null ? p.getConvocatoria().getId() : null);
            m.put("convocatoriaTitulo", p.getConvocatoria() != null ? p.getConvocatoria().getTitulo() : null);
            m.put("tipoApoyo", p.getTipoApoyo());
            m.put("tipoSolicitud", p.getTipoSolicitud());
            m.put("fechaEvento", p.getFechaEvento() != null ? p.getFechaEvento().toString() : null);
            m.put("tituloProyecto", p.getTituloProyecto());
            m.put("descripcionProyecto", p.getDescripcionProyecto());
            m.put("observaciones", p.getObservaciones());
            m.put("observacionesRevision", p.getObservacionesRevision());
            m.put("fechaRevision", p.getFechaRevision() != null ? p.getFechaRevision().toString() : null);
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
            m.put("tieneCurriculum", p.getCurriculumDocumento() != null);
            m.put("curriculumDocumentoId", p.getCurriculumDocumento() != null ? p.getCurriculumDocumento().getId() : null);
            m.put("curriculumNombreArchivo", p.getCurriculumDocumento() != null ? p.getCurriculumDocumento().getNombreArchivo() : null);
            m.put("documentosAdjuntos", postulacionService.listarDocumentosAdjuntos(p.getId()));
            return m;
        }).toList();
        return ResponseEntity.ok(items);
    }

    @PostMapping("/{postulacionId}/evaluacion")
    @PreAuthorize("hasAnyRole('ADMIN','EVALUADOR')")
    public ResponseEntity<?> registrarEvaluacion(
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()));
        try {
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
            Postulacion p = postulacionService.registrarEvaluacion(postulacionId, authUserId, isAdmin, resultado, puntaje, comentarios);
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
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo registrar evaluacion"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo registrar evaluacion"));
        }
    }

    @PostMapping(value = "/{postulacionId}/evaluacion/documento-firmado", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','EVALUADOR')")
    public ResponseEntity<?> subirDocumentoEvaluacionFirmado(
            @PathVariable Long postulacionId,
            @RequestParam("tipo") String tipo,
            @RequestPart("file") MultipartFile file,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()));
        try {
            Map<String, Object> data = postulacionService.subirDocumentoEvaluacionFirmado(
                    postulacionId,
                    authUserId,
                    isAdmin,
                    tipo,
                    file
            );
            Map<String, Object> response = new HashMap<>(data);
            response.put("message", "Documento firmado cargado correctamente");
            return ResponseEntity.ok(response);
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo cargar el documento firmado"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo cargar el documento firmado"));
        }
    }

    @PostMapping("/mias/{postulacionId}/bancaria")
    public ResponseEntity<?> actualizarBancariaMia(
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        try {
            String banco = body != null && body.get("banco") != null ? String.valueOf(body.get("banco")) : null;
            String titularCuenta = body != null && body.get("titularCuenta") != null ? String.valueOf(body.get("titularCuenta")) : null;
            String cuentaBancaria = body != null && body.get("cuentaBancaria") != null ? String.valueOf(body.get("cuentaBancaria")) : null;
            String clabeInterbancaria = body != null && body.get("clabeInterbancaria") != null ? String.valueOf(body.get("clabeInterbancaria")) : null;
            String medioNotificacion = body != null && body.get("medioNotificacion") != null ? String.valueOf(body.get("medioNotificacion")) : null;

            Postulacion p = postulacionService.actualizarInformacionBancaria(
                    postulacionId,
                    authUserId,
                    false,
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
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo actualizar la informacion bancaria"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo actualizar la informacion bancaria"));
        }
    }

    @PostMapping(value = "/mias/{postulacionId}/informes/parcial", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirInformeParcial(
            @PathVariable Long postulacionId,
            @RequestPart("file") MultipartFile file,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        try {
            Postulacion p = postulacionService.subirInformeParcial(postulacionId, authUserId, file);
            return ResponseEntity.ok(Map.of(
                    "id", p.getId(),
                    "estadoInforme", p.getEstadoInforme(),
                    "fechaInformeParcial", p.getFechaInformeParcial() != null ? p.getFechaInformeParcial().toString() : null,
                    "informeParcialDocumentoId", p.getInformeParcialDocumento() != null ? p.getInformeParcialDocumento().getId() : null,
                    "message", "Informe parcial cargado"
            ));
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo subir el informe parcial"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo subir el informe parcial"));
        }
    }

    @PostMapping(value = "/mias/{postulacionId}/recibo-pago", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirReciboPago(
            @PathVariable Long postulacionId,
            @RequestPart("file") MultipartFile file,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        try {
            Postulacion p = postulacionService.subirReciboPago(postulacionId, authUserId, file);
            return ResponseEntity.ok(Map.of(
                    "id", p.getId(),
                    "estadoReciboPago", p.getEstadoReciboPago(),
                    "fechaReciboPago", p.getFechaReciboPago() != null ? p.getFechaReciboPago().toString() : null,
                    "reciboPagoDocumentoId", p.getReciboPagoDocumento() != null ? p.getReciboPagoDocumento().getId() : null,
                    "message", "Recibo de pago cargado"
            ));
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo subir el recibo de pago"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo subir el recibo de pago"));
        }
    }

    @PostMapping(value = "/mias/{postulacionId}/informes/final", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> subirInformeFinal(
            @PathVariable Long postulacionId,
            @RequestPart("file") MultipartFile file,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        try {
            Postulacion p = postulacionService.subirInformeFinal(postulacionId, authUserId, file);
            return ResponseEntity.ok(Map.of(
                    "id", p.getId(),
                    "estadoInforme", p.getEstadoInforme(),
                    "fechaInformeFinal", p.getFechaInformeFinal() != null ? p.getFechaInformeFinal().toString() : null,
                    "informeFinalDocumentoId", p.getInformeFinalDocumento() != null ? p.getInformeFinalDocumento().getId() : null,
                    "message", "Informe final cargado"
            ));
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo subir el informe final"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo subir el informe final"));
        }
    }

    @PostMapping("/mias/{postulacionId}/renuncia")
    public ResponseEntity<?> solicitarRenuncia(
            @PathVariable Long postulacionId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        try {
            String motivoRenuncia = body != null && body.get("motivoRenuncia") != null
                    ? String.valueOf(body.get("motivoRenuncia"))
                    : null;
            Postulacion p = postulacionService.solicitarRenuncia(postulacionId, authUserId, motivoRenuncia);
            return ResponseEntity.ok(Map.of(
                    "id", p.getId(),
                    "estadoRenuncia", p.getEstadoRenuncia(),
                    "fechaSolicitudRenuncia", p.getFechaSolicitudRenuncia() != null ? p.getFechaSolicitudRenuncia().toString() : null,
                    "message", "Solicitud de renuncia enviada"
            ));
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo enviar la solicitud de renuncia"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "No se pudo enviar la solicitud de renuncia"));
        }
    }

    @GetMapping("/mias/convocatoria/{convocatoriaId}")
    public ResponseEntity<?> obtenerMiaPorConvocatoria(@PathVariable Long convocatoriaId, Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        Map<String, Object> data = postulacionService.obtenerMiaPorConvocatoria(authUserId, convocatoriaId);
        if (data == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(data);
    }

    @PatchMapping(value = "/mias/{postulacionId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> actualizarMia(
            @PathVariable Long postulacionId,
            @RequestParam("cedula") String cedula,
            @RequestParam("curp") String curp,
            @RequestParam("correo") String correo,
            @RequestParam("telefono") String telefono,
            @RequestParam(value = "tipoApoyo", required = false) String tipoApoyo,
            @RequestParam(value = "tipoSolicitud", required = false) String tipoSolicitud,
            @RequestParam(value = "fechaEvento", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaEvento,
            @RequestParam(value = "tituloProyecto", required = false) String tituloProyecto,
            @RequestParam(value = "descripcionProyecto", required = false) String descripcionProyecto,
            @RequestParam(value = "observaciones", required = false) String observaciones,
            @RequestParam(value = "criteriosJson", required = false) String criteriosJson,
            @RequestParam(value = "aceptaAvisoPrivacidad", required = false) Boolean aceptaAvisoPrivacidad,
            @RequestParam(value = "cv", required = false) MultipartFile cv,
            HttpServletRequest request,
            Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autenticado"));
        }
        Long authUserId = (Long) auth.getPrincipal();
        Map<String, MultipartFile> docsAdjuntos = extraerDocumentosAdjuntos(request);
        try {
            Postulacion p = postulacionService.actualizarMia(
                    authUserId, postulacionId,
                    cedula, curp, correo, telefono,
                    tipoApoyo, tipoSolicitud, fechaEvento, tituloProyecto, descripcionProyecto,
                    observaciones, criteriosJson, aceptaAvisoPrivacidad, cv, docsAdjuntos);
            return ResponseEntity.ok(Map.of(
                    "id", p.getId(),
                    "estado", p.getEstado(),
                    "message", "Postulación actualizada correctamente"
            ));
        } catch (ApiException e) {
            return ResponseEntity.status(e.getStatus())
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error al actualizar postulación"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error al actualizar postulación"));
        }
    }

    /** Extrae archivos multipart con nombre "doc_XXX" y retorna map clave -> archivo */
    private Map<String, MultipartFile> extraerDocumentosAdjuntos(HttpServletRequest request) {
        Map<String, MultipartFile> out = new HashMap<>();
        if (!(request instanceof MultipartHttpServletRequest mreq)) return out;
        for (Map.Entry<String, List<MultipartFile>> e : mreq.getMultiFileMap().entrySet()) {
            if (e.getKey().startsWith("doc_") && e.getValue() != null && !e.getValue().isEmpty()) {
                String clave = e.getKey().substring(4);
                MultipartFile f = e.getValue().get(0);
                if (f != null && !f.isEmpty()) {
                    out.put(clave, f);
                }
            }
        }
        return out;
    }
}
