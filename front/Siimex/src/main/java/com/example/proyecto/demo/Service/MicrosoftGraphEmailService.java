package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.Entity.Documento;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Envía correos usando Microsoft Graph API.
 * Requiere: Mail.Send (Application) y buzón configurado en azure.sender-email.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MicrosoftGraphEmailService {

    private static final String SEND_MAIL_URL_TEMPLATE = "https://graph.microsoft.com/v1.0/users/%s/sendMail";

    private static final String DEFAULT_SUBJECT = "Código de acceso SIIMEX COMECyT";
    private static final String REGISTRATION_VERIFICATION_SUBJECT = "Verificación de cuenta SIIMEX COMECyT";

    private final RestTemplate restTemplate = new RestTemplate();
    private final MicrosoftGraphTokenService tokenService;

    @Value("${azure.sender-email:}")
    private String senderEmail;

    @Value("${app.verification.email.subject:}")
    private String subjectProperty;

    @Value("${azure.save-to-sent-items:true}")
    private boolean saveToSentItems;

    public void sendVerificationCode(String toEmail, String code) {
        String sender = senderEmail != null && !senderEmail.isBlank() ? senderEmail.trim() : null;
        if (sender == null) {
            throw new IllegalStateException("Configure azure.sender-email con el buzón desde el cual enviar (ej. noreply@comecyt.gob.mx)");
        }

        String token = tokenService.getAccessToken();
        String url = String.format(SEND_MAIL_URL_TEMPLATE, sender);

        String subj = (subjectProperty != null && !subjectProperty.isBlank()) ? subjectProperty : DEFAULT_SUBJECT;
        Map<String, Object> body = Map.of(
                "message", Map.of(
                        "subject", subj,
                        "body", Map.of(
                                "contentType", "HTML",
                                "content", buildHtmlBody(code)
                        ),
                        "toRecipients", List.of(
                                Map.of("emailAddress", Map.of("address", toEmail))
                        )
                ),
                "saveToSentItems", saveToSentItems
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/json; charset=UTF-8"));
        headers.setBearerAuth(token);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Void> response = restTemplate.postForEntity(url, request, Void.class);

        if (response.getStatusCode() != HttpStatus.ACCEPTED) {
            throw new IllegalStateException("Graph API sendMail devolvió: " + response.getStatusCode());
        }
        log.info("Correo de verificación enviado a {} vía Microsoft Graph", toEmail);
    }

    /**
     * Envía el correo para verificar la cuenta tras el registro.
     * Incluye un enlace que el usuario debe hacer clic para activar su cuenta.
     */
    public void sendRegistrationVerificationEmail(String toEmail, String verificationLink, String nombreUsuario, String folioRegistro) {
        String sender = senderEmail != null && !senderEmail.isBlank() ? senderEmail.trim() : null;
        if (sender == null) {
            throw new IllegalStateException("Configure azure.sender-email con el buzón desde el cual enviar");
        }

        String token = tokenService.getAccessToken();
        String url = String.format(SEND_MAIL_URL_TEMPLATE, sender);

        String saludo = (nombreUsuario != null && !nombreUsuario.isBlank())
                ? "Hola, " + nombreUsuario.trim() + ","
                : "Hola,";

        Map<String, Object> body = Map.of(
                "message", Map.of(
                        "subject", REGISTRATION_VERIFICATION_SUBJECT,
                        "body", Map.of(
                                "contentType", "HTML",
                                "content", buildRegistrationVerificationHtmlBody(saludo, verificationLink, folioRegistro)
                        ),
                        "toRecipients", List.of(
                                Map.of("emailAddress", Map.of("address", toEmail))
                        )
                ),
                "saveToSentItems", saveToSentItems
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/json; charset=UTF-8"));
        headers.setBearerAuth(token);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Void> response = restTemplate.postForEntity(url, request, Void.class);

        if (response.getStatusCode() != HttpStatus.ACCEPTED) {
            throw new IllegalStateException("Graph API sendMail devolvió: " + response.getStatusCode());
        }
        log.info("Correo de verificación de registro enviado a {} vía Microsoft Graph", toEmail);
    }

    /**
     * Envía correo de aceptación de postulación (felicitaciones).
     */
    public void sendPostulacionAceptada(String toEmail, String nombreUsuario, String tituloConvocatoria) {
        sendGenericEmail(toEmail,
                "¡Felicidades! Tu postulación ha sido aceptada - SIIMEX COMECyT",
                buildPostulacionAceptadaHtml(nombreUsuario, tituloConvocatoria));
        log.info("Correo de aceptación de postulación enviado a {}", toEmail);
    }

    /**
     * Envía correo de rechazo de postulación.
     */
    public void sendPostulacionRechazada(String toEmail, String nombreUsuario, String tituloConvocatoria) {
        sendGenericEmail(toEmail,
                "Resultado de tu postulación - SIIMEX COMECyT",
                buildPostulacionRechazadaHtml(nombreUsuario, tituloConvocatoria));
        log.info("Correo de rechazo de postulación enviado a {}", toEmail);
    }

    public void sendPostulacionConObservaciones(String toEmail, String nombreUsuario, String tituloConvocatoria, String observaciones, LocalDateTime fechaLimiteCorreccion) {
        sendGenericEmail(toEmail,
                "Correcciones requeridas en tu postulación - SIIMEX COMECyT",
                buildPostulacionConObservacionesHtml(nombreUsuario, tituloConvocatoria, observaciones, fechaLimiteCorreccion));
        log.info("Correo de observaciones de postulación enviado a {}", toEmail);
    }

    public void sendPostulacionRevisada(String toEmail, String nombreUsuario, String tituloConvocatoria) {
        sendGenericEmail(toEmail,
                "Tu postulación fue revisada - SIIMEX COMECyT",
                buildPostulacionRevisadaHtml(nombreUsuario, tituloConvocatoria));
        log.info("Correo de postulación revisada enviado a {}", toEmail);
    }

    public void sendPostulacionPendiente(String toEmail, String nombreUsuario, String tituloConvocatoria) {
        sendGenericEmail(toEmail,
                "Actualización de estado: pendiente - SIIMEX COMECyT",
                buildPostulacionPendienteHtml(nombreUsuario, tituloConvocatoria));
        log.info("Correo de postulación en pendiente enviado a {}", toEmail);
    }

    public void sendDocumentoPostulacionEmitido(String toEmail, String nombreUsuario, String tituloConvocatoria,
                                                String folio, String tipoDocumento, Documento documento) {
        if (documento == null || documento.getContenido() == null || documento.getContenido().length == 0) {
            throw new IllegalArgumentException("El documento emitido no tiene contenido para adjuntar");
        }
        String tipo = tipoDocumento != null && !tipoDocumento.isBlank() ? tipoDocumento.trim() : "Documento";
        String subject = tipo + " disponible - SIIMEX COMECyT";
        String html = buildDocumentoPostulacionEmitidoHtml(nombreUsuario, tituloConvocatoria, folio, tipo);
        sendGenericEmailWithAttachment(
                toEmail,
                subject,
                html,
                documento.getNombreArchivo(),
                documento.getContentType(),
                documento.getContenido());
        log.info("Correo de {} emitido enviado a {}", tipo, toEmail);
    }

    /**
     * Envía el correo del formulario de contacto. El mensaje se envía al buzón configurado
     * (app.contact.recipient-email o azure.sender-email) con los datos del usuario.
     */
    public void sendContactFormEmail(String nombre, String email, String asunto, String telefono, String mensaje) {
        String recipient = getContactRecipientEmail();
        String asuntoLabel = Map.of(
            "general", "Consulta general",
            "colaboracion", "Colaboración",
            "publicacion", "Publicación / Divulgación",
            "convocatoria", "Convocatoria",
            "soporte", "Soporte técnico",
            "otro", "Otro"
        ).getOrDefault(asunto != null ? asunto.toLowerCase() : "", "Consulta general");
        String subject = "[SIIMEX Contacto] " + asuntoLabel;
        String html = buildContactFormHtmlBody(nombre, email, asunto, telefono, mensaje);
        sendGenericEmail(recipient, subject, html);
        log.info("Correo de contacto enviado desde {} hacia {}", email, recipient);
    }

    @Value("${app.contact.recipient-email:}")
    private String contactRecipientEmail;

    private String getContactRecipientEmail() {
        String r = contactRecipientEmail != null && !contactRecipientEmail.isBlank() ? contactRecipientEmail.trim() : null;
        if (r != null) return r;
        if (senderEmail != null && !senderEmail.isBlank()) return senderEmail.trim();
        throw new IllegalStateException("Configure app.contact.recipient-email o azure.sender-email para el formulario de contacto");
    }

    private String buildContactFormHtmlBody(String nombre, String email, String asunto, String telefono, String mensaje) {
        String n = escapeHtml(nombre != null ? nombre : "");
        String e = escapeHtml(email != null ? email : "");
        String a = escapeHtml(asunto != null ? asunto : "—");
        String t = escapeHtml(telefono != null && !telefono.isBlank() ? telefono : "—");
        String m = escapeHtml(mensaje != null ? mensaje : "");
        m = m.replace("\n", "<br>");
        String body = """
            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0"
                   style="border:1px solid #e8edf2;border-radius:12px;background:#fcfdff;">
              <tr>
                <td style="padding:14px 16px;border-bottom:1px solid #e8edf2;">
                  <p style="margin:0 0 6px;font-size:13px;color:#111827;"><strong>Nombre:</strong> %s</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#111827;"><strong>Correo:</strong> %s</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#111827;"><strong>Asunto:</strong> %s</p>
                  <p style="margin:0;font-size:13px;color:#111827;"><strong>Teléfono:</strong> %s</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0 0 6px;font-size:13px;color:#111827;"><strong>Mensaje:</strong></p>
                  <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;">%s</p>
                </td>
              </tr>
            </table>
            """.formatted(n, e, a, t, m);
        return buildEmailLayout(
                "Contacto",
                "Nuevo mensaje de contacto",
                "Se recibió un mensaje desde el formulario público de SIIMEX.",
                body,
                "#800020",
                "Mensaje de contacto SIIMEX"
        );
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private void sendGenericEmail(String toEmail, String subject, String htmlContent) {
        String sender = senderEmail != null && !senderEmail.isBlank() ? senderEmail.trim() : null;
        if (sender == null) {
            throw new IllegalStateException("Configure azure.sender-email para enviar correos");
        }
        String token = tokenService.getAccessToken();
        String url = String.format(SEND_MAIL_URL_TEMPLATE, sender);
        Map<String, Object> body = Map.of(
                "message", Map.of(
                        "subject", subject,
                        "body", Map.of("contentType", "HTML", "content", htmlContent),
                        "toRecipients", List.of(Map.of("emailAddress", Map.of("address", toEmail)))
                ),
                "saveToSentItems", saveToSentItems
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/json; charset=UTF-8"));
        headers.setBearerAuth(token);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Void> response = restTemplate.postForEntity(url, request, Void.class);
        if (response.getStatusCode() != HttpStatus.ACCEPTED) {
            throw new IllegalStateException("Graph API sendMail devolvió: " + response.getStatusCode());
        }
    }

    private void sendGenericEmailWithAttachment(String toEmail, String subject, String htmlContent,
                                                String attachmentName, String contentType, byte[] content) {
        String sender = senderEmail != null && !senderEmail.isBlank() ? senderEmail.trim() : null;
        if (sender == null) {
            throw new IllegalStateException("Configure azure.sender-email para enviar correos");
        }
        String token = tokenService.getAccessToken();
        String url = String.format(SEND_MAIL_URL_TEMPLATE, sender);
        Map<String, Object> body = Map.of(
                "message", Map.of(
                        "subject", subject,
                        "body", Map.of("contentType", "HTML", "content", htmlContent),
                        "toRecipients", List.of(Map.of("emailAddress", Map.of("address", toEmail))),
                        "attachments", List.of(Map.of(
                                "@odata.type", "#microsoft.graph.fileAttachment",
                                "name", attachmentName != null && !attachmentName.isBlank() ? attachmentName : "documento_siimex.pdf",
                                "contentType", contentType != null && !contentType.isBlank() ? contentType : "application/pdf",
                                "contentBytes", Base64.getEncoder().encodeToString(content)
                        ))
                ),
                "saveToSentItems", saveToSentItems
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/json; charset=UTF-8"));
        headers.setBearerAuth(token);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Void> response = restTemplate.postForEntity(url, request, Void.class);
        if (response.getStatusCode() != HttpStatus.ACCEPTED) {
            throw new IllegalStateException("Graph API sendMail devolvió: " + response.getStatusCode());
        }
    }

    private String buildPostulacionAceptadaHtml(String nombreUsuario, String tituloConvocatoria) {
        String saludo = (nombreUsuario != null && !nombreUsuario.isBlank())
                ? "Hola, " + escapeHtml(nombreUsuario) + ","
                : "Hola,";
        String conv = (tituloConvocatoria != null && !tituloConvocatoria.isBlank())
                ? escapeHtml(tituloConvocatoria)
                : "la convocatoria";
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">%s</p>
            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
              Nos complace informarte que <strong>tu postulación a &quot;%s&quot; fue aceptada</strong>.
            </p>
            <div style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;color:#065f46;font-size:13px;">
              El equipo de SIIMEX te contactará con los siguientes pasos.
            </div>
            """.formatted(saludo, conv);
        return buildEmailLayout(
                "Resultado de postulación",
                "Tu postulación fue aceptada",
                "Excelente noticia: ya formas parte de esta convocatoria.",
                body,
                "#0f766e",
                "Tu postulación fue aceptada"
        );
    }

    private String buildPostulacionRechazadaHtml(String nombreUsuario, String tituloConvocatoria) {
        String saludo = (nombreUsuario != null && !nombreUsuario.isBlank())
                ? "Hola, " + escapeHtml(nombreUsuario) + ","
                : "Hola,";
        String conv = (tituloConvocatoria != null && !tituloConvocatoria.isBlank())
                ? escapeHtml(tituloConvocatoria)
                : "la convocatoria";
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">%s</p>
            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
              En esta ocasión, <strong>tu postulación a &quot;%s&quot; no fue aceptada</strong>.
            </p>
            <div style="margin:16px 0;padding:14px 16px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;color:#9a3412;font-size:13px;">
              Te recomendamos mantener actualizado tu perfil para próximas convocatorias.
            </div>
            """.formatted(saludo, conv);
        return buildEmailLayout(
                "Resultado de postulación",
                "Actualización sobre tu postulación",
                "Gracias por participar en SIIMEX.",
                body,
                "#a16207",
                "Actualización de postulación"
        );
    }

    private String buildPostulacionConObservacionesHtml(String nombreUsuario, String tituloConvocatoria, String observaciones, LocalDateTime fechaLimiteCorreccion) {
        String saludo = (nombreUsuario != null && !nombreUsuario.isBlank())
                ? "Hola, " + escapeHtml(nombreUsuario) + ","
                : "Hola,";
        String conv = (tituloConvocatoria != null && !tituloConvocatoria.isBlank())
                ? escapeHtml(tituloConvocatoria)
                : "la convocatoria";
        String obs = escapeHtml(observaciones != null ? observaciones : "Sin observaciones");
        String limite = fechaLimiteCorreccion != null
                ? escapeHtml(fechaLimiteCorreccion.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")))
                : "No definida";
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">%s</p>
            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
              Tu postulación a <strong>&quot;%s&quot;</strong> requiere correcciones.
            </p>
            <div style="margin:12px 0;padding:14px 16px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;color:#9a3412;font-size:13px;">
              <strong>Fecha límite para editar:</strong> %s
            </div>
            <div style="margin:12px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#334155;font-size:13px;white-space:pre-wrap;">
              <strong>Observaciones:</strong><br>%s
            </div>
            """.formatted(saludo, conv, limite, obs);
        return buildEmailLayout(
                "Correcciones",
                "Tu postulación tiene observaciones",
                "Realiza las correcciones dentro del plazo indicado.",
                body,
                "#b45309",
                "Tu postulación tiene observaciones y fecha límite"
        );
    }

    private String buildPostulacionRevisadaHtml(String nombreUsuario, String tituloConvocatoria) {
        String saludo = (nombreUsuario != null && !nombreUsuario.isBlank())
                ? "Hola, " + escapeHtml(nombreUsuario) + ","
                : "Hola,";
        String conv = (tituloConvocatoria != null && !tituloConvocatoria.isBlank())
                ? escapeHtml(tituloConvocatoria)
                : "la convocatoria";
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">%s</p>
            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
              Tu postulación a <strong>&quot;%s&quot;</strong> fue marcada como revisada.
            </p>
            """.formatted(saludo, conv);
        return buildEmailLayout(
                "Seguimiento",
                "Tu postulación fue revisada",
                "Consulta tu panel para más detalles.",
                body,
                "#0f766e",
                "Tu postulación fue revisada"
        );
    }

    private String buildPostulacionPendienteHtml(String nombreUsuario, String tituloConvocatoria) {
        String saludo = (nombreUsuario != null && !nombreUsuario.isBlank())
                ? "Hola, " + escapeHtml(nombreUsuario) + ","
                : "Hola,";
        String conv = (tituloConvocatoria != null && !tituloConvocatoria.isBlank())
                ? escapeHtml(tituloConvocatoria)
                : "la convocatoria";
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">%s</p>
            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
              Tu postulación a <strong>&quot;%s&quot;</strong> fue regresada al estado pendiente.
            </p>
            """.formatted(saludo, conv);
        return buildEmailLayout(
                "Seguimiento",
                "Tu postulación está en pendiente",
                "Mantente atento a nuevas actualizaciones.",
                body,
                "#475569",
                "Tu postulación está pendiente"
        );
    }

    private String buildDocumentoPostulacionEmitidoHtml(String nombreUsuario, String tituloConvocatoria, String folio, String tipoDocumento) {
        String saludo = (nombreUsuario != null && !nombreUsuario.isBlank())
                ? "Hola, " + escapeHtml(nombreUsuario) + ","
                : "Hola,";
        String conv = (tituloConvocatoria != null && !tituloConvocatoria.isBlank())
                ? escapeHtml(tituloConvocatoria)
                : "la convocatoria";
        String folioSeguro = (folio != null && !folio.isBlank()) ? escapeHtml(folio) : "No disponible";
        String tipoSeguro = (tipoDocumento != null && !tipoDocumento.isBlank()) ? escapeHtml(tipoDocumento) : "Documento";
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">%s</p>
            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
              El COMECYT emitió tu <strong>%s</strong> correspondiente a <strong>&quot;%s&quot;</strong>.
            </p>
            <div style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;color:#065f46;font-size:13px;">
              <strong>Folio:</strong> %s<br>
              El documento se adjunta a este correo y también estará disponible en tu panel de SIIMEX.
            </div>
            """.formatted(saludo, tipoSeguro, conv, folioSeguro);
        return buildEmailLayout(
                "Documento emitido",
                tipoSeguro + " disponible",
                "Consulta el documento adjunto y tu panel SIIMEX.",
                body,
                "#0f766e",
                tipoSeguro + " emitido"
        );
    }

    private String buildRegistrationVerificationHtmlBody(String saludo, String verificationLink, String folioRegistro) {
        String saludoSeguro = escapeHtml(saludo != null ? saludo : "Hola,");
        String linkSeguro = escapeHtml(verificationLink != null ? verificationLink : "");
        String folioSeguro = escapeHtml(folioRegistro != null ? folioRegistro.trim() : "");
        String bloqueFolio = folioSeguro.isBlank()
                ? ""
                : """
                    <div style="margin:12px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#334155;font-size:13px;">
                      <strong>Folio de registro:</strong> %s
                    </div>
                  """.formatted(folioSeguro);
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">%s</p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7;">
              Gracias por registrarte. Para activar tu cuenta, confirma tu correo con el botón siguiente:
            </p>
            %s
            %s
            <p style="margin:16px 0 6px;color:#374151;font-size:13px;line-height:1.6;">
              Si el botón no abre, copia y pega este enlace en tu navegador:
            </p>
            <p style="margin:0 0 14px;color:#6a0032;font-size:12px;line-height:1.6;word-break:break-all;">%s</p>
            <div style="padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412;font-size:12px;line-height:1.6;">
              Este enlace expira en 24 horas. Si no solicitaste esta cuenta, puedes ignorar este correo.
            </div>
            """.formatted(
                saludoSeguro,
                bloqueFolio,
                buildPrimaryButton("Verificar mi cuenta", linkSeguro, "#800020"),
                linkSeguro
        );
        return buildEmailLayout(
                "Verificación",
                "Confirma tu cuenta de SIIMEX",
                "Último paso para activar tu acceso.",
                body,
                "#800020",
                "Confirma tu cuenta de SIIMEX"
        );
    }

    private String buildHtmlBody(String code) {
        String codeSeguro = escapeHtml(code != null ? code : "");
        String body = """
            <p style="margin:0 0 12px;color:#111827;font-size:14px;line-height:1.7;">
              Recibimos una solicitud de acceso a tu cuenta.
            </p>
            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
              Ingresa este código en la pantalla de verificación:
            </p>
            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0"
                   style="margin:10px 0 14px;border:1px solid #eadce0;background:#fff7fa;border-radius:12px;">
              <tr>
                <td align="center" style="padding:16px;">
                  <span style="font-size:32px;font-weight:800;letter-spacing:7px;color:#800020;font-family:Consolas,Monaco,monospace;">%s</span>
                </td>
              </tr>
            </table>
            <div style="padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412;font-size:12px;line-height:1.6;">
              El código expira en 5 minutos. Si no solicitaste este acceso, ignora este correo.
            </div>
            """.formatted(codeSeguro);
        return buildEmailLayout(
                "Seguridad",
                "Código de acceso temporal",
                "Protegemos tu acceso al sistema SIIMEX.",
                body,
                "#800020",
                "Código temporal de acceso"
        );
    }

    private String buildPrimaryButton(String label, String href, String accentColor) {
        String text = escapeHtml(label != null ? label : "Abrir");
        String url = escapeHtml(href != null ? href : "#");
        return """
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 2px;">
              <tr>
                <td style="background:%s;border-radius:10px;">
                  <a href="%s" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                    %s
                  </a>
                </td>
              </tr>
            </table>
            """.formatted(accentColor, url, text);
    }

    private String buildEmailLayout(
            String badge,
            String title,
            String intro,
            String bodyHtml,
            String accentColor,
            String preheader
    ) {
        String badgeSafe = escapeHtml(badge != null ? badge : "SIIMEX");
        String titleSafe = escapeHtml(title != null ? title : "Notificación SIIMEX");
        String introSafe = escapeHtml(intro != null ? intro : "");
        String preheaderSafe = escapeHtml(preheader != null ? preheader : titleSafe);
        int year = LocalDate.now().getYear();

        return """
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta name="color-scheme" content="light only">
              <title>%s</title>
            </head>
            <body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
              <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
                %s
              </span>
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background:#eef2f7;padding:24px 12px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0"
                           style="width:640px;max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(21,34,50,0.14);">
                      <tr>
                        <td style="height:8px;background:linear-gradient(90deg,#6a0032 0%%,%s 100%%);"></td>
                      </tr>
                      <tr>
                        <td style="padding:26px 28px 18px;">
                          <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(106,0,50,0.08);color:#6a0032;font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">
                            %s
                          </span>
                          <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.3;color:#111827;">%s</h1>
                          <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.7;">%s</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 28px 24px;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;">
                          <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.5;">
                            SIIMEX · Consejo Mexiquense de Ciencia y Tecnología (COMECyT) · %s
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.formatted(titleSafe, preheaderSafe, accentColor, badgeSafe, titleSafe, introSafe, bodyHtml, year);
    }
}
