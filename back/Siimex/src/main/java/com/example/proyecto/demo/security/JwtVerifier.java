package com.example.proyecto.demo.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.security.Key;
import java.util.List;
import java.util.Set;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import com.example.proyecto.demo.Repository.AuthUserRepository;

@Component
public class JwtVerifier {

    private final SecretKey key;
    private final AuthUserRepository accounts;

    public JwtVerifier(SecretKey key, AuthUserRepository accounts) {
        this.key = key;
        this.accounts = accounts;
    }

    public JwtPayload verifyAndParse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Long authUserId = Long.valueOf(claims.getSubject());
        String username = claims.get("username", String.class);

        @SuppressWarnings("unchecked")
        List<String> rolesList = (List<String>) claims.get("roles");
        Set<String> roles = Set.copyOf(rolesList);

        var account = accounts.findById(authUserId)
                .orElseThrow(() -> new IllegalArgumentException("Sesion no valida"));
        SessionSecurity.requireActive(account);
        String stamp = claims.get("session", String.class);
        if (stamp == null || !MessageDigest.isEqual(stamp.getBytes(StandardCharsets.UTF_8),
                SessionSecurity.stamp(account, key).getBytes(StandardCharsets.UTF_8))
                || !roles.equals(account.getRoles())) {
            throw new IllegalArgumentException("La sesion ha sido revocada");
        }

        return new JwtPayload(authUserId, username, roles);
    }
}
