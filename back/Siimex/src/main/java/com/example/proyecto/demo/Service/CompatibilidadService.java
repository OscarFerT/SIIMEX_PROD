package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.*;
import com.example.proyecto.demo.Repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Calcula el porcentaje de compatibilidad entre un usuario y una convocatoria.
 * Usa los criterios definidos en la convocatoria y los compara con todo el perfil del usuario
 * (áreas, trayectoria académica, trayectoria profesional, idiomas, tipo perfil, etc.).
 */
@Service
@RequiredArgsConstructor
public class CompatibilidadService {

    private final UsuarioRepository usuarioRepo;
    private final AreaConocimientoRepository areaConocimientoRepo;
    private final TrayectoriaAcademicaRepository trayectoriaAcademicaRepo;
    private final TrayectoriaProfesionalRepository trayectoriaProfesionalRepo;
    private final IdiomaRepository idiomaRepo;
    private final ConvocatoriaService convocatoriaService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Calcula compatibilidad (0-100) entre el usuario autenticado y la convocatoria.
     * Si la convocatoria tiene criterios definidos, usa esos criterios con peso.
     * Además considera área, keywords y tipo perfil como fallback o complemento.
     */
    public int calcularCompatibilidad(Long authUserId, Long convocatoriaId) {
        Usuario usuario = usuarioRepo.findByAuthUserIdWithRegistro1(authUserId).orElse(null);
        if (usuario == null) return 0;

        Convocatoria conv = convocatoriaService.obtenerPorId(convocatoriaId);
        Map<String, Object> perfilUsuario = construirPerfilUsuario(usuario);

        List<Map<String, Object>> criterios = parseCriterios(conv.getCriteriosFormulario());

        if (!criterios.isEmpty()) {
            return calcularPorCriterios(criterios, perfilUsuario, conv, usuario);
        }
        return calcularPorAreaYKeywords(conv, usuario);
    }

    private List<Map<String, Object>> parseCriterios(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, Object> construirPerfilUsuario(Usuario u) {
        Map<String, Object> map = new HashMap<>();
        Long userId = u.getId();

        if (u.getRegistro1() != null) {
            Registro1 r = u.getRegistro1();
            if (r.getTipoPerfil() != null) map.put("tipo_perfil", r.getTipoPerfil().name());
        }

        List<AreaConocimiento> areas = areaConocimientoRepo.findByUsuarioId(userId);
        map.put("areas", areas.stream()
                .map(a -> (a.getAreaNombre() != null ? a.getAreaNombre() : "") + " " +
                        (a.getDisciplinaNombre() != null ? a.getDisciplinaNombre() : "") + " " +
                        (a.getCampoNombre() != null ? a.getCampoNombre() : ""))
                .collect(Collectors.joining(" ")).toLowerCase());
        if (!areas.isEmpty() && areas.get(0).getAreaNombre() != null) {
            map.put("area_conocimiento", areas.get(0).getAreaNombre());
        }

        List<TrayectoriaAcademica> trayAcad = trayectoriaAcademicaRepo.findByUsuarioId(userId);
        String gradoMax = trayAcad.stream()
                .map(TrayectoriaAcademica::getNivelNombre)
                .filter(Objects::nonNull)
                .max(this::compararGrado)
                .orElse(null);
        if (gradoMax != null) map.put("grado_academico", gradoMax);

        List<TrayectoriaProfesional> trayProf = trayectoriaProfesionalRepo.findByUsuarioId(userId);
        long aniosExp = trayProf.stream()
                .mapToLong(t -> {
                    LocalDate ini = t.getFechaInicio();
                    LocalDate fin = t.getFechaFin() != null ? t.getFechaFin() :
                            (Boolean.TRUE.equals(t.getEsActual()) ? LocalDate.now() : (ini != null ? ini : LocalDate.now()));
                    if (ini == null) return 0;
                    return ChronoUnit.YEARS.between(ini, fin);
                })
                .sum();
        map.put("anios_experiencia", (int) aniosExp);

        List<Idioma> idiomas = idiomaRepo.findByUsuarioId(userId);
        map.put("idiomas", idiomas.stream()
                .map(Idioma::getNombre)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", ")));

