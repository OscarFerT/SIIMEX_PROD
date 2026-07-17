package com.example.proyecto.demo.security;

import java.time.Instant;
import java.util.Date;
import java.util.Set;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Component ("JwtUtilSecurity")
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMillis;

    public JwtUtil(
            @Value("${security.jwt.secret-base64}") String base64Secret,
            @Value("${security.jwt.expiration-ms}") long expirationMillis
    ) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(base64Secret));
        this.expirationMillis = expirationMillis;
    }

    public String generateToken(Long authUserId, String username, Set<String> roles) {
        Instant now = Instant.now();
        Instant exp = now.plusMillis(expirationMillis);

        return Jwts.builder()
                .subject(String.valueOf(authUserId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .claim("username", username)
                .claim("roles", roles)
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }
}
