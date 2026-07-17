package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.Convocatoria;
import com.example.proyecto.demo.Entity.ConvocatoriaFormato;
import com.example.proyecto.demo.Repository.ConvocatoriaFormatoRepository;
import com.example.proyecto.demo.Repository.ConvocatoriaRepository;
import com.example.proyecto.demo.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ConvocatoriaFormatoService {

    private static final long MAX_FORMATO_SIZE = 10L * 1024L * 1024L;
    private static final List<String> EXTENSIONES_PERMITIDAS = List.of(".pdf", ".doc", ".docx", ".xls", ".xlsx");

    private final ConvocatoriaRepository convocatoriaRepository;
    private final ConvocatoriaFormatoRepository formatoRepository;

    public List<Map<String, Object>> listar(Long convocatoriaId) {
        return formatoRepository.findByConvocatoriaIdOrderByFechaSubidaAsc(convocatoriaId).stream()
                .map(this::toMap)
                .toList();
    }

    @Transactional
    public Map<String, Object> guardar(Long convocatoriaId, MultipartFile file, String nombre, String descripcion) throws IOException {
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
        ConvocatoriaFormato formato = formatoRepository.save(ConvocatoriaFormato.builder()
                .convocatoria(convocatoria)
                .nombre(limitar(nombreVisible, 180))
                .descripcion(limitar(texto(descripcion), 500))
                .nombreArchivo(nombreArchivo)
                .contentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                .sizeBytes(file.getSize())
                .contenido(file.getBytes())
                .build());
        return toMap(formato);
    }

    public ConvocatoriaFormato obtener(Long convocatoriaId, Long formatoId) {
        return formatoRepository.findByIdAndConvocatoriaId(formatoId, convocatoriaId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Formato no encontrado"));
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
        m.put("nombreArchivo", formato.getNombreArchivo());
        m.put("contentType", formato.getContentType());
        m.put("sizeBytes", formato.getSizeBytes());
        m.put("fechaSubida", formato.getFechaSubida() != null ? formato.getFechaSubida().toString() : null);
        return m;
    }

    private void validarArchivo(MultipartFile file) {
        if (file.getSize() > MAX_FORMATO_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El formato no puede superar 10 MB");
        }
        String nombre = file.getOriginalFilename();
        String lower = nombre != null ? nombre.toLowerCase(Locale.ROOT) : "";
        boolean extensionPermitida = EXTENSIONES_PERMITIDAS.stream().anyMatch(lower::endsWith);
        if (!extensionPermitida) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solo se permiten formatos PDF, Word o Excel");
        }
    }

    private String limpiarNombreArchivo(String original) {
        String nombre = original != null && !original.isBlank() ? original.trim() : "formato_" + System.currentTimeMillis();
        nombre = nombre.replaceAll("[\\\\/:*?\"<>|]+", "_");
        return limitar(nombre, 255);
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
