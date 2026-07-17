package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.DocumentoRepository;
import com.example.proyecto.demo.Repository.UsuarioRepository;
import com.example.proyecto.demo.util.FileSecurityUtils;
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

    @Value("${app.upload.directory}")
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
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CV, usuarioDir);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CURRICULUM, usuarioDir);

            Documento docCV = crearDocumento(usuario, cvFile, Documento.TipoDocumento.CV, usuarioDir);
            documentosGuardados.add(documentoRepository.save(docCV));
            log.info("CV guardado para usuario: {}", usuarioId);
            
            Documento docCurriculum = crearDocumento(usuario, cvFile, Documento.TipoDocumento.CURRICULUM, usuarioDir);
            documentosGuardados.add(documentoRepository.save(docCurriculum));
            log.info("Currículum sincronizado con CV para usuario: {}", usuarioId);
        }

        if (fiscalPdf != null && !fiscalPdf.isEmpty()) {
            validarArchivo(fiscalPdf, Documento.TipoDocumento.FISCAL_PDF);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.FISCAL_PDF, usuarioDir);
            Documento doc = crearDocumento(usuario, fiscalPdf, Documento.TipoDocumento.FISCAL_PDF, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Fiscal PDF guardado para usuario: {}", usuarioId);
        }

        if (domicilio != null && !domicilio.isEmpty()) {
            validarArchivo(domicilio, Documento.TipoDocumento.DOMICILIO);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.DOMICILIO, usuarioDir);
            Documento doc = crearDocumento(usuario, domicilio, Documento.TipoDocumento.DOMICILIO, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Domicilio guardado para usuario: {}", usuarioId);
        }

        if (cert1 != null && !cert1.isEmpty()) {
            validarArchivo(cert1, Documento.TipoDocumento.CERTIFICADO_1);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CERTIFICADO_1, usuarioDir);
            Documento doc = crearDocumento(usuario, cert1, Documento.TipoDocumento.CERTIFICADO_1, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Certificado 1 guardado para usuario: {}", usuarioId);
        }

        if (cert2 != null && !cert2.isEmpty()) {
            validarArchivo(cert2, Documento.TipoDocumento.CERTIFICADO_2);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CERTIFICADO_2, usuarioDir);
            Documento doc = crearDocumento(usuario, cert2, Documento.TipoDocumento.CERTIFICADO_2, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Certificado 2 guardado para usuario: {}", usuarioId);
        }

        if (idiomaCertDocumento != null && !idiomaCertDocumento.isEmpty()) {
            validarArchivo(idiomaCertDocumento, Documento.TipoDocumento.CERTIFICACION_IDIOMA);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CERTIFICACION_IDIOMA, usuarioDir);
            Documento doc = crearDocumento(usuario, idiomaCertDocumento, Documento.TipoDocumento.CERTIFICACION_IDIOMA, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Certificación de idioma guardada para usuario: {}", usuarioId);
        }

        if (constanciaSnii != null && !constanciaSnii.isEmpty()) {
            validarArchivo(constanciaSnii, Documento.TipoDocumento.CONSTANCIA_SNII);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CONSTANCIA_SNII, usuarioDir);
            Documento doc = crearDocumento(usuario, constanciaSnii, Documento.TipoDocumento.CONSTANCIA_SNII, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Constancia SNII guardada para usuario: {}", usuarioId);
        }

        if (estanciaDocumento != null && !estanciaDocumento.isEmpty()) {
            validarArchivo(estanciaDocumento, Documento.TipoDocumento.ESTANCIA_INVESTIGACION);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.ESTANCIA_INVESTIGACION, usuarioDir);
            Documento doc = crearDocumento(usuario, estanciaDocumento, Documento.TipoDocumento.ESTANCIA_INVESTIGACION, usuarioDir);
            documentosGuardados.add(documentoRepository.save(doc));
            log.info("Documento de estancia guardado para usuario: {}", usuarioId);
        }

        if (divulgArchivo != null && !divulgArchivo.isEmpty()) {
            validarArchivo(divulgArchivo, Documento.TipoDocumento.DIVULGACION);
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.DIVULGACION, usuarioDir);
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
        Path baseDir = Paths.get(uploadBaseDirectory, String.valueOf(usuarioId)).toAbsolutePath().normalize();
        
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
        String nombreArchivo = FileSecurityUtils.sanitizeFilename(
                archivo.getOriginalFilename(),
                tipo.name() + "_" + System.currentTimeMillis()
        );
        
        // Prevenir nombres de archivo duplicados
        String nombreFinal = generarNombreArchivo(tipo, nombreArchivo, usuarioDir);
        Path archivoPath = FileSecurityUtils.resolveInside(usuarioDir, nombreFinal);
        byte[] archivoBytes = bytesParaGuardar(archivo, tipo, nombreFinal);
        Files.write(archivoPath, archivoBytes);
        
        log.info("Archivo guardado físicamente: {}", archivoPath.toAbsolutePath());

        // Crear registro en BD con BLOB (mantenemos compatibilidad)
        return Documento.builder()
                .usuario(usuario)
                .tipo(tipo)
                .nombreArchivo(nombreFinal)
                .contentType(FileSecurityUtils.safeContentTypeForFilename(nombreFinal))
                .sizeBytes((long) archivoBytes.length)
                .contenido(archivoBytes) // También guardamos como BLOB en BD
                .build();
    }

    /**
     * Genera un nombre único para el archivo
     */
    private String generarNombreArchivo(Documento.TipoDocumento tipo, String nombreOriginal, Path usuarioDir) {
        String nombreSeguro = FileSecurityUtils.sanitizeFilename(nombreOriginal, tipo.name() + "_" + System.currentTimeMillis());
        String nombreBase = FileSecurityUtils.sanitizeFilename(tipo.name() + "_" + nombreSeguro, tipo.name() + "_" + System.currentTimeMillis());
        Path archivoPath = FileSecurityUtils.resolveInside(usuarioDir, nombreBase);
        
        if (!Files.exists(archivoPath)) {
            return nombreBase;
        }
        
        // Si existe, agregar timestamp
        int puntoExtension = nombreSeguro.lastIndexOf('.');
        if (puntoExtension > 0) {
            String sinExtension = nombreSeguro.substring(0, puntoExtension);
            String extension = nombreSeguro.substring(puntoExtension);
            return FileSecurityUtils.sanitizeFilename(tipo.name() + "_" + sinExtension + "_" + System.currentTimeMillis() + extension, tipo.name() + "_" + System.currentTimeMillis());
        }
        
        return FileSecurityUtils.sanitizeFilename(tipo.name() + "_" + System.currentTimeMillis() + "_" + nombreSeguro, tipo.name() + "_" + System.currentTimeMillis());
    }

    private void validarArchivo(MultipartFile archivo, Documento.TipoDocumento tipo) {
        if (archivo.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("El archivo " + archivo.getOriginalFilename() + 
                    " excede el tamaño máximo permitido de 10MB");
        }
        if (tipo == Documento.TipoDocumento.ADJUNTO_POSTULACION) {
            if (!esFormatoSolicitud(archivo)) {
                throw new IllegalArgumentException("El archivo " + archivo.getOriginalFilename() + " debe estar en formato PDF, DOCX o XLSX");
            }
            return;
        }
        if (tipo == Documento.TipoDocumento.FOTO_PERFIL) {
            if (!FileSecurityUtils.isAllowedImage(archivo)) {
                throw new IllegalArgumentException("El archivo " + archivo.getOriginalFilename() + " debe ser una imagen válida PNG, JPG, GIF o WEBP");
            }
            return;
        }
        if (tipo != Documento.TipoDocumento.FOTO_PERFIL && !esPdf(archivo)) {
            throw new IllegalArgumentException("El archivo " + archivo.getOriginalFilename() + " debe estar en formato PDF");
        }
    }

    private boolean esPdf(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) return false;
        return FileSecurityUtils.isPdf(archivo);
    }

    private boolean esFormatoSolicitud(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) return false;
        if (esPdf(archivo)) return true;
        return FileSecurityUtils.isOfficeDocument(archivo);
    }

    private byte[] bytesParaGuardar(MultipartFile archivo, Documento.TipoDocumento tipo, String nombreFinal) throws IOException {
        byte[] archivoBytes = archivo.getBytes();
        if (tipo == Documento.TipoDocumento.FOTO_PERFIL) {
            return FileSecurityUtils.stripImageMetadata(archivoBytes, nombreFinal);
        }
        if (tipo != Documento.TipoDocumento.FOTO_PERFIL) {
            return FileSecurityUtils.stripDocumentMetadata(archivoBytes, nombreFinal);
        }
        return archivoBytes;
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
        Path usuarioDir = Paths.get(uploadBaseDirectory, String.valueOf(usuarioId)).toAbsolutePath().normalize();
        if (Files.exists(usuarioDir)) {
            for (Documento doc : documentos) {
                try {
                    Path archivoPath = FileSecurityUtils.resolveInside(usuarioDir, doc.getNombreArchivo());
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
        eliminarDocumentosPorTipo(usuarioId, tipo, usuarioDir);
        
        // Guardar archivo físicamente
        String nombreArchivo = FileSecurityUtils.sanitizeFilename(
                archivo.getOriginalFilename(),
                tipo.name() + "_" + System.currentTimeMillis()
        );
        String nombreFinal = generarNombreArchivo(tipo, nombreArchivo, usuarioDir);
        Path archivoPath = FileSecurityUtils.resolveInside(usuarioDir, nombreFinal);
        
        // Leer bytes del archivo una vez para reutilizar
        byte[] archivoBytes = bytesParaGuardar(archivo, tipo, nombreFinal);

        Files.write(archivoPath, archivoBytes);
        
        log.info("Documento guardado físicamente: {}", archivoPath.toAbsolutePath());
        
        // Crear registro en BD
        Documento documentoGuardado = documentoRepository.save(Documento.builder()
                .usuario(usuario)
                .tipo(tipo)
                .nombreArchivo(nombreFinal)
                .contentType(FileSecurityUtils.safeContentTypeForFilename(nombreFinal))
                .sizeBytes(archivo.getSize())
                .contenido(archivoBytes)
                .build());
        
        // Sincronizar CV y CURRICULUM: si se guarda uno, también actualizar el otro
        if (tipo == Documento.TipoDocumento.CURRICULUM) {
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CV, usuarioDir);
            
            // Crear nuevo CV con el mismo contenido
            String nombreCV = generarNombreArchivo(Documento.TipoDocumento.CV, nombreArchivo, usuarioDir);
            Path archivoCVPath = FileSecurityUtils.resolveInside(usuarioDir, nombreCV);
            Files.copy(archivoPath, archivoCVPath, StandardCopyOption.REPLACE_EXISTING);
            
            documentoRepository.save(Documento.builder()
                    .usuario(usuario)
                    .tipo(Documento.TipoDocumento.CV)
                    .nombreArchivo(nombreCV)
                    .contentType(FileSecurityUtils.safeContentTypeForFilename(nombreCV))
                    .sizeBytes(archivo.getSize())
                    .contenido(archivoBytes)
                    .build());
            log.info("CV sincronizado con currículum para usuario: {}", usuarioId);
        } else if (tipo == Documento.TipoDocumento.CV) {
            eliminarDocumentosPorTipo(usuarioId, Documento.TipoDocumento.CURRICULUM, usuarioDir);
            
            // Crear nuevo CURRICULUM con el mismo contenido
            String nombreCurriculum = generarNombreArchivo(Documento.TipoDocumento.CURRICULUM, nombreArchivo, usuarioDir);
            Path archivoCurriculumPath = FileSecurityUtils.resolveInside(usuarioDir, nombreCurriculum);
            Files.copy(archivoPath, archivoCurriculumPath, StandardCopyOption.REPLACE_EXISTING);
            
            documentoRepository.save(Documento.builder()
                    .usuario(usuario)
                    .tipo(Documento.TipoDocumento.CURRICULUM)
                    .nombreArchivo(nombreCurriculum)
                    .contentType(FileSecurityUtils.safeContentTypeForFilename(nombreCurriculum))
                    .sizeBytes(archivo.getSize())
                    .contenido(archivoBytes)
                    .build());
            log.info("Currículum sincronizado con CV para usuario: {}", usuarioId);
        }
        
        return documentoGuardado;
    }

    private List<Documento> obtenerDocumentosOrdenadosPorTipo(Long usuarioId, Documento.TipoDocumento tipo) {
        return documentoRepository.findAllByUsuarioIdAndTipoOrderByFechaSubidaDescIdDesc(usuarioId, tipo);
    }

    private void eliminarDocumentosPorTipo(Long usuarioId, Documento.TipoDocumento tipo, Path usuarioDir) {
        List<Documento> documentosExistentes = obtenerDocumentosOrdenadosPorTipo(usuarioId, tipo);
        if (documentosExistentes.isEmpty()) {
            return;
        }

        if (documentosExistentes.size() > 1) {
            log.warn("Se detectaron {} documentos duplicados para usuario {} y tipo {}. Se eliminarán antes de guardar el nuevo archivo.",
                    documentosExistentes.size(), usuarioId, tipo);
        }

        for (Documento doc : documentosExistentes) {
            try {
                Path archivoAnterior = FileSecurityUtils.resolveInside(usuarioDir, doc.getNombreArchivo());
                if (Files.exists(archivoAnterior)) {
                    Files.delete(archivoAnterior);
                }
            } catch (IOException e) {
                log.warn("No se pudo eliminar archivo físico anterior: {}", e.getMessage());
            }
            documentoRepository.delete(doc);
        }
    }

    /**
     * Obtiene un documento de un usuario por tipo
     */
    public java.util.Optional<Documento> obtenerDocumentoPorUsuarioYTipo(Long usuarioId, Documento.TipoDocumento tipo) {
        List<Documento> documentos = obtenerDocumentosOrdenadosPorTipo(usuarioId, tipo);
        if (documentos.size() > 1) {
            log.warn("Se detectaron {} documentos duplicados para usuario {} y tipo {}. Se devolverá el más reciente.",
                    documentos.size(), usuarioId, tipo);
        }
        return documentos.stream().findFirst();
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
            eliminarDocumentosPorTipo(usuarioId, tipo, usuarioDir);
        }
        
        String nombreArchivo = nombrePersonalizado != null && !nombrePersonalizado.isEmpty()
                ? FileSecurityUtils.sanitizeFilename(nombrePersonalizado, tipo.name() + "_" + System.currentTimeMillis())
                : archivo.getOriginalFilename();
        nombreArchivo = FileSecurityUtils.sanitizeFilename(nombreArchivo, tipo.name() + "_" + System.currentTimeMillis());
        String nombreFinal = generarNombreArchivo(tipo, nombreArchivo, usuarioDir);
        Path archivoPath = FileSecurityUtils.resolveInside(usuarioDir, nombreFinal);
        
        byte[] archivoBytes = bytesParaGuardar(archivo, tipo, nombreFinal);
        Files.write(archivoPath, archivoBytes);
        
        log.info("Documento guardado físicamente: {}", archivoPath.toAbsolutePath());
        
        Documento documentoGuardado = documentoRepository.save(Documento.builder()
                .usuario(usuario)
                .tipo(tipo)
                .nombreArchivo(nombreFinal)
                .contentType(FileSecurityUtils.safeContentTypeForFilename(nombreFinal))
                .sizeBytes((long) archivoBytes.length)
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
        if (tipo != Documento.TipoDocumento.FOTO_PERFIL && !FileSecurityUtils.hasPdfSignature(contenido)) {
            throw new IllegalArgumentException("El documento generado debe tener firma PDF válida");
        }

        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + usuarioId));
        Path usuarioDir = crearDirectorioUsuario(usuarioId);

        if (eliminarAnteriores) {
            eliminarDocumentosPorTipo(usuarioId, tipo, usuarioDir);
        }

        String nombre = (nombrePersonalizado != null && !nombrePersonalizado.isBlank())
                ? FileSecurityUtils.sanitizeFilename(nombrePersonalizado.trim(), tipo.name() + "_" + System.currentTimeMillis() + ".pdf")
                : (tipo.name() + "_" + System.currentTimeMillis() + ".pdf");
        if (!nombre.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            nombre = nombre + ".pdf";
        }
        String nombreFinal = generarNombreArchivo(tipo, nombre, usuarioDir);
        Path archivoPath = FileSecurityUtils.resolveInside(usuarioDir, nombreFinal);
        contenido = FileSecurityUtils.stripDocumentMetadata(contenido, nombreFinal);
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
        Path usuarioDir = Paths.get(uploadBaseDirectory, String.valueOf(usuarioId)).toAbsolutePath().normalize();
        try {
            Path archivoPath = FileSecurityUtils.resolveInside(usuarioDir, documento.getNombreArchivo());
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
