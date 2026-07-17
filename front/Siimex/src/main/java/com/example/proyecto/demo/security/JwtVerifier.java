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

@Component
public class JwtVerifier {

    private final SecretKey key;

    public JwtVerifier(SecretKey key) {
        this.key = key;
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

        return new JwtPayload(authUserId, username, roles);
    }
}
