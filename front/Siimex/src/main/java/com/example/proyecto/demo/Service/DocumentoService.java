package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.DocumentoRepository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentoService {

    private final DocumentoRepository documentoRepository;
    private final UsuarioRepository usuarioRepository;

    @Value("${app.upload.directory:usuarios}")
    private String uploadBaseDirectory;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    /**
     * Guarda múltiples archivos asociados a un usuario
     * Crea carpeta por usuario: usuarios/{usuarioId}/
     * 
     * NOTA PARA PRODUCCIÓN:
     * - Mejor usar ruta absoluta externa al proyecto: /var/app/comecyt/usuarios
     * - O usar almacenamiento cloud (S3, Azure Blob Storage)
     * - Configurar via variable de entorno o application.properties
     */
    @Transactional
    public List<Documento> guardarDocumentos(Long usuarioId,
                                              MultipartFile cvFile,
                                              MultipartFile fiscalPdf,
                                              MultipartFile domicilio,
                                              MultipartFile cert1,
                                              MultipartFile cert2,
                                              MultipartFile idiomaCertDocumento,
                                              MultipartFile constanciaSnii,
                                              MultipartFile estanciaDocumento,
                                              MultipartFile divulgArchivo) throws IOException {
        
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + usuarioId));

        // Crear carpeta del usuario si no existe
        Path usuarioDir = crearDirectorioUsuario(usuarioId);
        
        List<Documento> documentosGuardados = new ArrayList<>();

        if (cvFile != null && !cvFile.isEmpty()) {
            validarArchivo(cvFile, Documento.TipoDocumento.CV);
            // Guardar como CV
            Documento docCV = crearDocumento(usuario, cvFile, Documento.TipoDocumento.CV, usuarioDir);
            documentosGuardados.add(documentoRepository.save(docCV));
            log.info("CV guardado para usuario: {}", usuarioId);
            
            // También guardar como CURRICULUM para sincronizar con perfil
            // Eliminar currículum anterior si existe
            documentoRepository.findByUsuarioIdAndTipo(usuarioId, Documento.TipoDocumento.CURRICULUM)
                    .ifPresent(docAnterior -> {
                        try {
                            Path archivoAnterior = usuarioDir.resolve(docAnterior.getNombreArchivo());
                            if (Files.exists(archivoAnterior)) {
                                Files.delete(archivoAnterior);
                            }
                        } catch (IOException e) {
                            log.warn("No se pudo eliminar currículum anterior: {}", e.getMessage());
                        }
                        documentoRepository.delete(docAnterior);
                    });
            
            // Crear nuevo documento CURRICULUM con el mismo contenido
            Documento docCurriculum = crearDocumento(usuario, cvFile, Documento.TipoDocumento.CURRICULUM, usuarioDir);
            documentosGuardados.add(documentoRepository.save(docCurriculum));
            log.info("Currículum sincronizado con CV para usuario: {}", usuarioId);
        }

        if (fiscalPdf != null && !fiscalPdf.isEmpty()) {
            validarArchivo(fiscalPdf, Documento.TipoDocumento.FISCAL_PDF);
            Documento doc = crearDocumento(usuario, fiscalPdf, Documento.TipoDocumento.FISCAL_PDF, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Fiscal PDF guardado para usuario: {}", usuarioId);
        }

        if (domicilio != null && !domicilio.isEmpty()) {
            validarArchivo(domicilio, Documento.TipoDocumento.DOMICILIO);
            Documento doc = crearDocumento(usuario, domicilio, Documento.TipoDocumento.DOMICILIO, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Domicilio guardado para usuario: {}", usuarioId);
        }

        if (cert1 != null && !cert1.isEmpty()) {
            validarArchivo(cert1, Documento.TipoDocumento.CERTIFICADO_1);
            Documento doc = crearDocumento(usuario, cert1, Documento.TipoDocumento.CERTIFICADO_1, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Certificado 1 guardado para usuario: {}", usuarioId);
        }

        if (cert2 != null && !cert2.isEmpty()) {
            validarArchivo(cert2, Documento.TipoDocumento.CERTIFICADO_2);
            Documento doc = crearDocumento(usuario, cert2, Documento.TipoDocumento.CERTIFICADO_2, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Certificado 2 guardado para usuario: {}", usuarioId);
        }

        if (idiomaCertDocumento != null && !idiomaCertDocumento.isEmpty()) {
            validarArchivo(idiomaCertDocumento, Documento.TipoDocumento.CERTIFICACION_IDIOMA);
            Documento doc = crearDocumento(usuario, idiomaCertDocumento, Documento.TipoDocumento.CERTIFICACION_IDIOMA, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Certificación de idioma guardada para usuario: {}", usuarioId);
        }

        if (constanciaSnii != null && !constanciaSnii.isEmpty()) {
            validarArchivo(constanciaSnii, Documento.TipoDocumento.CONSTANCIA_SNII);
            Documento doc = crearDocumento(usuario, constanciaSnii, Documento.TipoDocumento.CONSTANCIA_SNII, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Constancia SNII guardada para usuario: {}", usuarioId);
        }

        if (estanciaDocumento != null && !estanciaDocumento.isEmpty()) {
            validarArchivo(estanciaDocumento, Documento.TipoDocumento.ESTANCIA_INVESTIGACION);
            Documento doc = crearDocumento(usuario, estanciaDocumento, Documento.TipoDocumento.ESTANCIA_INVESTIGACION, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Documento de estancia guardado para usuario: {}", usuarioId);
        }

        if (divulgArchivo != null && !divulgArchivo.isEmpty()) {
            validarArchivo(divulgArchivo, Documento.TipoDocumento.DIVULGACION);
            Documento doc = crearDocumento(usuario, divulgArchivo, Documento.TipoDocumento.DIVULGACION, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Archivo de divulgación guardado para usuario: {}", usuarioId);
        }

        return documentosGuardados;
    }

    /**
     * Crea el directorio del usuario si no existe
     * Estructura: {uploadBaseDirectory}/{usuarioId}/
     * 
     * Ejemplos:
     * - Desarrollo: usuarios/1/
     * - Producción (configurado): /var/app/comecyt/usuarios/1/
     */
    /**
     * Crea el directorio del usuario si no existe
     * Estructura: {uploadBaseDirectory}/{usuarioId}/
     * 
     * Ejemplos:
     * - Desarrollo: usuarios/1/ (en la raíz del proyecto)
     * - Producción (configurado): /var/app/comecyt/usuarios/1/
     */
    private Path crearDirectorioUsuario(Long usuarioId) throws IOException {
        // Crear ruta: {uploadBaseDirectory}/{usuarioId}/
        // Funciona con rutas relativas (desde donde se ejecuta) y absolutas
        Path baseDir = Paths.get(uploadBaseDirectory, String.valueOf(usuarioId));
        
        if (!Files.exists(baseDir)) {
            Files.createDirectories(baseDir);
            log.info("Directorio creado para usuario {}: {}", usuarioId, baseDir.toAbsolutePath());
        }
        return baseDir;
    }

    /**
     * Guarda el archivo físicamente y crea el registro en BD
     */
    private Documento crearDocumento(Usuario usuario, MultipartFile archivo, Documento.TipoDocumento tipo, Path usuarioDir) throws IOException {
        // Guardar archivo físicamente en la carpeta del usuario
        String nombreArchivo = archivo.getOriginalFilename();
        if (nombreArchivo == null || nombreArchivo.isEmpty()) {
            nombreArchivo = tipo.name() + "_" + System.currentTimeMillis();
        }
        
        // Prevenir nombres de archivo duplicados
        String nombreFinal = generarNombreArchivo(tipo, nombreArchivo, usuarioDir);
        Path archivoPath = usuarioDir.resolve(nombreFinal);
        Files.copy(archivo.getInputStream(), archivoPath, StandardCopyOption.REPLACE_EXISTING);
        
        log.info("Archivo guardado físicamente: {}", archivoPath.toAbsolutePath());

        // Crear registro en BD con BLOB (mantenemos compatibilidad)
        return Documento.builder()
                .usuario(usuario)
                .tipo(tipo)
                .nombreArchivo(nombreFinal)
                .contentType(archivo.getContentType() != null ? archivo.getContentType() : "application/octet-stream")
                .sizeBytes(archivo.getSize())
                .contenido(archivo.getBytes()) // También guardamos como BLOB en BD
                .build();
    }

    /**
     * Genera un nombre único para el archivo
     */
    private String generarNombreArchivo(Documento.TipoDocumento tipo, String nombreOriginal, Path usuarioDir) {
        String nombreBase = tipo.name() + "_" + nombreOriginal;
        Path archivoPath = usuarioDir.resolve(nombreBase);
        
        if (!Files.exists(archivoPath)) {
            return nombreBase;
        }
        
        // Si existe, agregar timestamp
        int puntoExtension = nombreOriginal.lastIndexOf('.');
        if (puntoExtension > 0) {
            String sinExtension = nombreOriginal.substring(0, puntoExtension);
            String extension = nombreOriginal.substring(puntoExtension);
            return tipo.name() + "_" + sinExtension + "_" + System.currentTimeMillis() + extension;
        }
        
        return tipo.name() + "_" + System.currentTimeMillis() + "_" + nombreOriginal;
    }

    private void validarArchivo(MultipartFile archivo, Documento.TipoDocumento tipo) {
        if (archivo.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("El archivo " + archivo.getOriginalFilename() + 
                    " excede el tamaño máximo permitido de 10MB");
        }
        if (tipo == Documento.TipoDocumento.ADJUNTO_POSTULACION) {
            if (!esFormatoSolicitud(archivo)) {
                throw new IllegalArgumentException("El archivo " + archivo.getOriginalFilename() + " debe estar en formato PDF, Word o Excel");
            }
            return;
        }
        if (tipo != Documento.TipoDocumento.FOTO_PERFIL && !esPdf(archivo)) {
            throw new IllegalArgumentException("El archivo " + archivo.getOriginalFilename() + " debe estar en formato PDF");
        }
    }

    private boolean esPdf(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) return false;
        String contentType = archivo.getContentType();
        String nombre = archivo.getOriginalFilename();
        boolean mimePdf = contentType != null && contentType.toLowerCase(Locale.ROOT).contains("pdf");
        boolean extPdf = nombre != null && nombre.toLowerCase(Locale.ROOT).endsWith(".pdf");
        return mimePdf || extPdf;
    }

    private boolean esFormatoSolicitud(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) return false;
        if (esPdf(archivo)) return true;
        String contentType = archivo.getContentType();
        String nombre = archivo.getOriginalFilename();
        String mime = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";
        String lower = nombre != null ? nombre.toLowerCase(Locale.ROOT) : "";
        return lower.endsWith(".doc")
                || lower.endsWith(".docx")
                || lower.endsWith(".xls")
                || lower.endsWith(".xlsx")
                || mime.contains("word")
                || mime.contains("excel")
                || mime.contains("spreadsheet");
    }

    /**
     * Obtiene todos los documentos de un usuario
     */
    public List<Documento> obtenerDocumentosPorUsuario(Long usuarioId) {
        return documentoRepository.findByUsuarioId(usuarioId);
    }

    /**
     * Obtiene un documento específico
     */
    public java.util.Optional<Documento> obtenerDocumento(Long documentoId) {
        return documentoRepository.findById(documentoId);
    }

    /**
     * Descarga un documento (retorna los bytes)
     */
    public byte[] descargarDocumento(Long documentoId) {
        return documentoRepository.findById(documentoId)
                .map(Documento::getContenido)
                .orElseThrow(() -> new RuntimeException("Documento no encontrado"));
    }

    /**
     * Elimina todos los documentos de un usuario (incluye archivos físicos)
     */
    @Transactional
    public void eliminarDocumentosPorUsuario(Long usuarioId) {
        List<Documento> documentos = documentoRepository.findByUsuarioId(usuarioId);
        // Eliminar archivos físicos
        Path usuarioDir = Paths.get(uploadBaseDirectory, String.valueOf(usuarioId));
        if (Files.exists(usuarioDir)) {
            for (Documento doc : documentos) {
                try {
                    Path archivoPath = usuarioDir.resolve(doc.getNombreArchivo());
                    if (Files.exists(archivoPath)) {
                        Files.delete(archivoPath);
                        log.info("Archivo físico eliminado: {}", archivoPath.toAbsolutePath());
                    }
                } catch (IOException e) {
                    log.warn("No se pudo eliminar archivo físico: {}", e.getMessage());
                }
            }
        }
        documentoRepository.deleteAll(documentos);
        log.info("Documentos eliminados para usuario: {}", usuarioId);
    }

    /**
     * Guarda un documento para un usuario (foto o curriculum)
     * Guarda físicamente en carpeta del usuario
     */
    @Transactional
    public Documento guardarDocumentoUsuario(Long usuarioId, MultipartFile archivo, Documento.TipoDocumento tipo) throws IOException {
        validarArchivo(archivo, tipo);
        
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + usuarioId));
        
        // Crear carpeta del usuario si no existe
        Path usuarioDir = crearDirectorioUsuario(usuarioId);
        
        // Eliminar documento anterior del mismo tipo para este usuario
        documentoRepository.findByUsuarioIdAndTipo(usuarioId, tipo)
                .ifPresent(doc -> {
                    // Eliminar archivo físico si existe
                    try {
                        Path archivoAnterior = usuarioDir.resolve(doc.getNombreArchivo());
                        if (Files.exists(archivoAnterior)) {
                            Files.delete(archivoAnterior);
                        }
                    } catch (IOException e) {
                        log.warn("No se pudo eliminar archivo físico anterior: {}", e.getMessage());
                    }
                    documentoRepository.delete(doc);
                });
        
        // Guardar archivo físicamente
        String nombreArchivo = archivo.getOriginalFilename();
        if (nombreArchivo == null || nombreArchivo.isEmpty()) {
            nombreArchivo = tipo.name() + "_" + System.currentTimeMillis();
        }
        String nombreFinal = generarNombreArchivo(tipo, nombreArchivo, usuarioDir);
        Path archivoPath = usuarioDir.resolve(nombreFinal);
        
        // Leer bytes del archivo una vez para reutilizar
        byte[] archivoBytes = archivo.getBytes();
        
        Files.copy(archivo.getInputStream(), archivoPath, StandardCopyOption.REPLACE_EXISTING);
        
        log.info("Documento guardado físicamente: {}", archivoPath.toAbsolutePath());
        
        // Crear registro en BD
        Documento documentoGuardado = documentoRepository.save(Documento.builder()
                .usuario(usuario)
                .tipo(tipo)
                .nombreArchivo(nombreFinal)
                .contentType(archivo.getContentType() != null ? archivo.getContentType() : "application/octet-stream")
                .sizeBytes(archivo.getSize())
                .contenido(archivoBytes)
                .build());
        
        // Sincronizar CV y CURRICULUM: si se guarda uno, también actualizar el otro
        if (tipo == Documento.TipoDocumento.CURRICULUM) {
            // Si se guarda CURRICULUM, también sincronizar CV
            documentoRepository.findByUsuarioIdAndTipo(usuarioId, Documento.TipoDocumento.CV)
                    .ifPresent(docAnterior -> {
                        try {
                            Path archivoAnterior = usuarioDir.resolve(docAnterior.getNombreArchivo());
                            if (Files.exists(archivoAnterior)) {
                                Files.delete(archivoAnterior);
                            }
                        } catch (IOException e) {
                            log.warn("No se pudo eliminar CV anterior: {}", e.getMessage());
                        }
                        documentoRepository.delete(docAnterior);
                    });
            
            // Crear nuevo CV con el mismo contenido
            String nombreCV = generarNombreArchivo(Documento.TipoDocumento.CV, nombreArchivo, usuarioDir);
            Path archivoCVPath = usuarioDir.resolve(nombreCV);
            Files.copy(archivoPath, archivoCVPath, StandardCopyOption.REPLACE_EXISTING);
            
            documentoRepository.save(Documento.builder()
                    .usuario(usuario)
                    .tipo(Documento.TipoDocumento.CV)
                    .nombreArchivo(nombreCV)
                    .contentType(archivo.getContentType() != null ? archivo.getContentType() : "application/octet-stream")
                    .sizeBytes(archivo.getSize())
                    .contenido(archivoBytes)
                    .build());
            log.info("CV sincronizado con currículum para usuario: {}", usuarioId);
        } else if (tipo == Documento.TipoDocumento.CV) {
            // Si se guarda CV, también sincronizar CURRICULUM
            documentoRepository.findByUsuarioIdAndTipo(usuarioId, Documento.TipoDocumento.CURRICULUM)
                    .ifPresent(docAnterior -> {
                        try {
                            Path archivoAnterior = usuarioDir.resolve(docAnterior.getNombreArchivo());
                            if (Files.exists(archivoAnterior)) {
                                Files.delete(archivoAnterior);
                            }
                        } catch (IOException e) {
                            log.warn("No se pudo eliminar currículum anterior: {}", e.getMessage());
                        }
                        documentoRepository.delete(docAnterior);
                    });
            
            // Crear nuevo CURRICULUM con el mismo contenido
            String nombreCurriculum = generarNombreArchivo(Documento.TipoDocumento.CURRICULUM, nombreArchivo, usuarioDir);
            Path archivoCurriculumPath = usuarioDir.resolve(nombreCurriculum);
            Files.copy(archivoPath, archivoCurriculumPath, StandardCopyOption.REPLACE_EXISTING);
            
            documentoRepository.save(Documento.builder()
                    .usuario(usuario)
                    .tipo(Documento.TipoDocumento.CURRICULUM)
                    .nombreArchivo(nombreCurriculum)
                    .contentType(archivo.getContentType() != null ? archivo.getContentType() : "application/octet-stream")
                    .sizeBytes(archivo.getSize())
                    .contenido(archivoBytes)
                    .build());
            log.info("Currículum sincronizado con CV para usuario: {}", usuarioId);
        }
        
        return documentoGuardado;
    }

    /**
     * Obtiene un documento de un usuario por tipo
     */
    public java.util.Optional<Documento> obtenerDocumentoPorUsuarioYTipo(Long usuarioId, Documento.TipoDocumento tipo) {
        return documentoRepository.findByUsuarioIdAndTipo(usuarioId, tipo);
    }

    /**
     * Obtiene documentos de un usuario por lista de tipos
     */
    public List<Documento> obtenerDocumentosPorUsuarioYTipo(Long usuarioId, List<Documento.TipoDocumento> tipos) {
        return documentoRepository.findByUsuarioIdAndTipoIn(usuarioId, tipos);
    }

    /**
     * Guarda un documento con nombre personalizado
     * @param eliminarAnteriores Si es true, elimina documentos anteriores del mismo tipo. Si es false, permite múltiples documentos del mismo tipo.
     */
    @Transactional
    public Documento guardarDocumento(Long usuarioId, MultipartFile archivo, Documento.TipoDocumento tipo, String nombrePersonalizado, boolean eliminarAnteriores) throws IOException {
        validarArchivo(archivo, tipo);
        
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + usuarioId));
        
        Path usuarioDir = crearDirectorioUsuario(usuarioId);
        
        // Eliminar documento anterior del mismo tipo solo si se solicita
        if (eliminarAnteriores) {
            documentoRepository.findByUsuarioIdAndTipo(usuarioId, tipo)
                    .ifPresent(doc -> {
                        try {
                            Path archivoAnterior = usuarioDir.resolve(doc.getNombreArchivo());
                            if (Files.exists(archivoAnterior)) {
                                Files.delete(archivoAnterior);
                            }
                        } catch (IOException e) {
                            log.warn("No se pudo eliminar archivo físico anterior: {}", e.getMessage());
                        }
                        documentoRepository.delete(doc);
                    });
        }
        
        String nombreArchivo = nombrePersonalizado != null && !nombrePersonalizado.isEmpty() 
                ? nombrePersonalizado 
                : archivo.getOriginalFilename();
        if (nombreArchivo == null || nombreArchivo.isEmpty()) {
            nombreArchivo = tipo.name() + "_" + System.currentTimeMillis();
        }
        String nombreFinal = generarNombreArchivo(tipo, nombreArchivo, usuarioDir);
        Path archivoPath = usuarioDir.resolve(nombreFinal);
        
        byte[] archivoBytes = archivo.getBytes();
        Files.copy(archivo.getInputStream(), archivoPath, StandardCopyOption.REPLACE_EXISTING);
        
        log.info("Documento guardado físicamente: {}", archivoPath.toAbsolutePath());
        
        Documento documentoGuardado = documentoRepository.save(Documento.builder()
                .usuario(usuario)
                .tipo(tipo)
                .nombreArchivo(nombreFinal)
                .contentType(archivo.getContentType() != null ? archivo.getContentType() : "application/octet-stream")
                .sizeBytes(archivo.getSize())
                .contenido(archivoBytes)
                .build());
        
        return documentoGuardado;
    }

    /**
     * Guarda un documento generado en servidor (sin MultipartFile), por ejemplo cartas/dictamenes/constancias.
     */
    @Transactional
    public Documento guardarDocumentoGenerado(Long usuarioId,
                                              Documento.TipoDocumento tipo,
                                              String nombrePersonalizado,
                                              String contentType,
                                              byte[] contenido,
                                              boolean eliminarAnteriores) throws IOException {
        if (contenido == null || contenido.length == 0) {
            throw new IllegalArgumentException("El contenido del documento generado no puede estar vacío");
        }
        if (contenido.length > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("El documento generado excede el tamaño máximo permitido de 10MB");
        }
        String ct = contentType != null && !contentType.isBlank() ? contentType.trim() : "application/octet-stream";
        if (tipo != Documento.TipoDocumento.FOTO_PERFIL && !ct.toLowerCase(Locale.ROOT).contains("pdf")) {
            throw new IllegalArgumentException("Solo se permiten documentos PDF para este tipo");
        }

        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + usuarioId));
        Path usuarioDir = crearDirectorioUsuario(usuarioId);

        if (eliminarAnteriores) {
            documentoRepository.findByUsuarioIdAndTipo(usuarioId, tipo).ifPresent(doc -> {
                try {
                    Path archivoAnterior = usuarioDir.resolve(doc.getNombreArchivo());
                    if (Files.exists(archivoAnterior)) {
                        Files.delete(archivoAnterior);
                    }
                } catch (IOException e) {
                    log.warn("No se pudo eliminar archivo físico anterior: {}", e.getMessage());
                }
                documentoRepository.delete(doc);
            });
        }

        String nombre = (nombrePersonalizado != null && !nombrePersonalizado.isBlank())
                ? nombrePersonalizado.trim()
                : (tipo.name() + "_" + System.currentTimeMillis() + ".pdf");
        if (!nombre.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            nombre = nombre + ".pdf";
        }
        String nombreFinal = generarNombreArchivo(tipo, nombre, usuarioDir);
        Path archivoPath = usuarioDir.resolve(nombreFinal);
        Files.write(archivoPath, contenido);

        return documentoRepository.save(Documento.builder()
                .usuario(usuario)
                .tipo(tipo)
                .nombreArchivo(nombreFinal)
                .contentType(ct)
                .sizeBytes(contenido.length)
                .contenido(contenido)
                .build());
    }

    /**
     * Elimina un documento específico
     */
    @Transactional
    public void eliminarDocumento(Long documentoId, Long usuarioId) {
        Documento documento = documentoRepository.findById(documentoId)
                .orElseThrow(() -> new RuntimeException("Documento no encontrado"));
        
        if (!documento.getUsuario().getId().equals(usuarioId)) {
            throw new RuntimeException("No autorizado para eliminar este documento");
        }
        
        // Eliminar archivo físico
        Path usuarioDir = Paths.get(uploadBaseDirectory, String.valueOf(usuarioId));
        try {
            Path archivoPath = usuarioDir.resolve(documento.getNombreArchivo());
            if (Files.exists(archivoPath)) {
                Files.delete(archivoPath);
                log.info("Archivo físico eliminado: {}", archivoPath.toAbsolutePath());
            }
        } catch (IOException e) {
            log.warn("No se pudo eliminar archivo físico: {}", e.getMessage());
        }
        
        documentoRepository.delete(documento);
        log.info("Documento eliminado: {}", documentoId);
    }
}
