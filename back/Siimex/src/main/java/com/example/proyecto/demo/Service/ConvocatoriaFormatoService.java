package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.Convocatoria;
import com.example.proyecto.demo.Entity.ConvocatoriaFormato;
import com.example.proyecto.demo.Repository.ConvocatoriaFormatoRepository;
import com.example.proyecto.demo.Repository.ConvocatoriaRepository;
import com.example.proyecto.demo.exception.ApiException;
import com.example.proyecto.demo.util.FileSecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ConvocatoriaFormatoService {

    private static final long MAX_FORMATO_SIZE = 10L * 1024L * 1024L;
    private final ConvocatoriaRepository convocatoriaRepository;
    private final ConvocatoriaFormatoRepository formatoRepository;

    public List<Map<String, Object>> listar(Long convocatoriaId) {
        return formatoRepository.findByConvocatoriaIdOrderByFechaSubidaAsc(convocatoriaId).stream()
                .map(this::toMap)
                .toList();
    }

    public List<Map<String, Object>> listarPublicos(Long convocatoriaId) {
        return formatoRepository.findByConvocatoriaIdOrderByFechaSubidaAsc(convocatoriaId).stream()
                .filter(f -> "SOLICITUD".equalsIgnoreCase(normalizarUso(f.getUso())))
                .map(this::toMap)
                .toList();
    }

    public java.util.Optional<ConvocatoriaFormato> obtenerDocumentoAceptacion(Long convocatoriaId) {
        return formatoRepository.findFirstByConvocatoriaIdAndUsoIgnoreCaseOrderByFechaSubidaDesc(convocatoriaId, "ACEPTACION");
    }

    public java.util.Optional<ConvocatoriaFormato> obtenerFormatoConstanciaFinal(Long convocatoriaId) {
        return formatoRepository.findFirstByConvocatoriaIdAndUsoIgnoreCaseOrderByFechaSubidaDesc(convocatoriaId, "CONSTANCIA");
    }

    public java.util.Optional<ConvocatoriaFormato> obtenerFormatoCartaCierre(Long convocatoriaId) {
        return formatoRepository.findFirstByConvocatoriaIdAndUsoIgnoreCaseOrderByFechaSubidaDesc(convocatoriaId, "CARTA_CIERRE");
    }

    @Transactional
    public Map<String, Object> guardar(Long convocatoriaId, MultipartFile file, String nombre, String descripcion) throws IOException {
        return guardar(convocatoriaId, file, nombre, descripcion, "SOLICITUD");
    }

    @Transactional
    public Map<String, Object> guardar(Long convocatoriaId, MultipartFile file, String nombre, String descripcion, String uso) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Selecciona un archivo de formato");
        }
        validarArchivo(file);
        Convocatoria convocatoria = convocatoriaRepository.findById(convocatoriaId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Convocatoria no encontrada"));
        String nombreArchivo = limpiarNombreArchivo(file.getOriginalFilename());
        String nombreVisible = texto(nombre);
        if (nombreVisible == null) {
            nombreVisible = quitarExtension(nombreArchivo);
        }
        byte[] contenidoLimpio;
        try {
            contenidoLimpio = FileSecurityUtils.stripDocumentMetadata(file.getBytes(), nombreArchivo);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No se pudo procesar el archivo");
        }
        ConvocatoriaFormato formato = formatoRepository.save(ConvocatoriaFormato.builder()
                .convocatoria(convocatoria)
                .nombre(limitar(nombreVisible, 180))
                .descripcion(limitar(texto(descripcion), 500))
                .uso(normalizarUso(uso))
                .nombreArchivo(nombreArchivo)
                .contentType(FileSecurityUtils.safeContentTypeForFilename(nombreArchivo))
                .sizeBytes((long) contenidoLimpio.length)
                .contenido(contenidoLimpio)
                .build());
        return toMap(formato);
    }

    public ConvocatoriaFormato obtener(Long convocatoriaId, Long formatoId) {
        return formatoRepository.findByIdAndConvocatoriaId(formatoId, convocatoriaId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Formato no encontrado"));
    }

    public ConvocatoriaFormato obtenerPublico(Long convocatoriaId, Long formatoId) {
        ConvocatoriaFormato formato = obtener(convocatoriaId, formatoId);
        if (!"SOLICITUD".equalsIgnoreCase(normalizarUso(formato.getUso()))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Formato no encontrado");
        }
        return formato;
    }

    @Transactional
    public void eliminar(Long convocatoriaId, Long formatoId) {
        ConvocatoriaFormato formato = obtener(convocatoriaId, formatoId);
        formatoRepository.delete(formato);
    }

    @Transactional
    public void eliminarPorConvocatoria(Long convocatoriaId) {
        formatoRepository.deleteByConvocatoriaId(convocatoriaId);
    }

    private Map<String, Object> toMap(ConvocatoriaFormato formato) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", formato.getId());
        m.put("convocatoriaId", formato.getConvocatoria() != null ? formato.getConvocatoria().getId() : null);
        m.put("nombre", formato.getNombre());
        m.put("descripcion", formato.getDescripcion());
        m.put("uso", normalizarUso(formato.getUso()));
        m.put("nombreArchivo", formato.getNombreArchivo());
        m.put("contentType", formato.getContentType());
        m.put("sizeBytes", formato.getSizeBytes());
        m.put("fechaSubida", formato.getFechaSubida() != null ? formato.getFechaSubida().toString() : null);
        return m;
    }

    private String normalizarUso(String uso) {
        String v = uso != null ? uso.trim().toUpperCase(java.util.Locale.ROOT) : "";
        if ("ACEPTACION".equals(v)) return "ACEPTACION";
        if ("CONSTANCIA".equals(v) || "CONSTANCIA_FINAL".equals(v)) return "CONSTANCIA";
        if ("CARTA_CIERRE".equals(v) || "CIERRE".equals(v)) return "CARTA_CIERRE";
        return "SOLICITUD";
    }

    private void validarArchivo(MultipartFile file) {
        if (file.getSize() > MAX_FORMATO_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El formato no puede superar 10 MB");
        }
        if (!FileSecurityUtils.isPdf(file) && !FileSecurityUtils.isOfficeDocument(file)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo se permiten formatos PDF, DOCX o XLSX");
        }
    }

    private String limpiarNombreArchivo(String original) {
        return limitar(FileSecurityUtils.sanitizeFilename(original, "formato_" + System.currentTimeMillis()), 255);
    }

    private String quitarExtension(String nombreArchivo) {
        int idx = nombreArchivo.lastIndexOf('.');
        return idx > 0 ? nombreArchivo.substring(0, idx) : nombreArchivo;
    }

    private String texto(String value) {
        if (value == null) return null;
        String limpio = value.trim();
        return limpio.isEmpty() ? null : limpio;
    }

    private String limitar(String value, int max) {
        if (value == null) return null;
        return value.length() > max ? value.substring(0, max) : value;
    }
}




