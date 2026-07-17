package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.Service.DocumentoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/documentos")
@RequiredArgsConstructor
@Slf4j
public class DocumentoController {

    private final DocumentoService documentoService;
    private final UsuarioRepository usuarioRepository;
    private static final long MAX_PDF_EVIDENCIA_SIZE = 2L * 1024L * 1024L; // 2MB

    @GetMapping("/{documentoId}")
    public ResponseEntity<byte[]> descargarDocumento(@PathVariable Long documentoId, Authentication auth) {
        var documento = documentoService.obtenerDocumento(documentoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Documento no encontrado"));

        validarAccesoDocumento(auth, documento.getUsuario().getId());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + documento.getNombreArchivo() + "\"")
                .contentType(MediaType.parseMediaType(documento.getContentType()))
                .body(documento.getContenido());
    }

    @GetMapping("/publico/{documentoId}")
    public ResponseEntity<byte[]> descargarDocumentoPublico(@PathVariable Long documentoId) {
        var documento = documentoService.obtenerDocumento(documentoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Documento no encontrado"));

        if (!esTipoPublico(documento.getTipo()) || !permitirPublicacionPorVisibilidad(documento)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Documento no disponible públicamente");
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + documento.getNombreArchivo() + "\"")
                .contentType(MediaType.parseMediaType(documento.getContentType()))
                .body(documento.getContenido());
    }

    @GetMapping("/usuario/{usuarioId}")
    public ResponseEntity<List<Documento>> listarDocumentosPorUsuario(
            @PathVariable Long usuarioId,
            Authentication auth) {
        validarAccesoDocumento(auth, usuarioId);
        var documentos = documentoService.obtenerDocumentosPorUsuario(usuarioId);
        return ResponseEntity.ok(documentos);
    }

    private void validarAccesoDocumento(Authentication auth, Long usuarioIdSolicitado) {
        if (auth == null || auth.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado");
        }

        boolean isAdmin = auth.getAuthorities() != null
                && auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) return;

        Long authUserId = (Long) auth.getPrincipal();
        Usuario usuarioAutenticado = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        if (!usuarioAutenticado.getId().equals(usuarioIdSolicitado)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sin permisos para acceder a este recurso");
        }
    }

    private boolean esTipoPublico(Documento.TipoDocumento tipo) {
        return tipo == Documento.TipoDocumento.FOTO_PERFIL
                || tipo == Documento.TipoDocumento.CURRICULUM
                || tipo == Documento.TipoDocumento.CV;
    }

    private boolean permitirPublicacionPorVisibilidad(Documento documento) {
        String visibilidad = normalizarVisibilidad(
                documento.getUsuario() != null ? documento.getUsuario().getVisibilidadPerfil() : null
        );

        if (documento.getTipo() == Documento.TipoDocumento.FOTO_PERFIL) {
            return !"MINIMA".equals(visibilidad);
        }

        if (documento.getTipo() == Documento.TipoDocumento.CURRICULUM
                || documento.getTipo() == Documento.TipoDocumento.CV) {
            return "COMPLETA".equals(visibilidad);
        }

        return false;
    }

    private String normalizarVisibilidad(String visibilidadPerfil) {
        if (visibilidadPerfil == null || visibilidadPerfil.isBlank()) {
            return "ESTANDAR";
        }
        return visibilidadPerfil.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * Guarda documentos del perfil: INE, Comprobante de domicilio, Certificados.
     * El CV ya no se sube (se genera automáticamente por SIIMEX).
     */
    @PostMapping(value = "/registro2", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> guardarDocumentosRegistro2(
            Authentication auth,
            @RequestPart(value = "fiscalPdf", required = false) MultipartFile fiscalPdf,
            @RequestPart(value = "domicilio", required = false) MultipartFile domicilio,
            @RequestPart(value = "cedulaPdf", required = false) MultipartFile cedulaPdf,
            @RequestPart(value = "constanciaSnii", required = false) MultipartFile constanciaSnii,
            @RequestPart(value = "cert1", required = false) MultipartFile cert1,
            @RequestPart(value = "cert2", required = false) MultipartFile cert2) {
        
        try {
            validarMaximoDosMb(fiscalPdf, "INE");
            validarMaximoDosMb(cedulaPdf, "Cédula profesional");
            validarMaximoDosMb(constanciaSnii, "Constancia SNII");

            Long authUserId = (Long) auth.getPrincipal();
            Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            
            Long usuarioId = usuario.getId();
            
            List<Documento> documentosGuardados = documentoService.guardarDocumentos(
                    usuarioId,
                    null,
                    fiscalPdf,
                    domicilio,
                    cert1,
                    cert2,
                    null,
                    constanciaSnii,
                    null,
                    null
            );

            if (cedulaPdf != null && !cedulaPdf.isEmpty()) {
                Documento docCedula = documentoService.guardarDocumentoUsuario(
                        usuarioId, cedulaPdf, Documento.TipoDocumento.CEDULA_PROFESIONAL);
                documentosGuardados.add(docCedula);
            }

            usuario.setRegistro2Completo(true);
            usuarioRepository.save(usuario);
            
            log.info("Documentos guardados para usuario {}: {}", usuarioId, documentosGuardados.size());
            
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Documentos guardados correctamente",
                    "documentosGuardados", documentosGuardados.size(),
                    "usuarioId", usuarioId
            ));
            
        } catch (IllegalArgumentException e) {
            log.warn("Validación de documentos fallida: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of(
                            "status", "error",
                            "message", e.getMessage()
                    ));
        } catch (IOException e) {
            log.error("Error al guardar documentos: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "status", "error",
                            "message", "Error al guardar documentos: " + e.getMessage()
                    ));
        } catch (Exception e) {
            log.error("Error inesperado al guardar documentos: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "status", "error",
                            "message", "Error al procesar la solicitud: " + e.getMessage()
                    ));
        }
    }

    private void validarMaximoDosMb(MultipartFile archivo, String etiqueta) {
        if (archivo != null && !archivo.isEmpty() && archivo.getSize() > MAX_PDF_EVIDENCIA_SIZE) {
            throw new IllegalArgumentException(etiqueta + ": el archivo no puede superar 2 MB");
        }
    }
}
