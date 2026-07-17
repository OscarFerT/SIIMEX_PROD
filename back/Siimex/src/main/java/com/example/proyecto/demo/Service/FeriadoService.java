package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.Feriado;
import com.example.proyecto.demo.Repository.FeriadoRepository;
import com.example.proyecto.demo.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FeriadoService {

    private final FeriadoRepository feriadoRepository;

    public List<Feriado> listarTodos() {
        return feriadoRepository.findAll().stream()
                .sorted((a, b) -> {
                    LocalDate fa = a.getFecha();
                    LocalDate fb = b.getFecha();
                    if (fa == null && fb == null) return 0;
                    if (fa == null) return 1;
                    if (fb == null) return -1;
                    return fa.compareTo(fb);
                })
                .toList();
    }

    public List<Feriado> listarActivos() {
        return feriadoRepository.findByActivoTrueOrderByFechaAsc();
    }

    public Feriado crear(LocalDate fecha, String nombre, Boolean activo) {
        if (fecha == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha del feriado es obligatoria");
        }
        String nombreLimpio = nombre != null ? nombre.trim() : "";
        if (nombreLimpio.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El nombre del feriado es obligatorio");
        }
        if (feriadoRepository.existsByFecha(fecha)) {
            throw new ApiException(HttpStatus.CONFLICT, "Ya existe un feriado registrado para esa fecha");
        }
        Feriado f = Feriado.builder()
                .fecha(fecha)
                .nombre(nombreLimpio.length() > 160 ? nombreLimpio.substring(0, 160) : nombreLimpio)
                .activo(activo == null || activo)
                .build();
        return feriadoRepository.save(f);
    }

    public Feriado actualizar(Long id, LocalDate fecha, String nombre, Boolean activo) {
        Feriado f = obtener(id);
        if (fecha == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La fecha del feriado es obligatoria");
        }
        String nombreLimpio = nombre != null ? nombre.trim() : "";
        if (nombreLimpio.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El nombre del feriado es obligatorio");
        }
        if (!fecha.equals(f.getFecha()) && feriadoRepository.existsByFecha(fecha)) {
            throw new ApiException(HttpStatus.CONFLICT, "Ya existe un feriado registrado para esa fecha");
        }
        f.setFecha(fecha);
        f.setNombre(nombreLimpio.length() > 160 ? nombreLimpio.substring(0, 160) : nombreLimpio);
        f.setActivo(activo == null || activo);
        return feriadoRepository.save(f);
    }

    public void eliminar(Long id) {
        if (!feriadoRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Feriado no encontrado");
        }
        feriadoRepository.deleteById(id);
    }

    public Feriado obtener(Long id) {
        return feriadoRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Feriado no encontrado"));
    }

    public long contarFeriadosEnRango(LocalDate desde, LocalDate hasta) {
        if (desde == null || hasta == null) return 0;
        if (hasta.isBefore(desde)) return 0;
        return feriadoRepository.countByActivoTrueAndFechaBetween(desde, hasta);
    }

    /**
     * Días naturales entre inicio (inclusive) y fin (exclusive) menos feriados activos en ese rango.
     */
    public long diasNaturalesSinFeriados(LocalDate inicioInclusive, LocalDate finExclusive) {
        if (inicioInclusive == null || finExclusive == null) return 0;
        if (!finExclusive.isAfter(inicioInclusive)) return 0;
        long dias = ChronoUnit.DAYS.between(inicioInclusive, finExclusive);
        long feriados = contarFeriadosEnRango(inicioInclusive, finExclusive.minusDays(1));
        long resultado = dias - feriados;
        return Math.max(resultado, 0);
    }

    public long diasNaturalesSinFeriadosInclusivo(LocalDate inicioInclusive, LocalDate finInclusive) {
        if (inicioInclusive == null || finInclusive == null) return 0;
        if (finInclusive.isBefore(inicioInclusive)) return 0;
        return diasNaturalesSinFeriados(inicioInclusive, finInclusive.plusDays(1));
    }

    public Map<String, Object> toMap(Feriado f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", f.getId());
        m.put("fecha", f.getFecha() != null ? f.getFecha().toString() : null);
        m.put("nombre", f.getNombre());
        m.put("activo", f.isActivo());
        m.put("createdAt", f.getCreatedAt() != null ? f.getCreatedAt().toString() : null);
        m.put("updatedAt", f.getUpdatedAt() != null ? f.getUpdatedAt().toString() : null);
        return m;
    }
}
