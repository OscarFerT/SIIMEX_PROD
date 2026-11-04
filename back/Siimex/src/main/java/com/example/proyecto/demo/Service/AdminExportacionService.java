package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Repository.AdminRegistroRepository;
import com.example.proyecto.demo.dto.AdminExportacionRequest;
import com.example.proyecto.demo.exception.ApiException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.nio.file.attribute.AclFileAttributeView;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclEntryPermission;
import java.nio.file.attribute.AclEntryFlag;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static com.example.proyecto.demo.Service.AdminExpedienteDatosService.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminExportacionService {
    private final AdminRegistroRepository repository;
    private final AdminExpedienteDatosService datos;
    @Value("${app.admin.exportaciones.directorio:${java.io.tmpdir}/siimex-admin-exportaciones}")
    private String directorio;
    @Value("${app.admin.exportaciones.max-bytes:21474836480}")
    private long maxBytes;
    @Value("${app.admin.exportaciones.retencion-minutos:30}")
    private long retencionMinutos;
    private Path root;
    private final Map<UUID, Trabajo> trabajos = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    // One worker protects normal registration traffic; the queue is deliberately bounded.
    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(2), runnable -> {
        Thread thread = new Thread(runnable, "siimex-exportaciones");
        thread.setDaemon(true);
        return thread;
    });

    public record Estado(UUID id, String estado, int porcentaje, int totalUsuarios, int usuariosProcesados,
                         int totalDocumentos, int documentosProcesados, long bytesProcesados, long tamanoBytes,
                         String mensaje, String nombreArchivo, Instant caducaEn) {}

    private static class Trabajo {
        final UUID id = UUID.randomUUID();
        final String owner;
        final List<Long> usuarios;
        final Instant creado = Instant.now();
        volatile Instant vence;
        volatile String estado = "EN_COLA";
        volatile String mensaje = "En espera de preparacion";
        volatile int procesados, documentos, documentosProcesados, pasos, totalPasos;
        volatile long bytes, tamano;
        volatile boolean detener, descargando;
        volatile Path archivo;
        volatile Future<?> future;
        String ticket;
        Instant ticketVence;
        Trabajo(String owner, List<Long> usuarios) { this.owner = owner; this.usuarios = usuarios; }
        boolean activo() { return estado.equals("EN_COLA") || estado.equals("PREPARANDO"); }
        String nombre() { return "expedientes_siimex_" + id + ".zip"; }
    }

    @PostConstruct
    void prepararDirectorio() {
        try {
            root = Path.of(directorio).toAbsolutePath().normalize();
            if (Files.isSymbolicLink(root)) throw new IOException("Directorio de exportaciones no permitido");
            Files.createDirectories(root);
            if (Files.getFileStore(root).supportsFileAttributeView("posix")) {
                Files.setPosixFilePermissions(root, PosixFilePermissions.fromString("rwx------"));
            } else {
                AclFileAttributeView acl = Files.getFileAttributeView(root, AclFileAttributeView.class);
                if (acl != null) acl.setAcl(List.of(AclEntry.newBuilder().setType(AclEntryType.ALLOW)
                        .setPrincipal(Files.getOwner(root)).setPermissions(EnumSet.allOf(AclEntryPermission.class))
                        .setFlags(AclEntryFlag.DIRECTORY_INHERIT, AclEntryFlag.FILE_INHERIT).build()));
            }
            limpiarCaducados();
        } catch (IOException | RuntimeException ex) {
            // A missing temporary directory must not prevent registrations or login from starting.
            root = null;
            log.warn("Exportaciones deshabilitadas: no se pudo preparar el directorio temporal", ex);
        }
    }

    public synchronized Estado iniciar(String owner, AdminExportacionRequest request) {
        if (root == null) prepararDirectorio();
        if (root == null) throw api(HttpStatus.SERVICE_UNAVAILABLE, "No esta disponible el directorio temporal de exportaciones. Revisa los permisos del servidor");
        limpiarCaducados();
        for (Trabajo job : new ArrayList<>(trabajos.values())) {
            if (!job.owner.equals(owner)) continue;
            synchronized (job) {
                if (job.activo() || job.descargando) throw api(HttpStatus.CONFLICT, "Ya tienes una exportacion en proceso");
            }
        }
        if (trabajos.values().stream().filter(job -> !job.owner.equals(owner)).count() >= 10) {
            throw api(HttpStatus.TOO_MANY_REQUESTS, "Hay varias exportaciones disponibles; intenta mas tarde");
        }
        if (executor.getActiveCount() > 0 && executor.getQueue().remainingCapacity() == 0) {
            throw api(HttpStatus.TOO_MANY_REQUESTS, "El servidor esta preparando otros archivos. Intenta mas tarde");
        }
        List<Long> ids;
        if (request.ids() != null) {
            if (request.ids().isEmpty() || request.ids().size() > 20000 || request.ids().stream().anyMatch(id -> id == null || id <= 0)) {
                throw api(HttpStatus.BAD_REQUEST, "Selecciona usuarios validos para exportar");
            }
            List<Long> selected = request.ids().stream().distinct().toList();
            ids = repository.idsExistentes(selected);
            if (ids.size() != selected.size()) throw api(HttpStatus.CONFLICT, "Algunos usuarios ya no existen. Actualiza el listado");
        } else {
            String busqueda = texto(request.busqueda()).toLowerCase(Locale.ROOT);
            ids = repository.idsParaExportar(patron(busqueda), patron(busqueda.replaceAll("\\s", "")),
                    texto(request.perfil()), texto(request.sexo()), texto(request.entidad()), texto(request.municipio()));
        }
        if (ids.isEmpty()) throw api(HttpStatus.BAD_REQUEST, "No hay usuarios que coincidan con la seleccion");
        for (Trabajo previous : new ArrayList<>(trabajos.values())) {
            if (!previous.owner.equals(owner)) continue;
            synchronized (previous) {
                if (previous.descargando) throw api(HttpStatus.CONFLICT, "La descarga anterior esta en curso");
                previous.detener = true;
                previous.estado = "CANCELADO";
                previous.ticket = null;
                eliminarArchivo(previous);
                trabajos.remove(previous.id);
            }
        }
        Trabajo job = new Trabajo(owner, List.copyOf(ids));
        job.vence = Instant.now().plus(Duration.ofMinutes(120));
        trabajos.put(job.id, job);
        try {
            job.future = executor.submit(() -> generar(job));
        } catch (RejectedExecutionException ex) {
            trabajos.remove(job.id);
            throw api(HttpStatus.TOO_MANY_REQUESTS, "El servidor esta preparando otros archivos. Intenta mas tarde");
        }
        return estado(job);
    }

    public Estado consultar(String owner, UUID id) { return estado(propio(owner, id)); }

    public Optional<Estado> actual(String owner) {
        return trabajos.values().stream().filter(job -> job.owner.equals(owner) && job.vence.isAfter(Instant.now()))
                .max(Comparator.comparing(job -> job.creado)).map(this::estado);
    }

    public Estado cancelar(String owner, UUID id) {
        Trabajo job = propio(owner, id);
        synchronized (job) {
            if (job.descargando) throw api(HttpStatus.CONFLICT, "La descarga ya esta en curso");
            job.detener = true;
            job.estado = "CANCELADO";
            job.mensaje = "Exportacion cancelada";
            job.ticket = null;
            job.vence = Instant.now().plus(Duration.ofMinutes(retencionMinutos));
            if (job.future != null) job.future.cancel(true);
            executor.purge();
            eliminarArchivo(job);
        }
        return estado(job);
    }

    public String prepararDescarga(String owner, UUID id) {
        Trabajo job = propio(owner, id);
        synchronized (job) {
            if (!job.estado.equals("LISTO") || job.descargando) throw api(HttpStatus.CONFLICT, "El archivo no esta disponible para descargar");
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            job.ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            job.ticketVence = Instant.now().plusSeconds(90);
            return job.ticket;
        }
    }

    public record Descarga(Path archivo, String nombre, long bytes) {}

    public Descarga abrirDescarga(UUID id, String ticket) {
        Trabajo job = trabajos.get(id);
        if (job == null) throw api(HttpStatus.NOT_FOUND, "Exportacion no disponible");
        synchronized (job) {
            if (ticket == null || job.ticket == null || job.ticketVence.isBefore(Instant.now()) ||
                    !MessageDigest.isEqual(ticket.getBytes(StandardCharsets.UTF_8), job.ticket.getBytes(StandardCharsets.UTF_8))) {
                throw api(HttpStatus.FORBIDDEN, "Descarga no autorizada o enlace vencido");
            }
            if (job.detener || !job.estado.equals("LISTO") || job.descargando || job.vence.isBefore(Instant.now())) {
                throw api(HttpStatus.CONFLICT, "Exportacion no disponible");
            }
            if (job.archivo == null || !Files.isRegularFile(job.archivo)) throw api(HttpStatus.GONE, "El archivo temporal ya no esta disponible; genera uno nuevo");
            long adminId;
            try { adminId = Long.parseLong(job.owner); } catch (NumberFormatException ex) { throw api(HttpStatus.FORBIDDEN, "Descarga no autorizada"); }
            if (repository.contarAdministradorActivo(adminId) == 0) throw api(HttpStatus.FORBIDDEN, "La cuenta ya no tiene acceso de administracion");
            job.ticket = null;
            job.descargando = true;
            return new Descarga(job.archivo, job.nombre(), job.tamano);
        }
    }

    public void cerrarDescarga(UUID id) {
        Trabajo job = trabajos.get(id);
        if (job != null) synchronized (job) { job.descargando = false; }
    }

    private Trabajo propio(String owner, UUID id) {
        Trabajo job = trabajos.get(id);
        if (job == null || !job.owner.equals(owner)) throw api(HttpStatus.NOT_FOUND, "Exportacion no disponible");
        if (job.vence.isBefore(Instant.now())) throw api(HttpStatus.GONE, "La exportacion vencio; genera una nueva");
        return job;
    }

    private Estado estado(Trabajo job) {
        int porcentaje = job.estado.equals("LISTO") ? 100 : job.totalPasos == 0 ? 0 : Math.min(99, (int) (100L * job.pasos / job.totalPasos));
        return new Estado(job.id, job.estado, porcentaje, job.usuarios.size(), job.procesados, job.documentos,
                job.documentosProcesados, job.bytes, job.tamano, job.mensaje, job.nombre(), job.vence);
    }

    private void generar(Trabajo job) {
        try {
            comprobar(job);
            job.estado = "PREPARANDO";
            job.mensaje = "Consultando documentos de los usuarios seleccionados";
            List<DocumentoExportable> documentos = datos.documentos(job.usuarios);
            Map<Long, List<DocumentoExportable>> porUsuario = documentos.stream().collect(Collectors.groupingBy(DocumentoExportable::usuarioId));
            job.documentos = documentos.size();
            job.totalPasos = job.usuarios.size() + documentos.size() + 1;
            job.archivo = root.resolve(job.id + ".zip");
            try (OutputStream file = Files.newOutputStream(job.archivo, StandardOpenOption.CREATE_NEW);
                 ZipOutputStream zip = new ZipOutputStream(new BufferedOutputStream(new SalidaLimitada(file), 64 * 1024))) {
                zip.setLevel(Deflater.BEST_SPEED);
                escribirTexto(zip, "LEEME.txt", "EXPEDIENTES SIIMEX - INFORMACION CONFIDENCIAL\n" +
                        "Cada carpeta incluye ficha.html (abrir en navegador o imprimir), datos.json y documentos originales.\n" +
                        "No incluye contrasenas, tokens ni codigos de acceso. Los datos corresponden al perfil registrado.\n" +
                        "La seleccion de usuarios se fija al solicitar el ZIP; los datos se consultan durante su preparacion.\n" +
                        "Generado: " + job.creado + "\nUsuarios: " + job.usuarios.size() + "\nDocumentos: " + documentos.size());
                StringBuilder index = new StringBuilder("\ufeffID,Nombre,Correo,Carpeta,Documentos\r\n");
                for (long id : job.usuarios) {
                    comprobar(job);
                    Map<String, Object> info = datos.informacion(id);
                    @SuppressWarnings("unchecked") Map<String, Object> usuario = (Map<String, Object>) info.get("Usuario");
                    String nombre = List.of("nombre", "apellido_paterno", "apellido_materno").stream()
                            .map(key -> Objects.toString(usuario.get(key), "")).filter(v -> !v.isBlank()).collect(Collectors.joining(" "));
                    String folder = "usuario_" + id + "_" + nombreSeguro(nombre).substring(0, Math.min(35, nombreSeguro(nombre).length())) + "/";
                    List<DocumentoExportable> docs = porUsuario.getOrDefault(id, Collections.emptyList());
                    job.mensaje = "Preparando expediente " + (job.procesados + 1) + " de " + job.usuarios.size();
                    datos.escribirInformacion(zip, folder, info, docs);
                    @SuppressWarnings("unchecked") List<Map<String, Object>> cuenta = (List<Map<String, Object>>) info.get("Cuenta");
                    String email = cuenta.isEmpty() ? "" : Objects.toString(cuenta.get(0).get("email"), "");
                    index.append(id).append(',').append(csv(nombre)).append(',').append(csv(email)).append(',')
                            .append(csv(folder)).append(',').append(docs.size()).append("\r\n");
                    for (DocumentoExportable doc : docs) {
                        comprobar(job);
                        zip.putNextEntry(new ZipEntry(folder + rutaDocumento(doc)));
                        datos.copiarDocumento(doc, zip, bytes -> {
                            comprobar(job);
                            job.bytes += bytes;
                        });
                        zip.closeEntry();
                        job.documentosProcesados++;
                        job.pasos++;
                    }
                    job.procesados++;
                    job.pasos++;
                }
                escribirTexto(zip, "indice.csv", index.toString());
                job.mensaje = "Finalizando el archivo ZIP";
            }
            comprobar(job);
            synchronized (job) {
                comprobar(job);
                job.tamano = Files.size(job.archivo);
                job.vence = Instant.now().plus(Duration.ofMinutes(retencionMinutos));
                job.mensaje = "ZIP listo para descargar";
                job.estado = "LISTO";
            }
        } catch (Exception ex) {
            synchronized (job) {
                if (!job.detener) {
                    job.estado = "ERROR";
                    Throwable cause = ex;
                    while (cause.getCause() != null && !(cause instanceof LimiteExportacion)) cause = cause.getCause();
                    job.mensaje = cause instanceof LimiteExportacion ? cause.getMessage() : "No se pudo generar el ZIP completo. Los datos pudieron cambiar; intenta nuevamente";
                    job.vence = Instant.now().plus(Duration.ofMinutes(retencionMinutos));
                    log.warn("No se pudo preparar exportacion {}", job.id, ex);
                }
            }
        } finally {
            if (!job.estado.equals("LISTO")) eliminarArchivo(job);
        }
    }

    private void comprobar(Trabajo job) {
        if (job.detener || Thread.currentThread().isInterrupted()) throw new CancellationException("Exportacion detenida");
    }

    private class SalidaLimitada extends FilterOutputStream {
        private long count, nextDiskCheck;
        SalidaLimitada(OutputStream out) { super(out); }
        private void limite(int bytes) throws IOException {
            count += bytes;
            if (count > maxBytes) throw new LimiteExportacion("El ZIP supera el limite permitido. Exporta por selecciones o filtros mas pequenos");
            if (count >= nextDiskCheck) {
                nextDiskCheck = count + 8 * 1024 * 1024;
                if (Files.getFileStore(root).getUsableSpace() < 100L * 1024 * 1024) throw new LimiteExportacion("No hay espacio suficiente para preparar el ZIP");
            }
        }
        @Override public void write(int b) throws IOException { limite(1); out.write(b); }
        @Override public void write(byte[] b, int off, int len) throws IOException { limite(len); out.write(b, off, len); }
    }
    private static class LimiteExportacion extends IOException { LimiteExportacion(String message) { super(message); } }

    @Scheduled(fixedDelay = 60000)
    public void limpiarCaducados() {
        Instant now = Instant.now();
        trabajos.values().forEach(job -> {
            synchronized (job) {
                if (!job.descargando && job.vence != null && job.vence.isBefore(now)) {
                    job.detener = true;
                    if (job.future != null) job.future.cancel(true);
                    eliminarArchivo(job);
                    trabajos.remove(job.id);
                }
            }
        });
        executor.purge();
        // Remove only old UUID-named ZIPs in our private directory, including leftovers after a restart.
        if (root == null) return;
        try (var paths = Files.list(root)) {
            paths.filter(p -> p.getFileName().toString().matches("[0-9a-f-]{36}\\.zip"))
                    .filter(p -> trabajos.values().stream().noneMatch(j -> p.equals(j.archivo)))
                    .forEach(p -> {
                        try {
                            if (Files.getLastModifiedTime(p).toInstant().isBefore(now.minus(Duration.ofHours(2)))) Files.deleteIfExists(p);
                        } catch (IOException ex) { log.debug("No se pudo limpiar archivo temporal de exportacion"); }
                    });
        } catch (IOException ex) { log.debug("No se pudo revisar directorio temporal de exportaciones"); }
    }

    private void eliminarArchivo(Trabajo job) {
        if (job.archivo != null) try { Files.deleteIfExists(job.archivo); } catch (IOException ex) { log.debug("Archivo temporal aun en uso: {}", job.id); }
    }

    @PreDestroy
    public void cerrar() {
        trabajos.values().forEach(j -> j.detener = true);
        executor.shutdownNow();
        try { executor.awaitTermination(5, TimeUnit.SECONDS); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
        trabajos.values().forEach(this::eliminarArchivo);
    }

    private String texto(String value) { return value == null ? "" : value.trim(); }
    private String patron(String value) { return value.isEmpty() ? "" : "%" + value.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"; }
    private static ApiException api(HttpStatus status, String message) { return new ApiException(status, message); }
    private static String csv(String value) {
        if (value.matches("^[=+@\\-\\t\\r].*")) value = "'" + value;
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
