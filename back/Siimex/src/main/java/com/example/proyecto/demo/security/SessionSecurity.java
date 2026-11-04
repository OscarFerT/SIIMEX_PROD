package com.example.proyecto.demo.security;

import com.example.proyecto.demo.Entity.AuthUser;
import com.example.proyecto.demo.exception.ApiException;
import org.springframework.http.HttpStatus;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;

public final class SessionSecurity {
    private SessionSecurity() {}

    public static void requireActive(AuthUser account) {
        if (!account.isEnabled() || account.isLocked()) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "La cuenta no esta activa. Verifica tu correo o contacta al administrador.");
        }
    }

    public static String stamp(AuthUser account, SecretKey key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getEncoded(), "HmacSHA256"));
            String state = account.getId() + ":" + account.getSessionVersion() + ":" + account.getPasswordHash();
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(state.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se pudo validar la sesion", e);
        }
    }
}
