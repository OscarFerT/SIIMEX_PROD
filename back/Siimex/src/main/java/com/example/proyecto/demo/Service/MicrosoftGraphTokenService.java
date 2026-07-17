package com.example.proyecto.demo.Service;

import java.time.Instant;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;

/**
 * Obtiene tokens de acceso OAuth2 para Microsoft Graph usando el flujo client credentials.
 */
@Service
@Slf4j
public class MicrosoftGraphTokenService {

    private static final long TOKEN_EXPIRY_BUFFER_SECONDS = 60;

    private final RestTemplate restTemplate = new RestTemplate();
    private final String clientId;
    private final String tenantId;
    private final String clientSecret;
    private final String scope;
    private final String tokenUrl;

    private String cachedToken;
    private Instant tokenExpiresAt;

    public MicrosoftGraphTokenService(
            @Value("${azure.client-id}") String clientId,
            @Value("${azure.tenant-id}") String tenantId,
            @Value("${azure.client-secret}") String clientSecret,
            @Value("${azure.token-url-template}") String tokenUrlTemplate,
            @Value("${azure.scope}") String scope) {
        this.clientId = clientId != null ? clientId.trim() : "";
        this.tenantId = tenantId != null ? tenantId.trim() : "";
        this.clientSecret = clientSecret != null ? clientSecret.trim() : "";
        this.scope = scope != null ? scope.trim() : "";
        this.tokenUrl = String.format(tokenUrlTemplate, this.tenantId);
    }

    public String getAccessToken() {
        if (clientId.isBlank() || tenantId.isBlank() || clientSecret.isBlank()) {
            throw new IllegalStateException("Configuración de correo incompleta");
        }
        if (cachedToken != null && tokenExpiresAt != null && Instant.now().plusSeconds(TOKEN_EXPIRY_BUFFER_SECONDS).isBefore(tokenExpiresAt)) {
            return cachedToken;
        }

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id", clientId);
        params.add("client_secret", clientSecret);
        params.add("scope", scope);
        params.add("grant_type", "client_credentials");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restTemplate.postForObject(tokenUrl, params, Map.class);
        if (response == null) {
            throw new IllegalStateException("No se pudo obtener el token de Microsoft Graph");
        }

        Object accessToken = response.get("access_token");
        if (accessToken == null) {
            throw new IllegalStateException("La respuesta de token no contiene access_token: " + response);
        }

        int expiresIn = ((Number) response.getOrDefault("expires_in", 3600)).intValue();
        cachedToken = accessToken.toString();
        tokenExpiresAt = Instant.now().plusSeconds(expiresIn);
        log.debug("Token de Microsoft Graph obtenido, expira en {} s", expiresIn);
        return cachedToken;
    }
}
