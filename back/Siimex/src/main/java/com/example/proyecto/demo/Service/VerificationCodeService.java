package com.example.proyecto.demo.Service;

import java.security.SecureRandom;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;
import com.example.proyecto.demo.exception.ApiException;
import org.springframework.http.HttpStatus;

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
        String key = email.toLowerCase().trim();
        long now = System.currentTimeMillis();
        cleanup(now);
        if (store.size() >= 10000 && !store.containsKey(key)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Intenta mas tarde.");
        }
        store.compute(key, (ignored, previous) -> {
            if (previous != null && now - previous.createdAt < 60000) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Espera un minuto antes de solicitar otro codigo.");
            }
            return new CodeEntry(code, now + TimeUnit.MINUTES.toMillis(EXPIRY_MINUTES), now, 0);
        });
        return code;
    }

    public void store(String key, String code) {
        long now = System.currentTimeMillis();
        cleanup(now);
        if (store.size() >= 10000 && !store.containsKey(key)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Intenta mas tarde.");
        }
        store.put(key.toLowerCase().trim(), new CodeEntry(code,
                now + TimeUnit.MINUTES.toMillis(EXPIRY_MINUTES), now, 0));
    }

    public boolean verify(String email, String code) {
        if (email == null || code == null || !code.matches("[0-9]{6}")) return false;
        String key = email.toLowerCase().trim();
        AtomicBoolean valid = new AtomicBoolean();
        // Consume atomically: concurrent requests cannot reuse the same code.
        store.computeIfPresent(key, (ignored, entry) -> {
            if (System.currentTimeMillis() > entry.expiresAt || entry.attempts >= 5) return null;
            if (MessageDigest.isEqual(entry.code.getBytes(StandardCharsets.UTF_8), code.getBytes(StandardCharsets.UTF_8))) {
                valid.set(true);
                return null;
            }
            return new CodeEntry(entry.code, entry.expiresAt, entry.createdAt, entry.attempts + 1);
        });
        return valid.get();
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

    private void cleanup(long now) {
        store.entrySet().removeIf(entry -> entry.getValue().expiresAt < now);
    }

    private record CodeEntry(String code, long expiresAt, long createdAt, int attempts) {}
}
