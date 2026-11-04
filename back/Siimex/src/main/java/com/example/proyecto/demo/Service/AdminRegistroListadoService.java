package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Repository.AdminRegistroRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminRegistroListadoService {
    private final AdminRegistroRepository repository;

    public Map<String, Object> listar(int page, int size, String busqueda, String perfil, String sexo,
                                    String entidad, String municipio, boolean incluirOpciones) {
        String texto = limpiar(busqueda).toLowerCase(Locale.ROOT);
        var pagina = repository.buscar(patron(texto), patron(texto.replaceAll("\\s", "")),
                limpiar(perfil), limpiar(sexo), limpiar(entidad), limpiar(municipio), LocalDate.now(),
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100))));
        List<Long> authIds = pagina.getContent().stream().map(AdminRegistroRepository.Resumen::getAuthUserId).toList();
        Map<Long, List<String>> roles = authIds.isEmpty() ? Collections.emptyMap() : repository.roles(authIds).stream()
                .collect(Collectors.groupingBy(AdminRegistroRepository.Rol::getAuthUserId,
                        Collectors.mapping(AdminRegistroRepository.Rol::getRol, Collectors.toList())));
        List<Map<String, Object>> content = pagina.getContent().stream().map(r -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", r.getId());
            item.put("nombre", r.getNombre());
            item.put("apellidoPaterno", r.getApellidoPaterno());
            item.put("apellidoMaterno", r.getApellidoMaterno());
            item.put("email", r.getEmail());
            item.put("roles", roles.getOrDefault(r.getAuthUserId(), Collections.emptyList()));
            item.put("lastLoginAt", fechaIso(r.getLastLoginAt()));
            item.put("curp", r.getCurp());
            item.put("rfc", r.getRfc());
            item.put("tipoPerfil", r.getTipoPerfil());
            item.put("telefono", r.getTelefono());
            item.put("genero", r.getGenero());
            item.put("entidadFederativa", r.getEntidadFederativa());
            item.put("municipio", r.getMunicipio());
            item.put("fotoDocumentoId", r.getFotoDocumentoId());
            item.put("bloqueadoListaNegra", Integer.valueOf(1).equals(r.getBloqueadoListaNegra()));
            return item;
        }).toList();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", content);
        response.put("page", pagina.getNumber());
        response.put("size", pagina.getSize());
        response.put("totalElements", pagina.getTotalElements());
        response.put("totalPages", pagina.getTotalPages());
        response.put("totalRegistros", repository.contarTodos());
        if (incluirOpciones) {
            response.put("entidades", repository.entidades());
            response.put("municipios", repository.municipios());
        }
        return response;
    }

    private String limpiar(String value) {
        return value == null ? "" : value.trim();
    }

    private String fechaIso(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant.toString();
        if (value instanceof OffsetDateTime date) return date.toInstant().toString();
        if (value instanceof java.sql.Timestamp date) return date.toInstant().toString();
        if (value instanceof LocalDateTime date) return date.toInstant(ZoneOffset.UTC).toString();
        throw new IllegalArgumentException("Unsupported last login timestamp: " + value.getClass().getName());
    }

    private String patron(String value) {
        return value.isEmpty() ? "" : "%" + value.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }
}
