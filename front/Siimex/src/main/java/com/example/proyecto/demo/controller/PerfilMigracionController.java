package com.example.proyecto.demo.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import com.example.proyecto.demo.Entity.PerfilMigracion;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.PerfilMigracionRepository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.Service.DocumentoService;
import com.example.proyecto.demo.Service.PerfilCompletoService;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/migracion")
@RequiredArgsConstructor
@Slf4j
public class PerfilMigracionController {

    private final PerfilCompletoService perfilCompletoService;
    private final DocumentoService documentoService;
    private final UsuarioRepository usuarioRepository;
    private final PerfilMigracionRepository perfilMigracionRepository;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<?> crear(
            Authentication auth,
            @RequestParam Map<String, String> formData,
            @RequestPart(value = "cvFile", required = false) MultipartFile cvFile,
            @RequestPart(value = "fiscalPdf", required = false) MultipartFile fiscalPdf,
            @RequestPart(value = "domicilio", required = false) MultipartFile domicilio,
            @RequestPart(value = "cert1", required = false) MultipartFile cert1,
            @RequestPart(value = "cert2", required = false) MultipartFile cert2,
            @RequestPart(value = "idioma_cert_documento", required = false) MultipartFile idiomaCertDocumento,
            @RequestPart(value = "acad_constancia_snii", required = false) MultipartFile acadConstanciaSnii,
            @RequestPart(value = "estancia_documento", required = false) MultipartFile estanciaDocumento,
            @RequestPart(value = "divulg_archivo", required = false) MultipartFile divulgArchivo,
            MultipartHttpServletRequest multipartRequest) {

        log.info(">>> Iniciando creación de PerfilMigracion");
        try {
            // Obtener el usuario autenticado
            if (auth == null || auth.getPrincipal() == null) {
                log.error(">>> Autenticación nula o sin principal");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("status", "error");
                errorResponse.put("message", "Usuario no autenticado");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
            }
            
            Long authUserId = (Long) auth.getPrincipal();
            log.info(">>> authUserId obtenido: {}", authUserId);
            
            if (authUserId == null) {
                log.error(">>> authUserId es null");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("status", "error");
                errorResponse.put("message", "ID de usuario no válido");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }
            
            log.info(">>> Buscando usuario con authUserId: {}", authUserId);
            Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            
            Long usuarioId = usuario.getId();
            log.info(">>> Procesando perfil para usuario ID: {}", usuarioId);
            
            if (usuarioId == null) {
                log.error(">>> usuarioId es null después de obtener usuario");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("status", "error");
                errorResponse.put("message", "ID de usuario no válido");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }

            // Convertir formData a Map<String, Object> para el servicio
            // Los valores vienen como String, pero algunos necesitan conversión
            Map<String, Object> datos = new HashMap<>();
            for (Map.Entry<String, String> entry : formData.entrySet()) {
                String key = entry.getKey();
                String value = entry.getValue();
                
                try {
                    // Ignorar campos que no son relevantes para el backend
                    if (key == null || key.isEmpty() || key.startsWith("migracion_json") || key.equals("jsonFileName")) {
                        continue;
                    }
                    
                    // Valores vacíos como null
                    if (value == null || value.isEmpty() || "null".equalsIgnoreCase(value) || "undefined".equalsIgnoreCase(value)) {
                        datos.put(key, null);
                        continue;
                    }
                    
                    // Convertir valores booleanos
                    if ("true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value)) {
                        datos.put(key, Boolean.parseBoolean(value));
                    }
                    // Convertir valores numéricos (intentar Long primero para números grandes)
                    else if (value.matches("-?\\d+")) {
                        try {
                            // Si el número es muy grande, usar Long
                            long longValue = Long.parseLong(value);
                            if (longValue > Integer.MAX_VALUE || longValue < Integer.MIN_VALUE) {
                                datos.put(key, longValue);
                            } else {
                                datos.put(key, (int) longValue);
                            }
                        } catch (NumberFormatException e) {
                            log.warn(">>> No se pudo convertir '{}' a número: {}", value, e.getMessage());
                            datos.put(key, value);
                        }
                    }
                    // Convertir valores decimales
                    else if (value.matches("-?\\d+\\.\\d+")) {
                        try {
                            datos.put(key, Double.parseDouble(value));
                        } catch (NumberFormatException e) {
                            datos.put(key, value);
                        }
                    }
                    // Strings normales
                    else {
                        datos.put(key, value);
                    }
                } catch (Exception e) {
                    log.warn(">>> Error al procesar campo '{}' con valor '{}': {}", key, value, e.getMessage());
                    // Continuar con el siguiente campo en lugar de fallar completamente
                    datos.put(key, value != null ? value : null);
                }
            }
            
            log.info(">>> Total de campos procesados: {}", datos.size());
            
            // Generar migracionId si no existe (para PerfilMigracion)
            Object migracionIdObj = datos.getOrDefault("migracionId", "");
            String migracionId = migracionIdObj != null ? migracionIdObj.toString() : "";
            if (migracionId == null || migracionId.isBlank()) {
                migracionId = "MIG_" + usuarioId + "_" + UUID.randomUUID().toString().substring(0, 8);
                datos.put("migracionId", migracionId);
            }

            log.info(">>> Guardando perfil normalizado para usuario: {}", usuarioId);
            log.info(">>> CV File: {}", cvFile != null ? cvFile.getOriginalFilename() : "null");
            log.info(">>> Fiscal PDF: {}", fiscalPdf != null ? fiscalPdf.getOriginalFilename() : "null");
            log.info(">>> Domicilio: {}", domicilio != null ? domicilio.getOriginalFilename() : "null");
            log.info(">>> Cert1: {}", cert1 != null ? cert1.getOriginalFilename() : "null");
            log.info(">>> Cert2: {}", cert2 != null ? cert2.getOriginalFilename() : "null");
            log.info(">>> Certificación Idioma: {}", idiomaCertDocumento != null ? idiomaCertDocumento.getOriginalFilename() : "null");
            log.info(">>> Constancia SNII: {}", acadConstanciaSnii != null ? acadConstanciaSnii.getOriginalFilename() : "null");
            log.info(">>> Documento Estancia: {}", estanciaDocumento != null ? estanciaDocumento.getOriginalFilename() : "null");
            log.info(">>> Divulg Archivo: {}", divulgArchivo != null ? divulgArchivo.getOriginalFilename() : "null");

            // 1. Guardar el perfil de migración completo normalizado
            // Vincular con el usuario antes de guardar
            // Asegurar que usuarioId se pase como Long (no Integer)
            datos.put("usuarioId", Long.valueOf(usuarioId));
            log.info(">>> Llamando a guardarPerfilCompleto con {} campos, usuarioId: {}", datos.size(), usuarioId);
            log.info(">>> Tipo de usuarioId en datos: {}", datos.get("usuarioId") != null ? datos.get("usuarioId").getClass().getName() : "null");
            
            // Log de algunos campos clave para debugging
            log.info(">>> Campos clave - persNombre: {}, persCurp: {}, instNombre: {}, areaNombre: {}", 
                    datos.get("persNombre"), datos.get("persCurp"), datos.get("instNombre"), datos.get("areaNombre"));
            
            PerfilMigracion perfilMigracion = null;
            try {
                perfilMigracion = perfilCompletoService.guardarPerfilCompleto(datos);
                log.info(">>> PerfilMigracion guardado exitosamente: {}", 
                        perfilMigracion != null && perfilMigracion.getId() != null ? perfilMigracion.getId() : "null");
            } catch (IllegalArgumentException e) {
                log.error(">>> Error de validación al guardar PerfilMigracion: {}", e.getMessage(), e);
                throw e;
            } catch (Exception e) {
                log.error(">>> Error inesperado al guardar PerfilMigracion: {}", e.getMessage(), e);
                log.error(">>> Stack trace completo:", e);
                throw e;
            }
            
            if (perfilMigracion == null) {
                log.error(">>> PerfilMigracion es null después de guardar");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("status", "error");
                errorResponse.put("message", "Error al guardar el perfil de migración");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
            }

            // 2. Guardar los archivos asociados al usuario (en carpeta del usuario)
            try {
                documentoService.guardarDocumentos(
                    usuarioId,
                    cvFile,
                    fiscalPdf,
                    domicilio,
                    cert1,
                    cert2,
                    idiomaCertDocumento,
                    acadConstanciaSnii,
                    estanciaDocumento,
                    divulgArchivo
                );

                // Soporta múltiples evidencias PDF de divulgación enviadas como divulgArchivo_{index}
                if (multipartRequest != null) {
                    for (Map.Entry<String, MultipartFile> entry : multipartRequest.getFileMap().entrySet()) {
                        String key = entry.getKey();
                        MultipartFile file = entry.getValue();
                        if (key != null && key.startsWith("divulgArchivo_") && file != null && !file.isEmpty()) {
                            try {
                                documentoService.guardarDocumento(
                                        usuarioId,
                                        file,
                                        com.example.proyecto.demo.Entity.Documento.TipoDocumento.DIVULGACION,
                                        file.getOriginalFilename(),
                                        false
                                );
                            } catch (Exception ex) {
                                log.warn(">>> No se pudo guardar evidencia dinámica de divulgación {}: {}", key, ex.getMessage());
                            }
                        }
                    }
                }
                log.info(">>> Archivos guardados exitosamente en carpeta del usuario: {}", usuarioId);
            } catch (IllegalArgumentException e) {
                log.warn(">>> Validación de archivos fallida: {}", e.getMessage());
                throw e;
            } catch (Exception e) {
                log.error(">>> Error al guardar archivos: {}", e.getMessage(), e);
                throw new RuntimeException("No se pudieron guardar los documentos", e);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "PerfilMigracion y documentos guardados correctamente");
            response.put("usuarioId", usuarioId);
            response.put("migracionId", migracionId);
            response.put("perfilMigracionId", perfilMigracion != null && perfilMigracion.getId() != null 
                    ? perfilMigracion.getId() : null);
            
            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (IllegalArgumentException e) {
            log.error(">>> Error de validación al procesar perfil: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", "Error de validación: " + (e.getMessage() != null ? e.getMessage() : "Datos inválidos"));
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        } catch (ResponseStatusException e) {
            log.error(">>> Error de estado al procesar perfil: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", e.getReason() != null ? e.getReason() : "Error al procesar la solicitud");
            return ResponseEntity.status(e.getStatusCode()).body(errorResponse);
        } catch (Exception e) {
            log.error(">>> Error inesperado al procesar perfil: {}", e.getMessage(), e);
            log.error(">>> Stack trace completo:", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            String errorMessage = "Error al procesar el perfil";
            if (e.getMessage() != null) {
                errorMessage += ": " + e.getMessage();
            }
            // Incluir información adicional para debugging
            if (e.getCause() != null) {
                errorMessage += " (Causa: " + e.getCause().getMessage() + ")";
            }
            errorResponse.put("message", errorMessage);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Endpoint independiente para procesar solo la migración JSON
     * Este endpoint es opcional y no afecta el proceso de completar el registro
     */
    @PostMapping(value = "/procesar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.OK)
    public ResponseEntity<?> procesarMigracion(
            Authentication auth,
            @RequestParam(value = "migracionId", required = false) String migracionId,
            @RequestPart(value = "migracionJson", required = true) MultipartFile migracionJson) {

        try {
            // Obtener el usuario autenticado
            Long authUserId = (Long) auth.getPrincipal();
            Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            
            Long usuarioId = usuario.getId();
            log.info(">>> Procesando migración JSON para usuario ID: {}", usuarioId);

            // Generar migracionId si no se proporciona
            if (migracionId == null || migracionId.isBlank()) {
                migracionId = "MIG_" + usuarioId + "_" + UUID.randomUUID().toString().substring(0, 8);
                log.info(">>> migracionId generado automáticamente: {}", migracionId);
            }

            // Aquí se procesaría el archivo JSON y se importarían los datos
            // Por ahora, solo registramos que se recibió
            log.info(">>> Archivo JSON recibido: {} ({} bytes)", 
                    migracionJson.getOriginalFilename(), migracionJson.getSize());

            // TODO: Implementar el procesamiento del JSON y la importación de datos históricos
            // Por ahora retornamos éxito
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Migración procesada exitosamente");
            response.put("usuarioId", usuarioId);
            response.put("migracionId", migracionId);
            response.put("archivo", migracionJson.getOriginalFilename() != null 
                    ? migracionJson.getOriginalFilename() : "archivo_desconocido");
            
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error(">>> Error al procesar migración: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", "Error al procesar la migración: " + (e.getMessage() != null ? e.getMessage() : "Error desconocido"));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Endpoint para verificar si el usuario ya tiene un PerfilMigracion guardado
     */
    @GetMapping("/verificar")
    public ResponseEntity<?> verificarPerfilMigracion(Authentication auth) {
        log.info(">>> Iniciando verificación de PerfilMigracion");
        try {
            if (auth == null || auth.getPrincipal() == null) {
                log.warn(">>> Autenticación nula o sin principal");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("tienePerfilMigracion", false);
                errorResponse.put("error", "Usuario no autenticado");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
            }
            
            Long authUserId = (Long) auth.getPrincipal();
            log.info(">>> authUserId obtenido: {}", authUserId);
            if (authUserId == null) {
                log.warn(">>> authUserId es null");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("tienePerfilMigracion", false);
                errorResponse.put("error", "ID de usuario no válido");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }
            
            log.info(">>> Buscando usuario con authUserId: {}", authUserId);
            Usuario usuario = usuarioRepository.findByAuthUserIdWithRegistro1(authUserId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            log.info(">>> Usuario encontrado con ID: {}", usuario != null ? usuario.getId() : "null");
            
            if (usuario == null) {
                log.warn(">>> Usuario es null después de buscar");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("tienePerfilMigracion", false);
                errorResponse.put("error", "Usuario no encontrado");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
            }
            
            Long usuarioId = usuario.getId();
            if (usuarioId == null) {
                log.warn(">>> usuarioId es null");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("tienePerfilMigracion", false);
                errorResponse.put("error", "ID de usuario no válido");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }
            
            // Buscar perfil de migración de forma separada para evitar problemas con relaciones bidireccionales
            log.info(">>> Buscando PerfilMigracion para usuarioId: {}", usuarioId);
            PerfilMigracion perfilMigracion = null;
            try {
                Optional<PerfilMigracion> perfilOpt = perfilMigracionRepository.findByUsuarioId(usuarioId);
                perfilMigracion = perfilOpt.orElse(null);
                log.info(">>> PerfilMigracion encontrado: {}", perfilMigracion != null ? "Sí" : "No");
            } catch (Exception e) {
                log.error(">>> Error al buscar PerfilMigracion por usuarioId {}: {}", usuarioId, e.getMessage(), e);
            }
            
            boolean tienePerfilMigracion = perfilMigracion != null;
            log.info(">>> tienePerfilMigracion: {}", tienePerfilMigracion);
            
            // Obtener nombre completo y CURP del usuario
            String nombreCompleto = "";
            if (usuario.getNombre() != null) {
                nombreCompleto = usuario.getNombre();
                if (usuario.getApellidoPaterno() != null) {
                    nombreCompleto += " " + usuario.getApellidoPaterno();
                }
                if (usuario.getApellidoMaterno() != null) {
                    nombreCompleto += " " + usuario.getApellidoMaterno();
                }
            }
            
            String curp = null;
            try {
                Registro1 registro1 = usuario.getRegistro1();
                if (registro1 != null) {
                    curp = registro1.getCurp();
                }
            } catch (Exception e) {
                log.warn(">>> Error al obtener Registro1: {}", e.getMessage());
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("tienePerfilMigracion", tienePerfilMigracion);
            response.put("usuarioId", usuarioId);
            
            Long perfilMigracionId = null;
            if (tienePerfilMigracion && perfilMigracion != null) {
                try {
                    perfilMigracionId = perfilMigracion.getId();
                } catch (Exception e) {
                    log.warn(">>> Error al obtener ID de PerfilMigracion: {}", e.getMessage());
                }
            }
            response.put("perfilMigracionId", perfilMigracionId);
            response.put("nombreCompleto", nombreCompleto != null && !nombreCompleto.isEmpty() ? nombreCompleto : "N/A");
            response.put("curp", curp != null && !curp.isEmpty() ? curp : "N/A");
            
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException e) {
            log.error(">>> ResponseStatusException al verificar PerfilMigracion: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("tienePerfilMigracion", false);
            errorResponse.put("error", e.getReason() != null ? e.getReason() : e.getMessage());
            return ResponseEntity.status(e.getStatusCode()).body(errorResponse);
        } catch (Exception e) {
            log.error(">>> Error al verificar PerfilMigracion: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("tienePerfilMigracion", false);
            errorResponse.put("error", e.getMessage() != null ? e.getMessage() : "Error desconocido");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
}