        return map;
    }

    private int compararGrado(String a, String b) {
        int ordenA = ordenGrado(a);
        int ordenB = ordenGrado(b);
        return Integer.compare(ordenA, ordenB);
    }

    private int ordenGrado(String g) {
        if (g == null) return 0;
        String n = g.toUpperCase();
        if (n.contains("DOCTOR") || n.contains("PHD")) return 4;
        if (n.contains("MAESTR") || n.contains("MAGISTER")) return 3;
        if (n.contains("LICENCIATURA") || n.contains("INGENIER")) return 2;
        if (n.contains("TÉCNICO") || n.contains("TECNICO")) return 1;
        return 0;
    }

    private int calcularPorCriterios(List<Map<String, Object>> criterios,
                                     Map<String, Object> perfilUsuario,
                                     Convocatoria conv,
                                     Usuario usuario) {
        int puntosObtenidos = 0;
        int pesoTotal = 0;

        for (Map<String, Object> c : criterios) {
            String clave = (String) c.get("clave");
            if (clave == null || clave.isBlank()) continue;

            Object pesoObj = c.get("peso");
            int peso = pesoObj instanceof Number ? ((Number) pesoObj).intValue() : 10;
            peso = Math.max(1, Math.min(100, peso));
            pesoTotal += peso;

            Object valorUsuario = obtenerValorPerfil(clave, perfilUsuario, conv, usuario);
            @SuppressWarnings("unchecked")
            List<String> opciones = (List<String>) c.get("opciones");
            boolean coincide = evaluarCoincidencia(clave, valorUsuario, opciones, c);

            if (coincide) puntosObtenidos += peso;
        }

        if (pesoTotal == 0) return calcularPorAreaYKeywords(conv, usuario);

        int porcentaje = (int) Math.round((double) puntosObtenidos / pesoTotal * 100);
        return Math.min(100, porcentaje);
    }

    private Object obtenerValorPerfil(String clave, Map<String, Object> perfil, Convocatoria conv, Usuario usuario) {
        String k = clave.toLowerCase().replace("-", "_").replace(" ", "_");
        if (perfil.containsKey(k)) return perfil.get(k);

        if (k.contains("grado") || k.contains("academico")) return perfil.get("grado_academico");
        if (k.contains("area") || k.contains("conocimiento")) return perfil.get("area_conocimiento");
        if (k.contains("experiencia") || k.contains("anios") || k.contains("años")) return perfil.get("anios_experiencia");
        if (k.contains("tipo") && k.contains("perfil")) return perfil.get("tipo_perfil");
        if (k.contains("idioma")) return perfil.get("idiomas");

        String areas = (String) perfil.get("areas");
        if (areas != null && !areas.isBlank()) return areas;
        return perfil.get("tipo_perfil");
    }

    private boolean evaluarCoincidencia(String clave, Object valorUsuario, List<String> opciones, Map<String, Object> criterio) {
        if (valorUsuario == null) return false;

        String valorStr = valorUsuario.toString().trim().toUpperCase();
        if (valorStr.isEmpty()) return false;

        if (opciones != null && !opciones.isEmpty()) {
            // Perfil mixto: puede cumplir criterios de investigador e innovador.
            if ("HIBRIDO".equals(valorStr)) {
                boolean coincideMixto = opciones.stream()
                        .filter(Objects::nonNull)
                        .map(opt -> opt.trim().toUpperCase())
                        .anyMatch(opt -> opt.contains("INVESTIGADOR") || opt.contains("INNOVADOR") || opt.contains("HIBRIDO"));
                if (coincideMixto) return true;
            }
            for (String opt : opciones) {
                if (opt != null && valorStr.contains(opt.trim().toUpperCase())) return true;
                if (opt != null && opt.trim().toUpperCase().contains(valorStr)) return true;
            }
            return false;
        }

        if (valorUsuario instanceof Number) {
            Object minObj = criterio.get("minimo");
            if (minObj instanceof Number) {
                return ((Number) valorUsuario).intValue() >= ((Number) minObj).intValue();
            }
        }

        return true;
    }

    private int calcularPorAreaYKeywords(Convocatoria conv, Usuario usuario) {
        List<AreaConocimiento> areasUsuario = areaConocimientoRepo.findByUsuarioId(usuario.getId());
        int total = 0;

        int ptsArea = calcularPuntosArea(conv.getArea(), areasUsuario);
        total += ptsArea;

        String userText = construirTextoUsuario(usuario, areasUsuario);
        int ptsKeywords = calcularPuntosKeywords(conv.getKeywords(), userText);
        total += ptsKeywords;

        int ptsTipo = calcularPuntosTipoPerfil(usuario.getRegistro1(), conv.getKeywords(), conv.getRequisitos());
        total += ptsTipo;

        return Math.min(100, total);
    }

    private int calcularPuntosArea(String areaConv, List<AreaConocimiento> areasUsuario) {
        if (areaConv == null || areaConv.isBlank()) return 25;
        String areaNorm = areaConv.toLowerCase().trim().replace("-", " ").replace("_", " ");
        if (areasUsuario.isEmpty()) return 0;
        for (AreaConocimiento a : areasUsuario) {
            String areaNombre = (a.getAreaNombre() != null ? a.getAreaNombre() : "").toLowerCase();
            String disciplina = (a.getDisciplinaNombre() != null ? a.getDisciplinaNombre() : "").toLowerCase();
            String campo = (a.getCampoNombre() != null ? a.getCampoNombre() : "").toLowerCase();
            if (areaNombre.contains(areaNorm) || areaNorm.contains(areaNombre) ||
                disciplina.contains(areaNorm) || areaNorm.contains(disciplina) ||
                campo.contains(areaNorm) || areaNorm.contains(campo)) return 50;
        }
        return 0;
    }

    private String construirTextoUsuario(Usuario u, List<AreaConocimiento> areas) {
        StringBuilder sb = new StringBuilder();
        if (u.getRegistro1() != null && u.getRegistro1().getTipoPerfil() != null) {
            sb.append(u.getRegistro1().getTipoPerfil().name()).append(" ");
        }
        areas.forEach(a -> {
            if (a.getAreaNombre() != null) sb.append(a.getAreaNombre()).append(" ");
            if (a.getDisciplinaNombre() != null) sb.append(a.getDisciplinaNombre()).append(" ");
            if (a.getCampoNombre() != null) sb.append(a.getCampoNombre()).append(" ");
        });
        return sb.toString().toLowerCase();
    }

    private int calcularPuntosKeywords(String keywordsConv, String userText) {
        if (keywordsConv == null || keywordsConv.isBlank()) return 15;
        if (userText == null || userText.isBlank()) return 0;
        Set<String> userWords = Arrays.stream(userText.split("\\s+"))
                .filter(w -> w.length() > 2).map(String::toLowerCase).collect(Collectors.toSet());
        String[] kw = keywordsConv.toLowerCase().split("\\s+");
        long matches = Arrays.stream(kw).filter(userWords::contains).count();
        if (kw.length == 0) return 0;
        return (int) Math.round((double) matches / kw.length * 30);
    }

    private int calcularPuntosTipoPerfil(Registro1 reg, String keywords, String requisitos) {
        if (reg == null || reg.getTipoPerfil() == null) return 0;
        String texto = ((keywords != null ? keywords : "") + " " + (requisitos != null ? requisitos : "")).toUpperCase();
        if (reg.getTipoPerfil() == Registro1.TipoPerfil.HIBRIDO) {
            return (texto.contains("INVESTIGADOR") || texto.contains("INNOVADOR") || texto.contains("HIBRIDO")) ? 20 : 0;
        }
        return texto.contains(reg.getTipoPerfil().name()) ? 20 : 0;
    }
}
