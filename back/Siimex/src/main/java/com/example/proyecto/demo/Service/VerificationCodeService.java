package com.example.proyecto.demo.Service;

import java.security.SecureRandom;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * Almacena temporalmente códigos de verificación en memoria (email -> código).
 * Los códigos expiran tras 5 minutos.
 */
@Service
@Slf4j
public class VerificationCodeService {

    private static final int EXPIRY_MINUTES = 5;
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final ConcurrentHashMap<String, CodeEntry> store = new ConcurrentHashMap<>();

    public String generateAndStore(String email) {
        String code = generateCode();
        long expiresAt = System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(EXPIRY_MINUTES);
        store.put(email.toLowerCase().trim(), new CodeEntry(code, expiresAt));
        log.info("Código de verificación generado para {}", email);
        return code;
    }

    public boolean verify(String email, String code) {
        String key = email.toLowerCase().trim();
        CodeEntry entry = store.get(key);
        if (entry == null) return false;
        if (System.currentTimeMillis() > entry.expiresAt) {
            store.remove(key);
            return false;
        }
        boolean ok = entry.code.equals(code.trim());
        if (ok) store.remove(key);
        return ok;
    }

    public void invalidate(String email) {
        store.remove(email.toLowerCase().trim());
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(SECURE_RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    private record CodeEntry(String code, long expiresAt) {}
}
