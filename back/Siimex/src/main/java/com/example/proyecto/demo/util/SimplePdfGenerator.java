package com.example.proyecto.demo.util;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Generador PDF sencillo sin dependencias externas.
 * Soporta documentos institucionales SIIMEX multipagina con texto, tablas y bloques de datos.
 */
public final class SimplePdfGenerator {

    private static final Charset PDF_CHARSET = StandardCharsets.ISO_8859_1;
    private static final double PAGE_WIDTH = 595;
    private static final double PAGE_HEIGHT = 842;
    private static final double MARGIN_X = 48;
    private static final double HEADER_TOP = 806;
    private static final double CONTENT_TOP = 746;
    private static final double CONTENT_BOTTOM = 58;
    private static final double CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);
    private static final String BURGUNDY = "0.502 0.000 0.125";
    private static final String GOLD = "0.741 0.557 0.235";
    private static final String TEXT = "0.110 0.137 0.176";
    private static final String MUTED = "0.360 0.392 0.447";
    private static final String LIGHT = "0.965 0.957 0.949";

    private SimplePdfGenerator() {
    }

    public record Campo(String etiqueta, String valor) {}

    public record Tabla(List<String> encabezados, List<List<String>> filas) {}

    public static byte[] generarDocumento(String titulo, List<String> lineas) {
        List<String> contenido = new ArrayList<>();
        if (titulo != null && !titulo.isBlank()) {
            contenido.add(titulo.trim());
        }
        if (lineas != null) {
            for (String linea : lineas) {
                if (linea == null) continue;
                String l = linea.replace('\r', ' ').replace('\n', ' ').trim();
                if (!l.isEmpty()) {
                    contenido.add(l);
                }
            }
        }
        if (contenido.isEmpty()) {
            contenido.add("Documento generado automaticamente");
        }

        PdfWriter writer = new PdfWriter(titulo != null ? titulo : "SIIMEX");
        writer.sectionTitle(titulo != null ? titulo : "Documento generado");
        for (String linea : contenido) {
            writer.paragraph(linea, 11, false, 6);
        }
        return writer.toPdf();
    }

    public static byte[] generarMachoteSiimex(
            String titulo,
            String subtitulo,
            List<Campo> campos,
            List<String> parrafos,
            Tabla tabla,
            String firma) {
        PdfWriter writer = new PdfWriter(titulo != null ? titulo : "SIIMEX");
        writer.hero(titulo, subtitulo);
        if (campos != null && !campos.isEmpty()) {
            writer.fields(campos);
        }
        if (parrafos != null) {
            for (String parrafo : parrafos) {
                writer.paragraph(parrafo, 10.2, false, 7);
            }
        }
        if (tabla != null && tabla.encabezados() != null && !tabla.encabezados().isEmpty()) {
            writer.table(tabla);
        }
        if (firma != null && !firma.isBlank()) {
            writer.signature(firma);
        }
        return writer.toPdf();
    }

    private static final class PdfWriter {
        private final String documentTitle;
        private final List<StringBuilder> pages = new ArrayList<>();
        private StringBuilder stream;
        private double y;

        private PdfWriter(String documentTitle) {
            this.documentTitle = clean(documentTitle);
            newPage();
        }

        private void newPage() {
            stream = new StringBuilder();
            pages.add(stream);
            drawHeader();
            y = CONTENT_TOP;
        }

        private void drawHeader() {
            fill(BURGUNDY);
            rect(0, 800, PAGE_WIDTH, 42, true);
            fill(GOLD);
            rect(0, 797, PAGE_WIDTH, 3, true);
            text("SIIMEX", MARGIN_X, 818, 16, true, "1 1 1");
            text("Consejo Mexiquense de Ciencia y Tecnología", MARGIN_X, 806, 8.6, false, "1 1 1");
            text("COMECYT", PAGE_WIDTH - 118, 818, 12, true, "1 1 1");
            text("Documento oficial", PAGE_WIDTH - 118, 806, 8.2, false, "1 1 1");
        }

        private void hero(String titulo, String subtitulo) {
            ensure(82);
            text(clean(titulo), MARGIN_X, y, 18, true, BURGUNDY);
            y -= 18;
            if (subtitulo != null && !subtitulo.isBlank()) {
                for (String line : wrap(clean(subtitulo), 88)) {
                    text(line, MARGIN_X, y, 10.5, false, MUTED);
                    y -= 13;
                }
            }
            stroke(GOLD);
            line(MARGIN_X, y - 2, PAGE_WIDTH - MARGIN_X, y - 2);
            y -= 18;
        }

        private void sectionTitle(String title) {
            ensure(34);
            text(clean(title), MARGIN_X, y, 16, true, BURGUNDY);
            y -= 22;
        }

        private void fields(List<Campo> campos) {
            int rows = (int) Math.ceil(campos.size() / 2.0);
            double rowHeight = 34;
            double boxHeight = rows * rowHeight + 18;
            ensure(boxHeight + 12);
            fill(LIGHT);
            rect(MARGIN_X, y - boxHeight + 8, CONTENT_WIDTH, boxHeight, true);
            stroke("0.835 0.855 0.890");
            rect(MARGIN_X, y - boxHeight + 8, CONTENT_WIDTH, boxHeight, false);
            double colWidth = (CONTENT_WIDTH - 18) / 2;
            double x1 = MARGIN_X + 10;
            double x2 = MARGIN_X + 18 + colWidth;
            double cy = y - 14;
            for (int i = 0; i < campos.size(); i++) {
                Campo c = campos.get(i);
                double x = (i % 2 == 0) ? x1 : x2;
                double yy = cy - ((i / 2) * rowHeight);
                text(clean(c.etiqueta()).toUpperCase(), x, yy, 7.8, true, BURGUNDY);
                List<String> lines = wrap(clean(valor(c.valor())), 42);
                text(lines.get(0), x, yy - 13, 9.5, false, TEXT);
                if (lines.size() > 1) {
                    text(lines.get(1), x, yy - 24, 8.2, false, TEXT);
                }
            }
            y -= boxHeight + 12;
        }

        private void paragraph(String text, double size, boolean bold, double after) {
            String cleanText = clean(text);
            if (cleanText.isBlank()) {
                y -= after;
                return;
            }
            List<String> lines = wrapByWidth(cleanText, size, bold, CONTENT_WIDTH);
            ensure(lines.size() * (size + 3) + after + 2);
            for (int i = 0; i < lines.size(); i++) {
                String line = lines.get(i);
                boolean justify = !bold && i < lines.size() - 1 && shouldJustify(line, size);
                if (justify) {
                    justifiedText(line, MARGIN_X, y, size, TEXT);
                } else {
                    text(line, MARGIN_X, y, size, bold, TEXT);
                }
                y -= size + 3;
            }
            y -= after;
        }

        private void table(Tabla tabla) {
            int cols = tabla.encabezados().size();
            double colWidth = CONTENT_WIDTH / cols;
            double rowHeight = 24;
            ensure(44 + ((tabla.filas() == null ? 0 : tabla.filas().size()) * rowHeight));
            text("Detalle del apoyo en sistema", MARGIN_X, y, 11, true, BURGUNDY);
            y -= 18;
            fill(BURGUNDY);
            rect(MARGIN_X, y - rowHeight + 7, CONTENT_WIDTH, rowHeight, true);
            for (int i = 0; i < cols; i++) {
                text(clean(tabla.encabezados().get(i)), MARGIN_X + 8 + (i * colWidth), y - 8, 8.5, true, "1 1 1");
            }
            y -= rowHeight;
            if (tabla.filas() != null) {
                int idx = 0;
                for (List<String> fila : tabla.filas()) {
                    ensure(rowHeight + 8);
                    fill(idx % 2 == 0 ? "0.990 0.990 0.990" : LIGHT);
                    rect(MARGIN_X, y - rowHeight + 7, CONTENT_WIDTH, rowHeight, true);
                    stroke("0.870 0.886 0.910");
                    rect(MARGIN_X, y - rowHeight + 7, CONTENT_WIDTH, rowHeight, false);
                    for (int i = 0; i < cols; i++) {
                        String value = i < fila.size() ? fila.get(i) : "";
                        text(clean(value), MARGIN_X + 8 + (i * colWidth), y - 8, 8.2, false, TEXT);
                    }
                    y -= rowHeight;
                    idx++;
                }
            }
            y -= 10;
        }

        private void signature(String firma) {
            ensure(96);
            y -= 18;
            double lineWidth = 250;
            double start = (PAGE_WIDTH - lineWidth) / 2;
            stroke(BURGUNDY);
            line(start, y, start + lineWidth, y);
            y -= 18;
            for (String line : wrap(clean(firma), 52)) {
                centeredText(line, y, 9.5, true, BURGUNDY);
                y -= 12;
            }
        }

        private void ensure(double required) {
            if (y - required < CONTENT_BOTTOM) {
                newPage();
            }
        }

        private void fill(String rgb) {
            stream.append(rgb).append(" rg\n");
        }

        private void stroke(String rgb) {
            stream.append(rgb).append(" RG\n");
        }

        private void rect(double x, double y, double w, double h, boolean fill) {
            stream.append(num(x)).append(' ').append(num(y)).append(' ').append(num(w)).append(' ').append(num(h)).append(fill ? " re f\n" : " re S\n");
        }

        private void line(double x1, double y1, double x2, double y2) {
            stream.append(num(x1)).append(' ').append(num(y1)).append(" m ").append(num(x2)).append(' ').append(num(y2)).append(" l S\n");
        }

        private boolean shouldJustify(String value, double size) {
            String cleanValue = clean(value);
            int spaces = countSpaces(cleanValue);
            if (spaces < 4) return false;
            double estimatedWidth = estimateTextWidth(cleanValue, size, false);
            return estimatedWidth > CONTENT_WIDTH * 0.54 && estimatedWidth < CONTENT_WIDTH * 1.02;
        }

        private void justifiedText(String value, double x, double y, double size, String rgb) {
            String cleanValue = clean(value);
            int spaces = countSpaces(cleanValue);
            if (spaces <= 0) {
                text(cleanValue, x, y, size, false, rgb);
                return;
            }
            double estimatedWidth = estimateTextWidth(cleanValue, size, false);
            double extra = CONTENT_WIDTH - estimatedWidth;
            if (extra <= 0) {
                text(cleanValue, x, y, size, false, rgb);
                return;
            }
            double wordSpacing = extra / spaces;
            if (wordSpacing > 8.5) {
                text(cleanValue, x, y, size, false, rgb);
                return;
            }
            stream.append("BT\n");
            stream.append(rgb).append(" rg\n");
            stream.append("/F1 ").append(num(size)).append(" Tf\n");
            stream.append(num(wordSpacing)).append(" Tw\n");
            stream.append(num(x)).append(' ').append(num(y)).append(" Td\n");
            stream.append('(').append(escapePdfText(cleanValue)).append(") Tj\n");
            stream.append("0 Tw\n");
            stream.append("ET\n");
        }

        private int countSpaces(String value) {
            int count = 0;
            for (int i = 0; i < value.length(); i++) {
                if (value.charAt(i) == ' ') count++;
            }
            return count;
        }

        private double estimateTextWidth(String value, double size, boolean bold) {
            return estimatePdfTextWidth(value, size, bold);
        }
        private void centeredText(String value, double y, double size, boolean bold, String rgb) {
            String cleanValue = clean(value);
            double width = estimatePdfTextWidth(cleanValue, size, bold);
            double x = Math.max(MARGIN_X, (PAGE_WIDTH - width) / 2);
            text(cleanValue, x, y, size, bold, rgb);
        }
        private void text(String text, double x, double y, double size, boolean bold, String rgb) {
            stream.append("BT\n");
            stream.append(rgb).append(" rg\n");
            stream.append(bold ? "/F2 " : "/F1 ").append(num(size)).append(" Tf\n");
            stream.append(num(x)).append(' ').append(num(y)).append(" Td\n");
            stream.append('(').append(escapePdfText(text)).append(") Tj\n");
            stream.append("ET\n");
        }

        private byte[] toPdf() {
            List<String> objects = new ArrayList<>();
            StringBuilder kids = new StringBuilder();
            for (int i = 0; i < pages.size(); i++) {
                int pageObj = 5 + (i * 2);
                int contentObj = pageObj + 1;
                kids.append(pageObj).append(" 0 R ");
                String page = pageObj + " 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentObj + " 0 R >> endobj\n";
                String raw = pages.get(i).toString();
                String content = contentObj + " 0 obj << /Length " + raw.getBytes(PDF_CHARSET).length + " >> stream\n" + raw + "endstream endobj\n";
                objects.add(page);
                objects.add(content);
            }

            List<String> finalObjects = new ArrayList<>();
            finalObjects.add("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
            finalObjects.add("2 0 obj << /Type /Pages /Kids [" + kids + "] /Count " + pages.size() + " >> endobj\n");
            finalObjects.add("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\n");
            finalObjects.add("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj\n");
            finalObjects.addAll(objects);

            StringBuilder pdf = new StringBuilder("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
            List<Integer> offsets = new ArrayList<>();
            for (String obj : finalObjects) {
                offsets.add(pdf.toString().getBytes(PDF_CHARSET).length);
                pdf.append(obj);
            }
            int xrefOffset = pdf.toString().getBytes(PDF_CHARSET).length;
            pdf.append("xref\n0 ").append(finalObjects.size() + 1).append("\n");
            pdf.append("0000000000 65535 f \n");
            for (Integer offset : offsets) {
                pdf.append(String.format("%010d 00000 n \n", offset));
            }
            pdf.append("trailer << /Size ").append(finalObjects.size() + 1).append(" /Root 1 0 R /Info << /Title (").append(escapePdfText(documentTitle)).append(") >> >>\n");
            pdf.append("startxref\n").append(xrefOffset).append("\n%%EOF");
            return pdf.toString().getBytes(PDF_CHARSET);
        }
    }

    private static List<String> wrap(String text, int maxChars) {
        String value = clean(text);
        List<String> out = new ArrayList<>();
        if (value.isBlank()) {
            out.add("");
            return out;
        }
        String[] words = value.split("\\s+");
        StringBuilder line = new StringBuilder();
        for (String word : words) {
            if (line.length() == 0) {
                line.append(word);
            } else if (line.length() + 1 + word.length() <= maxChars) {
                line.append(' ').append(word);
            } else {
                out.add(line.toString());
                line = new StringBuilder(word);
            }
        }
        if (line.length() > 0) out.add(line.toString());
        return out;
    }

    private static List<String> wrapByWidth(String text, double size, boolean bold, double maxWidth) {
        String value = clean(text);
        List<String> out = new ArrayList<>();
        if (value.isBlank()) {
            out.add("");
            return out;
        }
        String[] words = value.split("\\s+");
        StringBuilder line = new StringBuilder();
        for (String word : words) {
            String candidate = line.length() == 0 ? word : line + " " + word;
            if (line.length() == 0 || estimatePdfTextWidth(candidate, size, bold) <= maxWidth) {
                line = new StringBuilder(candidate);
            } else {
                out.add(line.toString());
                line = new StringBuilder(word);
            }
        }
        if (line.length() > 0) out.add(line.toString());
        return out;
    }

    private static double estimatePdfTextWidth(String value, double size, boolean bold) {
        String cleanValue = clean(value);
        double units = 0;
        for (int i = 0; i < cleanValue.length(); i++) {
            units += glyphUnits(cleanValue.charAt(i), bold);
        }
        return units * size / 1000.0;
    }

    private static int glyphUnits(char c, boolean bold) {
        if (c == ' ') return 278;
        if (".,;:'!|".indexOf(c) >= 0) return 250;
        if ("()[]{}".indexOf(c) >= 0) return 333;
        if ("-_/\\".indexOf(c) >= 0) return 333;
        if (Character.isDigit(c)) return 556;
        char lower = Character.toLowerCase(c);
        if ("iljft".indexOf(lower) >= 0) return bold ? 333 : 278;
        if ("r".indexOf(lower) >= 0) return 333;
        if ("mw".indexOf(lower) >= 0) return 778;
        if (Character.isUpperCase(c)) {
            if (c == 'M' || c == 'W') return 889;
            if (c == 'I') return 278;
            return 667;
        }
        if (Character.isLetter(c)) return 500;
        return 500;
    }

    private static String valor(String value) {
        return value == null || value.trim().isBlank() ? "No especificado" : value.trim();
    }

    private static String clean(String in) {
        if (in == null) return "";
        return in
                .replace('\r', ' ')
                .replace('\n', ' ')
                .replace('“', '"')
                .replace('”', '"')
                .replace('’', '\'')
                .replace('–', '-')
                .replace('—', '-')
                .replace('•', '*')
                .replace("\u00a0", " ")
                .trim();
    }

    private static String escapePdfText(String in) {
        StringBuilder out = new StringBuilder();
        String clean = clean(in);
        for (int i = 0; i < clean.length(); i++) {
            char c = clean.charAt(i);
            if (c == '\\' || c == '(' || c == ')') {
                out.append('\\').append(c);
            } else if (c == '\t') {
                out.append(' ');
            } else if (c < 32) {
                out.append(' ');
            } else if (c > 255) {
                out.append('?');
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    private static String num(double value) {
        return String.format(java.util.Locale.US, "%.2f", value);
    }
}





