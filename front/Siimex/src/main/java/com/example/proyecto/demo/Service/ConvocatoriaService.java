package com.example.proyecto.demo.Service;

import java.util.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.proyecto.demo.Entity.Convocatoria;
import com.example.proyecto.demo.Entity.Documento;
import com.example.proyecto.demo.Entity.Postulacion;
import com.example.proyecto.demo.Repository.ConvocatoriaRepository;
import com.example.proyecto.demo.Repository.PostulacionRepository;
import com.example.proyecto.demo.dto.ConvocatoriaRequest;
import com.example.proyecto.demo.exception.ApiException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConvocatoriaService {

    private final ConvocatoriaRepository convocatoriaRepo;
    private final PostulacionRepository postulacionRepo;
    private final DocumentoService documentoService;
    private final ConvocatoriaFormatoService convocatoriaFormatoService;
    private final NotificacionService notificacionService;
    private final FeriadoService feriadoService;

    public List<Convocatoria> listarVigentes() {
        return convocatoriaRepo.findByVigenteTrueAndVisibilidadPublicaTrueOrderByFechaCierreAsc();
    }

    /** Convocatorias vigentes con cantidadAceptados, limiteAceptados y lista de aceptados (para barra progreso y avatares). */
    public List<Map<String, Object>> listarVigentesConCupo() {
        List<Convocatoria> lista = convocatoriaRepo.findByVigenteTrueAndVisibilidadPublicaTrueOrderByFechaCierreAsc();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Convocatoria c : lista) {
            Map<String, Object> m = toMap(c);
            long cantidadAceptados = postulacionRepo.countByConvocatoriaIdAndEstado(c.getId(), "ACEPTADA");
            m.put("cantidadAceptados", (int) cantidadAceptados);
            List<Map<String, Object>> aceptados = new ArrayList<>();
            for (Postulacion p : postulacionRepo.findAceptadasByConvocatoriaIdWithUsuario(c.getId())) {
                if (p.getUsuario() == null) continue;
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("usuarioId", p.getUsuario().getId());
                String n = p.getUsuario().getNombre() != null ? p.getUsuario().getNombre().trim() : "";
                String ap = p.getUsuario().getApellidoPaterno() != null ? p.getUsuario().getApellidoPaterno().trim() : "";
                String am = p.getUsuario().getApellidoMaterno() != null ? p.getUsuario().getApellidoMaterno().trim() : "";
                a.put("nombre", (n + " " + ap + " " + am).trim());
                Long fotoId = documentoService.obtenerDocumentoPorUsuarioYTipo(p.getUsuario().getId(), Documento.TipoDocumento.FOTO_PERFIL)
                        .map(Documento::getId).orElse(null);
                a.put("fotoDocumentoId", fotoId);
                aceptados.add(a);
            }
            m.put("aceptados", aceptados);
            result.add(m);
        }
        return result;
    }

    private Map<String, Object> toMap(Convocatoria c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("titulo", c.getTitulo());
        m.put("descripcion", c.getDescripcion());
        m.put("resumen", c.getResumen());
        m.put("requisitos", c.getRequisitos());
        m.put("fechaApertura", c.getFechaApertura() != null ? c.getFechaApertura().toString() : null);
        m.put("fechaCierre", c.getFechaCierre() != null ? c.getFechaCierre().toString() : null);
        m.put("area", c.getArea());
        m.put("folioConvocatoria", c.getFolioConvocatoria());
        m.put("folioPrefijo", c.getFolioPrefijo());
        m.put("keywords", c.getKeywords());
        m.put("imagenUrl", c.getImagenUrl());
        m.put("iconoUrl", c.getIconoUrl());
        m.put("vigente", c.isVigente());
        m.put("visibilidadPublica", c.isVisibilidadPublica());
        m.put("fechaPublicacion", c.getFechaPublicacion() != null ? c.getFechaPublicacion().toString() : null);
        m.put("estadoPublicacion", calcularEstadoPublicacion(c));
        m.put("criteriosFormulario", c.getCriteriosFormulario());
        m.put("limiteAceptados", c.getLimiteAceptados());
        m.put("requisitosDocumentos", c.getRequisitosDocumentos());
        m.put("tiposApoyo", c.getTiposApoyo());
        m.put("reglasConfigurables", c.getReglasConfigurables());
        m.put("puntajeMaximoEvaluacion", c.getPuntajeMaximoEvaluacion());
        m.put("diasMinAnticipacion", c.getDiasMinAnticipacion());
        m.put("diasMaxAnticipacion", c.getDiasMaxAnticipacion());
        m.put("avisoPrivacidadObligatorio", c.isAvisoPrivacidadObligatorio());
        m.put("avisoPrivacidadTexto", c.getAvisoPrivacidadTexto());
        m.put("avisoPrivacidadUrl", c.getAvisoPrivacidadUrl());
        m.put("formatos", c.getId() != null ? convocatoriaFormatoService.listar(c.getId()) : List.of());
        m.put("diasNaturalesVigencia", calcularDiasNaturalesVigencia(c));
        m.put("feriadosEnVigencia", contarFeriadosEnVigencia(c));
        m.put("diasSinFeriadosVigencia", calcularDiasSinFeriadosVigencia(c));
        return m;
    }

    public List<Convocatoria> listarTodas() {
        return convocatoriaRepo.findAll();
    }

    /** Convocatorias para admin con cantidadAceptados, limiteAceptados y lista de aceptados. */
    public List<Map<String, Object>> listarTodasConCupo() {
        List<Convocatoria> lista = convocatoriaRepo.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Convocatoria c : lista) {
            Map<String, Object> m = toMap(c);
            long cantidadAceptados = postulacionRepo.countByConvocatoriaIdAndEstado(c.getId(), "ACEPTADA");
            m.put("cantidadAceptados", (int) cantidadAceptados);
            List<Map<String, Object>> aceptados = new ArrayList<>();
            for (Postulacion p : postulacionRepo.findAceptadasByConvocatoriaIdWithUsuario(c.getId())) {
                if (p.getUsuario() == null) continue;
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("usuarioId", p.getUsuario().getId());
                String n = p.getUsuario().getNombre() != null ? p.getUsuario().getNombre().trim() : "";
                String ap = p.getUsuario().getApellidoPaterno() != null ? p.getUsuario().getApellidoPaterno().trim() : "";
                String am = p.getUsuario().getApellidoMaterno() != null ? p.getUsuario().getApellidoMaterno().trim() : "";
                a.put("nombre", (n + " " + ap + " " + am).trim());
                Long fotoId = documentoService.obtenerDocumentoPorUsuarioYTipo(p.getUsuario().getId(), Documento.TipoDocumento.FOTO_PERFIL)
                        .map(Documento::getId).orElse(null);
                a.put("fotoDocumentoId", fotoId);
                aceptados.add(a);
            }
            m.put("aceptados", aceptados);
            result.add(m);
        }
        return result;
    }

    public Convocatoria obtenerPorId(Long id) {
        return convocatoriaRepo.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Convocatoria no encontrada"));
    }

    public Map<String, Object> obtenerOperacionSiimex(Long id) {
        Convocatoria c = obtenerPorId(id);
        List<Postulacion> postulaciones = postulacionRepo.findByConvocatoriaId(id);
        long total = postulaciones.size();
        long conObservaciones = contarPorEstado(postulaciones, "CON_OBSERVACIONES");
        long subsanadas = contarPorEstado(postulaciones, "SUBSANADA");
        long revisadas = postulaciones.stream()
                .filter(p -> p.getFechaRevision() != null || esEstadoEn(p.getEstado(), "REVISADA", "ACEPTADA", "RECHAZADA"))
                .count();
        long asignadasEvaluador = postulaciones.stream().filter(p -> textoNoVacio(p.getEvaluadorEmail())).count();
        long evaluadas = postulaciones.stream()
                .filter(p -> p.getFechaEvaluacion() != null || textoNoVacio(p.getResultadoEvaluacion()))
                .count();
        long aprobadas = postulaciones.stream()
                .filter(p -> esEstadoEn(p.getEstado(), "ACEPTADA") || esEstadoEn(p.getEstadoComite(), "APROBADA"))
                .count();
        long decisionesComite = postulaciones.stream()
                .filter(p -> p.getFechaComite() != null || textoNoVacio(p.getEstadoComite()))
                .count();
        long oficios = postulaciones.stream().filter(p -> p.getOficioAprobacionDocumento() != null).count();
        long nombramientos = postulaciones.stream().filter(p -> p.getNombramientoDocumento() != null).count();
        long apoyosEntregados = postulaciones.stream()
                .filter(p -> esEstadoEn(p.getEstadoEntregaApoyo(), "APOYO_ENTREGADO") || p.getFechaEntregaApoyo() != null)
                .count();
        long recibosCargados = postulaciones.stream().filter(p -> p.getReciboPagoDocumento() != null).count();
        long recibosValidados = postulaciones.stream()
                .filter(p -> esEstadoEn(p.getEstadoReciboPago(), "VALIDADO") || p.getFechaValidacionReciboPago() != null)
                .count();

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("convocatoriaId", c.getId());
        resumen.put("convocatoriaTitulo", c.getTitulo());
        resumen.put("estadoPublicacion", calcularEstadoPublicacion(c));
        resumen.put("fechaPublicacion", c.getFechaPublicacion() != null ? c.getFechaPublicacion().toString() : null);
        resumen.put("totalSolicitudes", total);
        resumen.put("conObservaciones", conObservaciones);
        resumen.put("subsanadas", subsanadas);
        resumen.put("revisadas", revisadas);
        resumen.put("asignadasEvaluador", asignadasEvaluador);
        resumen.put("evaluadas", evaluadas);
        resumen.put("decisionesComite", decisionesComite);
        resumen.put("aprobadas", aprobadas);
        resumen.put("oficios", oficios);
        resumen.put("nombramientos", nombramientos);
        resumen.put("apoyosEntregados", apoyosEntregados);
        resumen.put("recibosCargados", recibosCargados);
        resumen.put("recibosValidados", recibosValidados);
        resumen.put("pasos", List.of(
                pasoOperacion(1, "Publicación de convocatoria", "Convocatoria publicada en el micrositio/sistema.", c.getFechaPublicacion() != null && c.isVisibilidadPublica(), c.getFechaPublicacion() != null, c.getFechaPublicacion() != null ? "Fecha: " + c.getFechaPublicacion() : "Sin fecha de publicación formal."),
                pasoOperacion(2, "Registro electrónico", "Solicitudes capturadas por personas aspirantes.", total > 0, false, total + " solicitud(es) registradas."),
                pasoOperacion(3, "Revisión y subsanación", "Revisión administrativa, observaciones y correcciones.", revisadas > 0 || conObservaciones > 0 || subsanadas > 0, total > 0, revisadas + " revisada(s), " + conObservaciones + " con observaciones, " + subsanadas + " subsanada(s)."),
                pasoOperacion(4, "Selección y aprobación", "Solicitudes que cumplen requisitos pasan a aprobación.", aprobadas > 0, revisadas > 0, aprobadas + " aprobada(s)."),
                pasoOperacion(5, "Comisión evaluadora", "Evaluaciones y recomendaciones registradas.", evaluadas > 0 || decisionesComite > 0, asignadasEvaluador > 0, evaluadas + " evaluada(s), " + decisionesComite + " dictamen(es) de comité."),
                pasoOperacion(6, "Listado público de folios", "Folios aprobados disponibles en el micrositio.", aprobadas > 0, false, aprobadas + " folio(s) aprobados publicables."),
                pasoOperacion(7, "Oficio de aprobación", "Oficios generados y notificados por correo.", oficios > 0, aprobadas > 0, oficios + " oficio(s) emitidos."),
                pasoOperacion(8, "Nombramiento", "Nombramientos emitidos a personas aprobadas.", nombramientos > 0, oficios > 0, nombramientos + " nombramiento(s) emitidos."),
                pasoOperacion(9, "Entrega de apoyo y recibo", "Entrega del apoyo económico y acreditación con recibo.", apoyosEntregados > 0 && recibosValidados > 0, apoyosEntregados > 0 || recibosCargados > 0, apoyosEntregados + " apoyo(s), " + recibosCargados + " recibo(s) cargados, " + recibosValidados + " validado(s)."),
                pasoOperacion(10, "Padrón de beneficiarios", "Padrón actualizado con personas beneficiarias.", aprobadas > 0, false, aprobadas + " persona(s) en padrón operativo.")
        ));
        return resumen;
    }

    public Convocatoria crear(ConvocatoriaRequest req) {
        Convocatoria c = mapToEntity(req, new Convocatoria());
        c = convocatoriaRepo.save(c);
        if (c.getFolioConvocatoria() == null || c.getFolioConvocatoria().isBlank()) {
            c.setFolioConvocatoria(generarFolioConvocatoriaAuto(c));
            c = convocatoriaRepo.save(c);
        }
        try {
            notificacionService.crearParaAdmins(
                    "Nueva convocatoria creada",
                    "Se creó la convocatoria \"" + c.getTitulo() + "\".",
                    com.example.proyecto.demo.Entity.Notificacion.TipoNotificacion.NUEVA_CONVOCATORIA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificación de nueva convocatoria: {}", e.getMessage());
        }
        return c;
    }

    public Convocatoria actualizar(Long id, ConvocatoriaRequest req) {
        Convocatoria c = obtenerPorId(id);
        mapToEntity(req, c);
        return convocatoriaRepo.save(c);
    }

    public Convocatoria publicar(Long id) {
        Convocatoria c = obtenerPorId(id);
        c.setVigente(true);
        c.setVisibilidadPublica(true);
        if (c.getFechaPublicacion() == null) {
            c.setFechaPublicacion(LocalDateTime.now());
        }
        Convocatoria saved = convocatoriaRepo.save(c);
        try {
            notificacionService.crearParaAdmins(
                    "Convocatoria publicada",
                    "Se publicó la convocatoria \"" + saved.getTitulo() + "\" en el micrositio.",
                    com.example.proyecto.demo.Entity.Notificacion.TipoNotificacion.NUEVA_CONVOCATORIA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificación de publicación de convocatoria: {}", e.getMessage());
        }
        return saved;
    }

    public Convocatoria retirarPublicacion(Long id) {
        Convocatoria c = obtenerPorId(id);
        c.setVisibilidadPublica(false);
        Convocatoria saved = convocatoriaRepo.save(c);
        try {
            notificacionService.crearParaAdmins(
                    "Convocatoria retirada",
                    "Se retiró del micrositio la convocatoria \"" + saved.getTitulo() + "\".",
                    com.example.proyecto.demo.Entity.Notificacion.TipoNotificacion.SISTEMA,
                    "/admin/convocatorias");
        } catch (Exception e) {
            log.warn("No se pudo crear notificación de retiro de convocatoria: {}", e.getMessage());
        }
        return saved;
    }

    public void eliminar(Long id) {
        if (!convocatoriaRepo.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Convocatoria no encontrada");
        }
        convocatoriaFormatoService.eliminarPorConvocatoria(id);
        convocatoriaRepo.deleteById(id);
    }

    public Convocatoria duplicar(Long id) {
        Convocatoria base = obtenerPorId(id);
        Convocatoria copia = new Convocatoria();
        copia.setTitulo(generarTituloDuplicado(base.getTitulo()));
        copia.setDescripcion(base.getDescripcion());
        copia.setResumen(base.getResumen());
        copia.setRequisitos(base.getRequisitos());
        copia.setFechaApertura(base.getFechaApertura());
        copia.setFechaCierre(base.getFechaCierre());
        copia.setArea(base.getArea());
        copia.setFolioConvocatoria(null);
        copia.setFolioPrefijo(base.getFolioPrefijo());
        copia.setKeywords(base.getKeywords());
        copia.setImagenUrl(base.getImagenUrl());
        copia.setIconoUrl(base.getIconoUrl());
        copia.setVigente(false);
        copia.setVisibilidadPublica(false);
        copia.setCriteriosFormulario(base.getCriteriosFormulario());
        copia.setLimiteAceptados(base.getLimiteAceptados());
        copia.setRequisitosDocumentos(base.getRequisitosDocumentos());
        copia.setTiposApoyo(base.getTiposApoyo());
        copia.setReglasConfigurables(base.getReglasConfigurables());
        copia.setPuntajeMaximoEvaluacion(base.getPuntajeMaximoEvaluacion());
        copia.setDiasMinAnticipacion(base.getDiasMinAnticipacion());
        copia.setDiasMaxAnticipacion(base.getDiasMaxAnticipacion());
        copia.setAvisoPrivacidadObligatorio(base.isAvisoPrivacidadObligatorio());
        copia.setAvisoPrivacidadTexto(base.getAvisoPrivacidadTexto());
        copia.setAvisoPrivacidadUrl(base.getAvisoPrivacidadUrl());
        copia = convocatoriaRepo.save(copia);
        copia.setFolioConvocatoria(generarFolioConvocatoriaAuto(copia));
        return convocatoriaRepo.save(copia);
    }

    private Convocatoria mapToEntity(ConvocatoriaRequest req, Convocatoria c) {
        c.setTitulo(req.getTitulo() != null ? req.getTitulo().trim() : "");
        c.setDescripcion(req.getDescripcion() != null ? req.getDescripcion().trim() : null);
        c.setResumen(req.getResumen() != null ? req.getResumen().trim() : null);
        c.setRequisitos(req.getRequisitos() != null ? req.getRequisitos().trim() : null);
        c.setFechaApertura(req.getFechaApertura());
        c.setFechaCierre(req.getFechaCierre());
        c.setArea(req.getArea() != null ? req.getArea().trim() : null);
        String folioConv = normalizarFolioConvocatoria(req.getFolioConvocatoria());
        if (folioConv != null) {
            boolean duplicado = convocatoriaRepo.existsByFolioConvocatoriaIgnoreCase(folioConv);
            boolean esMismo = c.getFolioConvocatoria() != null && c.getFolioConvocatoria().equalsIgnoreCase(folioConv);
            if (duplicado && !esMismo) {
                throw new ApiException(HttpStatus.CONFLICT, "El folio de convocatoria ya existe");
            }
        }
        c.setFolioConvocatoria(folioConv);
        c.setFolioPrefijo(normalizarPrefijoFolio(req.getFolioPrefijo()));
        c.setKeywords(req.getKeywords() != null ? req.getKeywords().trim() : null);
        c.setImagenUrl(req.getImagenUrl() != null ? req.getImagenUrl().trim() : null);
        c.setIconoUrl(req.getIconoUrl() != null ? req.getIconoUrl().trim() : null);
        c.setVigente(req.getVigente() != null ? req.getVigente() : true);
        c.setVisibilidadPublica(req.getVisibilidadPublica() != null ? req.getVisibilidadPublica() : true);
        if (c.isVisibilidadPublica() && c.getFechaPublicacion() == null) {
            c.setFechaPublicacion(LocalDateTime.now());
        }
        c.setCriteriosFormulario(req.getCriteriosFormulario() != null ? req.getCriteriosFormulario().trim() : null);
        c.setLimiteAceptados(req.getLimiteAceptados() != null && req.getLimiteAceptados() > 0 ? req.getLimiteAceptados() : null);
        c.setRequisitosDocumentos(req.getRequisitosDocumentos() != null ? req.getRequisitosDocumentos().trim() : null);
        c.setTiposApoyo(req.getTiposApoyo() != null ? req.getTiposApoyo().trim() : null);
        String reglasConfigurables = req.getReglasConfigurables() != null ? req.getReglasConfigurables().trim() : null;
        if (reglasConfigurables == null || reglasConfigurables.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cada convocatoria debe tener al menos una regla configurada");
        }
        c.setReglasConfigurables(reglasConfigurables);
        c.setPuntajeMaximoEvaluacion(normalizarPuntajeMaximo(req.getPuntajeMaximoEvaluacion()));
        c.setDiasMinAnticipacion(normalizarDiasAnticipacion(req.getDiasMinAnticipacion(), 20));
        c.setDiasMaxAnticipacion(normalizarDiasAnticipacion(req.getDiasMaxAnticipacion(), 60));
        if (c.getDiasMinAnticipacion() > c.getDiasMaxAnticipacion()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Los dias mínimos de anticipación no pueden ser mayores al máximo");
        }
        c.setAvisoPrivacidadObligatorio(req.getAvisoPrivacidadObligatorio() != null ? req.getAvisoPrivacidadObligatorio() : false);
        c.setAvisoPrivacidadTexto(req.getAvisoPrivacidadTexto() != null ? req.getAvisoPrivacidadTexto().trim() : null);
        c.setAvisoPrivacidadUrl(req.getAvisoPrivacidadUrl() != null ? req.getAvisoPrivacidadUrl().trim() : null);
        return c;
    }

    private Integer normalizarPuntajeMaximo(Integer value) {
        if (value == null) return 100;
        if (value < 1) return 1;
        return value;
    }

    private Integer normalizarDiasAnticipacion(Integer value, int fallback) {
        if (value == null) return fallback;
        if (value < 0) return 0;
        return value;
    }

    private String normalizarPrefijoFolio(String prefijo) {
        if (prefijo == null) return null;
        String limpio = prefijo.trim()
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9\\-]", "");
        if (limpio.isBlank()) return null;
        return limpio.length() > 30 ? limpio.substring(0, 30) : limpio;
    }

    private String normalizarFolioConvocatoria(String folio) {
        if (folio == null) return null;
        String limpio = folio.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9\\-]", "");
        if (limpio.isBlank()) return null;
        return limpio.length() > 40 ? limpio.substring(0, 40) : limpio;
    }

    private String generarFolioConvocatoriaAuto(Convocatoria c) {
        long id = c != null && c.getId() != null ? c.getId() : System.currentTimeMillis() % 100000;
        String base = "CONV-" + String.format("%05d", id);
        String candidato = base;
        int i = 2;
        while (convocatoriaRepo.existsByFolioConvocatoriaIgnoreCase(candidato)) {
            candidato = base + "-" + i;
            i++;
        }
        return candidato;
    }

    private long calcularDiasNaturalesVigencia(Convocatoria c) {
        if (c == null || c.getFechaApertura() == null || c.getFechaCierre() == null) return 0;
        if (c.getFechaCierre().isBefore(c.getFechaApertura())) return 0;
        return ChronoUnit.DAYS.between(c.getFechaApertura(), c.getFechaCierre()) + 1;
    }

    private long contarFeriadosEnVigencia(Convocatoria c) {
        if (c == null || c.getFechaApertura() == null || c.getFechaCierre() == null) return 0;
        if (c.getFechaCierre().isBefore(c.getFechaApertura())) return 0;
        return feriadoService.contarFeriadosEnRango(c.getFechaApertura(), c.getFechaCierre());
    }

    private long calcularDiasSinFeriadosVigencia(Convocatoria c) {
        if (c == null || c.getFechaApertura() == null || c.getFechaCierre() == null) return 0;
        if (c.getFechaCierre().isBefore(c.getFechaApertura())) return 0;
        return feriadoService.diasNaturalesSinFeriadosInclusivo(c.getFechaApertura(), c.getFechaCierre());
    }

    private Map<String, Object> pasoOperacion(int numero, String titulo, String descripcion, boolean completo, boolean enProceso, String evidencia) {
        Map<String, Object> paso = new LinkedHashMap<>();
        paso.put("numero", numero);
        paso.put("titulo", titulo);
        paso.put("descripcion", descripcion);
        paso.put("estado", completo ? "COMPLETO" : (enProceso ? "EN_PROCESO" : "PENDIENTE"));
        paso.put("evidencia", evidencia);
        return paso;
    }

    private long contarPorEstado(List<Postulacion> postulaciones, String estado) {
        return postulaciones.stream().filter(p -> esEstadoEn(p.getEstado(), estado)).count();
    }

    private boolean esEstadoEn(String actual, String... esperados) {
        if (actual == null) return false;
        for (String esperado : esperados) {
            if (actual.trim().equalsIgnoreCase(esperado)) return true;
        }
        return false;
    }

    private boolean textoNoVacio(String valor) {
        return valor != null && !valor.trim().isEmpty();
    }

    private String calcularEstadoPublicacion(Convocatoria c) {
        if (c == null) return "BORRADOR";
        if (!c.isVisibilidadPublica()) {
            return c.getFechaPublicacion() != null ? "RETIRADA" : "BORRADOR";
        }
        if (!c.isVigente()) return "INACTIVA";
        LocalDate hoy = LocalDate.now();
        if (c.getFechaApertura() != null && c.getFechaApertura().isAfter(hoy)) return "PROGRAMADA";
        if (c.getFechaCierre() != null && c.getFechaCierre().isBefore(hoy)) return "CERRADA";
        return "PUBLICADA";
    }

    private String generarTituloDuplicado(String tituloBase) {
        String base = (tituloBase != null && !tituloBase.isBlank()) ? tituloBase.trim() : "Convocatoria";
        String candidato = base + " (copia)";
        int i = 2;
        while (existeTituloExacto(candidato)) {
            candidato = base + " (copia " + i + ")";
            i++;
        }
        return candidato;
    }

    private boolean existeTituloExacto(String titulo) {
        return convocatoriaRepo.findAll().stream()
                .anyMatch(c -> c.getTitulo() != null && c.getTitulo().trim().equalsIgnoreCase(titulo.trim()));
    }
}
