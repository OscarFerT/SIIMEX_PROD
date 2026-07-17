package com.example.proyecto.demo.util;

import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

public final class FileSecurityUtils {

    private static final int MAX_FILENAME_LENGTH = 180;
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");
    private FileSecurityUtils() {
    }

    public static String sanitizeFilename(String filename, String fallback) {
        String candidate = filename;
        if (candidate == null || candidate.isBlank()) {
            candidate = fallback;
        }

        String normalizedSeparators = candidate.replace('\\', '/');
        int lastSeparator = normalizedSeparators.lastIndexOf('/');
        String onlyName = lastSeparator >= 0
                ? normalizedSeparators.substring(lastSeparator + 1)
                : normalizedSeparators;
        String sanitized = onlyName
                .replaceAll("[\\p{Cntrl}]", "")
                .replaceAll("[^A-Za-z0-9._-]", "_")
                .replaceAll("_+", "_");

        if (sanitized.isBlank() || sanitized.equals(".") || sanitized.equals("..")) {
            sanitized = fallback;
        }
        if (sanitized.length() > MAX_FILENAME_LENGTH) {
            sanitized = trimPreservingExtension(sanitized);
        }
        return sanitized;
    }

    public static Path resolveInside(Path baseDir, String filename) {
        Path base = baseDir.toAbsolutePath().normalize();
        Path target = base.resolve(filename).normalize();
        if (!target.startsWith(base)) {
            throw new IllegalArgumentException("Ruta de archivo no permitida");
        }
        return target;
    }

    public static String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        String clean = sanitizeFilename(filename, "archivo");
        int dot = clean.lastIndexOf('.');
        return dot >= 0 && dot < clean.length() - 1
                ? clean.substring(dot + 1).toLowerCase(Locale.ROOT)
                : "";
    }

    public static boolean isPdf(MultipartFile file) {
        return "pdf".equals(extensionOf(file.getOriginalFilename())) && hasPdfSignature(readHeader(file));
    }

    public static boolean isOfficeDocument(MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        byte[] header = readHeader(file);
        if ("docx".equals(extension) || "xlsx".equals(extension)) {
            return hasZipSignature(header);
        }
        return false;
    }

    public static boolean isAllowedImage(MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        if (!IMAGE_EXTENSIONS.contains(extension)) {
            return false;
        }
        byte[] header = readHeader(file);
        return switch (extension) {
            case "png" -> hasPngSignature(header);
            case "jpg", "jpeg" -> hasJpegSignature(header);
            case "gif" -> hasGifSignature(header);
            case "webp" -> hasWebpSignature(header);
            default -> false;
        };
    }

    public static String safeContentTypeForFilename(String filename) {
        return switch (extensionOf(filename)) {
            case "pdf" -> MediaType.APPLICATION_PDF_VALUE;
            case "png" -> MediaType.IMAGE_PNG_VALUE;
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG_VALUE;
            case "gif" -> MediaType.IMAGE_GIF_VALUE;
            case "webp" -> "image/webp";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            default -> MediaType.APPLICATION_OCTET_STREAM_VALUE;
        };
    }

    public static byte[] stripImageMetadata(byte[] content, String filename) throws IOException {
        String extension = extensionOf(filename);
        if (!IMAGE_EXTENSIONS.contains(extension)) {
            throw new IOException("Formato de imagen no permitido");
        }
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(content));
        if (image == null) {
            throw new IOException("Imagen inválida");
        }
        String outputFormat = "jpeg".equals(extension) ? "jpg" : extension;
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        if (!ImageIO.write(image, outputFormat, output)) {
            throw new IOException("No se pudo limpiar la imagen");
        }
        return output.toByteArray();
    }

    public static byte[] stripDocumentMetadata(byte[] content, String filename) throws IOException {
        String extension = extensionOf(filename);
        if ("pdf".equals(extension)) {
            /*
             * Validación de metadatos PDF deshabilitada por decisión operativa.
             * Se conserva este bloque comentado por si más adelante se requiere
             * volver a rechazar archivos PDF con metadatos embebidos.
             *
             * if (pdfContainsMetadata(content)) {
             *     throw new IllegalArgumentException("El PDF contiene metadatos; genera una versión sin metadatos antes de subirlo");
             * }
             */
            return content;
        }
        if ("doc".equals(extension) || "xls".equals(extension)) {
            throw new IllegalArgumentException("Los formatos .doc/.xls no se permiten porque pueden conservar metadatos; usa .docx o .xlsx");
        }
        if ("docx".equals(extension) || "xlsx".equals(extension)) {
            return stripOoxmlMetadata(content);
        }
        return content;
    }

    public static boolean hasPdfSignature(byte[] bytes) {
        return startsWith(bytes, new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D});
    }

    private static String trimPreservingExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot > 0 && dot < filename.length() - 1) {
            String extension = filename.substring(dot);
            int baseLimit = Math.max(1, MAX_FILENAME_LENGTH - extension.length());
            return filename.substring(0, Math.min(dot, baseLimit)) + extension;
        }
        return filename.substring(0, MAX_FILENAME_LENGTH);
    }

    private static byte[] readHeader(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            int length = Math.min(bytes.length, 16);
            byte[] header = new byte[length];
            System.arraycopy(bytes, 0, header, 0, length);
            return header;
        } catch (IOException e) {
            return new byte[0];
        }
    }

    private static boolean hasZipSignature(byte[] bytes) {
        return startsWith(bytes, new byte[]{0x50, 0x4B, 0x03, 0x04})
                || startsWith(bytes, new byte[]{0x50, 0x4B, 0x05, 0x06})
                || startsWith(bytes, new byte[]{0x50, 0x4B, 0x07, 0x08});
    }

    private static boolean hasPngSignature(byte[] bytes) {
        return startsWith(bytes, new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
    }

    private static boolean hasJpegSignature(byte[] bytes) {
        return startsWith(bytes, new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});
    }

    private static boolean hasGifSignature(byte[] bytes) {
        return startsWith(bytes, new byte[]{0x47, 0x49, 0x46, 0x38, 0x37, 0x61})
                || startsWith(bytes, new byte[]{0x47, 0x49, 0x46, 0x38, 0x39, 0x61});
    }

    private static boolean hasWebpSignature(byte[] bytes) {
        return bytes.length >= 12
                && bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46
                && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static byte[] stripOoxmlMetadata(byte[] content) throws IOException {
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(content));
             ByteArrayOutputStream bytes = new ByteArrayOutputStream();
             ZipOutputStream output = new ZipOutputStream(bytes)) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = input.getNextEntry()) != null) {
                String name = entry.getName();
                if (name != null && name.startsWith("docProps/")) {
                    continue;
                }
                ZipEntry cleanEntry = new ZipEntry(name);
                output.putNextEntry(cleanEntry);
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
                output.closeEntry();
            }
            output.finish();
            return bytes.toByteArray();
        }
    }

    private static boolean pdfContainsMetadata(byte[] content) {
        String lower = new String(content, StandardCharsets.ISO_8859_1).toLowerCase(Locale.ROOT);
        return lower.contains("/metadata")
                || lower.contains("/info")
                || lower.contains("/author")
                || lower.contains("/creator")
                || lower.contains("/producer")
                || lower.contains("/creationdate")
                || lower.contains("/moddate")
                || lower.contains("/title")
                || lower.contains("/subject")
                || lower.contains("/keywords");
    }
}
