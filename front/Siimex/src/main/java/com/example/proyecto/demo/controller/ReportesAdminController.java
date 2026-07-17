package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.Entity.Convocatoria;
import com.example.proyecto.demo.Entity.Institucion;
import com.example.proyecto.demo.Entity.Postulacion;
import com.example.proyecto.demo.Entity.Registro1;
import com.example.proyecto.demo.Entity.TrayectoriaAcademica;
import com.example.proyecto.demo.Entity.Usuario;
import com.example.proyecto.demo.Repository.InstitucionRepository;
import com.example.proyecto.demo.Repository.PostulacionRepository;
import com.example.proyecto.demo.Repository.TrayectoriaAcademicaRepository;
import com.example.proyecto.demo.Service.PostulacionService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/admin/reportes")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ReportesAdminController {

    private final PostulacionRepository postulacionRepository;
    private final PostulacionService postulacionService;
    private final InstitucionRepository institucionRepository;
    private final TrayectoriaAcademicaRepository trayectoriaAcademicaRepository;

    @GetMapping("/postulaciones")
    public ResponseEntity<Map<String, Object>> consultarPostulaciones(
            @RequestParam(required = false) Long convocatoriaId,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String genero,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaDesde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaHasta
    ) {
        List<Postulacion> base = postulacionRepository.findAllWithUsuarioAndConvocatoria();
        String estadoNorm = norm(estado);
        String areaNorm = norm(area);
        String generoNorm = norm(genero);
        String queryNorm = norm(q);

        List<Map<String, Object>> items = new ArrayList<>();
        int total = 0;
        int pendientes = 0;
        int subsanadas = 0;
        int aceptadas = 0;
        int rechazadas = 0;
        int sumaCompatibilidad = 0;

        for (Postulacion p : base) {
            Convocatoria c = p.getConvocatoria();
            if (c == null) continue;

            if (convocatoriaId != null && !Objects.equals(c.getId(), convocatoriaId)) continue;

            String estadoPost = p.getEstado() != null ? p.getEstado() : "";
            if (!estadoNorm.isBlank() && !estadoNorm.equalsIgnoreCase(estadoPost)) continue;

            String areaPost = c.getArea() != null ? c.getArea() : "";
            if (!areaNorm.isBlank() && !norm(areaPost).equals(areaNorm)) continue;

            String generoPost = p.getUsuario() != null && p.getUsuario().getRegistro1() != null && p.getUsuario().getRegistro1().getGenero() != null
                    ? p.getUsuario().getRegistro1().getGenero().name() : "";
            if (!generoNorm.isBlank() && !norm(generoPost).equals(generoNorm)) continue;

            LocalDate fechaPost = p.getFechaCreacion() != null ? p.getFechaCreacion().toLocalDate() : null;
            if (fechaDesde != null && (fechaPost == null || fechaPost.isBefore(fechaDesde))) continue;
            if (fechaHasta != null && (fechaPost == null || fechaPost.isAfter(fechaHasta))) continue;

            String nombre = p.getUsuario() != null
                    ? ((safe(p.getUsuario().getNombre()) + " " + safe(p.getUsuario().getApellidoPaterno())).trim())
                    : "";
            String correo = safe(p.getCorreo());
            String titulo = safe(c.getTitulo());
            String textoBusq = norm(nombre + " " + correo + " " + titulo + " " + areaPost + " " + safe(p.getCurp()) + " " + safe(p.getCedula()));
            if (!queryNorm.isBlank() && !textoBusq.contains(queryNorm)) continue;

            int compatibilidad = postulacionService.calcularCompatibilidad(p);
            sumaCompatibilidad += compatibilidad;
            total++;

            String estadoUpper = estadoPost.toUpperCase(Locale.ROOT);
            if ("PENDIENTE".equals(estadoUpper)) pendientes++;
            else if ("SUBSANADA".equals(estadoUpper)) subsanadas++;
            else if ("ACEPTADA".equals(estadoUpper)) aceptadas++;
            else if ("RECHAZADA".equals(estadoUpper)) rechazadas++;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.getId());
            row.put("postulante", nombre);
            row.put("correo", correo);
            row.put("cedula", p.getCedula());
            row.put("curp", p.getCurp());
            row.put("telefono", p.getTelefono());
            row.put("convocatoriaId", c.getId());
            row.put("convocatoriaTitulo", titulo);
            row.put("area", c.getArea());
            row.put("genero", generoPost);
            row.put("estado", estadoPost);
            row.put("compatibilidad", compatibilidad);
            row.put("fechaCreacion", p.getFechaCreacion() != null ? p.getFechaCreacion().toString() : null);
            row.put("tieneCurriculum", p.getCurriculumDocumento() != null);
            row.put("curriculumDocumentoId", p.getCurriculumDocumento() != null ? p.getCurriculumDocumento().getId() : null);
            items.add(row);
        }

        int promedioCompatibilidad = total > 0 ? (int) Math.round((double) sumaCompatibilidad / total) : 0;

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("total", total);
        resumen.put("pendientes", pendientes);
        resumen.put("subsanadas", subsanadas);
        resumen.put("aceptadas", aceptadas);
        resumen.put("rechazadas", rechazadas);
        resumen.put("promedioCompatibilidad", promedioCompatibilidad);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("resumen", resumen);
        response.put("items", items);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/padron-beneficiarios")
    public ResponseEntity<Map<String, Object>> consultarPadronBeneficiarios(
            @RequestParam(required = false) Long convocatoriaId,
            @RequestParam(required = false) String q
    ) {
        String queryNorm = norm(q);
        List<Map<String, Object>> items = new ArrayList<>();

        for (Postulacion p : postulacionRepository.findBeneficiariasAprobadas()) {
            Convocatoria c = p.getConvocatoria();
            if (c == null) continue;
            if (convocatoriaId != null && !Objects.equals(c.getId(), convocatoriaId)) continue;

            Usuario usuario = p.getUsuario();
            Registro1 registro = usuario != null ? usuario.getRegistro1() : null;
            Long usuarioId = usuario != null ? usuario.getId() : null;
            Institucion institucion = obtenerInstitucionPrincipal(usuarioId);
            TrayectoriaAcademica grado = obtenerGradoPrincipal(usuarioId);

            String nombre = usuario != null
                    ? ((safe(usuario.getNombre()) + " " + safe(usuario.getApellidoPaterno()) + " " + safe(usuario.getApellidoMaterno())).trim())
                    : "";
            String folio = p.getFolio() != null ? p.getFolio() : "SOL-" + p.getId();
            String textoBusq = norm(folio + " " + nombre + " " + safe(p.getCorreo()) + " " + safe(p.getCurp()) + " " + safe(c.getTitulo()));
            if (!queryNorm.isBlank() && !textoBusq.contains(queryNorm)) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.getId());
            row.put("folio", folio);
            row.put("beneficiario", nombre);
            row.put("apellidoPaterno", usuario != null ? usuario.getApellidoPaterno() : null);
            row.put("apellidoMaterno", usuario != null ? usuario.getApellidoMaterno() : null);
            row.put("nombres", usuario != null ? usuario.getNombre() : null);
            row.put("correo", p.getCorreo());
            row.put("curp", !safe(p.getCurp()).isBlank() ? p.getCurp() : (registro != null ? registro.getCurp() : null));
            row.put("telefono", !safe(p.getTelefono()).isBlank() ? p.getTelefono() : (registro != null ? registro.getTelefono() : null));
            row.put("celular", registro != null ? registro.getCelular() : null);
            row.put("tipoIdentificacionOficial", registro != null ? registro.getTipoIdentificacionOficial() : null);
            row.put("identificacionOficial", registro != null ? registro.getIdentificacionOficial() : null);
            row.put("calle", registro != null ? registro.getCalle() : null);
            row.put("numeroExterior", registro != null ? registro.getNumeroExterior() : null);
            row.put("numeroInterior", registro != null ? registro.getNumeroInterior() : null);
            row.put("entreCalle", registro != null ? registro.getEntreCalle() : null);
            row.put("yCalle", registro != null ? registro.getYCalle() : null);
            row.put("otraReferencia", registro != null ? registro.getOtraReferencia() : null);
            row.put("colonia", registro != null ? registro.getColonia() : null);
            row.put("claveLocalidad", registro != null ? registro.getClaveLocalidad() : null);
            row.put("localidad", registro != null ? registro.getLocalidad() : null);
            row.put("claveMunicipio", registro != null ? registro.getClaveMunicipio() : null);
            row.put("municipioDomicilio", registro != null ? registro.getMunicipioDomicilio() : null);
            row.put("claveEntidadFederativa", registro != null ? registro.getClaveEntidadFederativa() : null);
            row.put("codigoPostal", registro != null ? registro.getCodigoPostal() : null);
            row.put("claveAgeb", registro != null ? registro.getClaveAgeb() : null);
            row.put("claveRedSocial", registro != null ? registro.getClaveRedSocial() : null);
            row.put("redSocial", registro != null ? registro.getRedSocial() : null);
            row.put("tipoBeneficiario", p.getTipoApoyo());
            row.put("fechaAlta", registro != null && registro.getCreatedAt() != null ? registro.getCreatedAt().toString()
                    : (p.getFechaCreacion() != null ? p.getFechaCreacion().toLocalDate().toString() : null));
            row.put("fechaActualizacion", registro != null && registro.getUpdatedAt() != null ? registro.getUpdatedAt().toString()
                    : (p.getFechaEntregaApoyo() != null ? p.getFechaEntregaApoyo().toLocalDate().toString() : null));
            row.put("fechaNacimiento", registro != null && registro.getFechaNacimiento() != null ? registro.getFechaNacimiento().toString() : null);
            row.put("genero", registro != null && registro.getGenero() != null ? registro.getGenero().name() : null);
            row.put("estadoCivil", registro != null && registro.getEstadoCivil() != null ? registro.getEstadoCivil().name() : null);
            row.put("gradoEstudios", grado != null ? grado.getNivelNombre() : null);
            row.put("nacionalidad", registro != null ? registro.getNacionalidad() : null);
            row.put("entidadNacimiento", registro != null ? registro.getEntidadFederativa() : null);
            row.put("municipio", registro != null ? registro.getMunicipio() : null);
            row.put("tipoInstitucionClave", institucion != null ? institucion.getTipoId() : null);
            row.put("tipoInstitucion", institucion != null ? institucion.getTipoNombre() : null);
            row.put("institucion", institucion != null ? institucion.getNombre() : null);
            row.put("convocatoriaId", c.getId());
            row.put("convocatoriaTitulo", c.getTitulo());
            row.put("folioConvocatoria", c.getFolioConvocatoria());
            row.put("area", c.getArea());
            row.put("estadoSolicitud", p.getEstado());
            row.put("estadoComite", p.getEstadoComite());
            row.put("montoApoyoAsignado", p.getMontoApoyoAsignado());
            row.put("estadoEntregaApoyo", p.getEstadoEntregaApoyo());
            row.put("fechaEntregaApoyo", p.getFechaEntregaApoyo() != null ? p.getFechaEntregaApoyo().toString() : null);
            row.put("estadoReciboPago", p.getEstadoReciboPago());
            row.put("estadoCotejo", p.getEstadoCotejo());
            row.put("estadoInforme", p.getEstadoInforme());
            row.put("fechaAprobacion", p.getFechaComite() != null ? p.getFechaComite().toString()
                    : (p.getFechaRevision() != null ? p.getFechaRevision().toString() : null));
            items.add(row);
        }

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("total", items.size());
        resumen.put("apoyosEntregados", items.stream()
                .filter(i -> "APOYO_ENTREGADO".equalsIgnoreCase(String.valueOf(i.get("estadoEntregaApoyo"))))
                .count());
        resumen.put("recibosValidados", items.stream()
                .filter(i -> "RECIBO_VALIDADO".equalsIgnoreCase(String.valueOf(i.get("estadoReciboPago"))))
                .count());
        resumen.put("montoTotalAprobado", items.stream()
                .map(i -> i.get("montoApoyoAsignado"))
                .filter(Objects::nonNull)
                .map(v -> {
                    try {
                        return new java.math.BigDecimal(String.valueOf(v));
                    } catch (Exception ex) {
                        return java.math.BigDecimal.ZERO;
                    }
                })
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("resumen", resumen);
        response.put("items", items);
        return ResponseEntity.ok(response);
    }

    private Institucion obtenerInstitucionPrincipal(Long usuarioId) {
        if (usuarioId == null) return null;
        return institucionRepository.findByUsuarioId(usuarioId).stream().findFirst().orElse(null);
    }

    private TrayectoriaAcademica obtenerGradoPrincipal(Long usuarioId) {
        if (usuarioId == null) return null;
        return trayectoriaAcademicaRepository.findByUsuarioId(usuarioId).stream()
                .max((a, b) -> Integer.compare(pesoGrado(a.getNivelNombre()), pesoGrado(b.getNivelNombre())))
                .orElse(null);
    }

    private int pesoGrado(String grado) {
        String g = norm(grado);
        if (g.contains("doctor")) return 5;
        if (g.contains("maestr")) return 4;
        if (g.contains("especial")) return 3;
        if (g.contains("licenc") || g.contains("ingenier")) return 2;
        if (g.contains("tecn")) return 1;
        return 0;
    }

    private String norm(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
