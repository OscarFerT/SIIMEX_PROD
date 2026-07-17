package com.example.proyecto.demo.Service;

import com.example.proyecto.demo.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthAttemptService {

    private final int maxFailures;
    private final Duration lockDuration;
    private final ConcurrentHashMap<String, AttemptEntry> attempts = new ConcurrentHashMap<>();

    public AuthAttemptService(
            @Value("${security.auth.max-failed-attempts:5}") int maxFailures,
            @Value("${security.auth.lock-minutes:15}") long lockMinutes) {
        this.maxFailures = maxFailures;
        this.lockDuration = Duration.ofMinutes(lockMinutes);
    }

    public void assertNotLocked(String scope, String identifier) {
        String key = key(scope, identifier);
        AttemptEntry entry = attempts.get(key);
        if (entry == null || entry.lockedUntil == null) {
            return;
        }
        if (Instant.now().isAfter(entry.lockedUntil)) {
            attempts.remove(key);
            return;
        }
        throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos fallidos. Intenta más tarde.");
    }

    public void recordFailure(String scope, String identifier) {
        String key = key(scope, identifier);
        attempts.compute(key, (ignored, current) -> {
            int failures = current == null ? 1 : current.failures + 1;
            Instant lockedUntil = failures >= maxFailures ? Instant.now().plus(lockDuration) : null;
            return new AttemptEntry(failures, lockedUntil);
        });
    }

    public void recordSuccess(String scope, String identifier) {
        attempts.remove(key(scope, identifier));
    }

    private String key(String scope, String identifier) {
        String cleanIdentifier = identifier == null ? "" : identifier.trim().toLowerCase();
        return scope + ":" + cleanIdentifier;
    }

    private record AttemptEntry(int failures, Instant lockedUntil) {
    }
}
