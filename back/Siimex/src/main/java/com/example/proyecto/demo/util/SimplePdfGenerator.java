package com.example.proyecto.demo.util;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Generador PDF mínimo para documentos de texto simples sin dependencias externas.
 * Soporta una sola página con líneas de texto ASCII.
 */
public final class SimplePdfGenerator {

    private SimplePdfGenerator() {
    }

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

        StringBuilder stream = new StringBuilder();
        stream.append("BT\n");
        stream.append("/F1 12 Tf\n");
        stream.append("50 790 Td\n");
        boolean primera = true;
        for (String linea : contenido) {
            if (!primera) {
                stream.append("0 -16 Td\n");
            }
            primera = false;
            stream.append("(").append(escapePdfText(toAscii(linea))).append(") Tj\n");
        }
        stream.append("ET\n");

        String obj1 = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
        String obj2 = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n";
        String obj3 = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n";
        String obj4 = "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n";
        String streamRaw = stream.toString();
        String obj5 = "5 0 obj << /Length " + streamRaw.getBytes(StandardCharsets.US_ASCII).length + " >> stream\n"
                + streamRaw
                + "endstream endobj\n";

        String header = "%PDF-1.4\n";
        StringBuilder body = new StringBuilder();
        body.append(obj1).append(obj2).append(obj3).append(obj4).append(obj5);

        String allWithoutXref = header + body;
        byte[] bytesWithoutXref = allWithoutXref.getBytes(StandardCharsets.US_ASCII);

        int off1 = header.length();
        int off2 = off1 + obj1.length();
        int off3 = off2 + obj2.length();
        int off4 = off3 + obj3.length();
        int off5 = off4 + obj4.length();

        String xref = "xref\n0 6\n"
                + "0000000000 65535 f \n"
                + String.format("%010d 00000 n \n", off1)
                + String.format("%010d 00000 n \n", off2)
                + String.format("%010d 00000 n \n", off3)
                + String.format("%010d 00000 n \n", off4)
                + String.format("%010d 00000 n \n", off5);
        int xrefOffset = bytesWithoutXref.length;
        String trailer = "trailer << /Size 6 /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF";

        String finalPdf = allWithoutXref + xref + trailer;
        return finalPdf.getBytes(StandardCharsets.US_ASCII);
    }

    private static String toAscii(String in) {
        StringBuilder out = new StringBuilder(in.length());
        for (int i = 0; i < in.length(); i++) {
            char c = in.charAt(i);
            if (c < 32 || c > 126) {
                out.append('?');
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    private static String escapePdfText(String in) {
        return in
                .replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)");
    }
}
