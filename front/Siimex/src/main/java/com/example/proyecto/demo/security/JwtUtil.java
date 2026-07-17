package com.example.proyecto.demo.security;

import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Component ("JwtUtilSecurity")
public class JwtUtil {

    private final Key key;
    private final long expirationMillis;

    public JwtUtil(
            @Value("${security.jwt.secret-base64}") String base64Secret,
            @Value("${security.jwt.expiration-ms:3600000}") long expirationMillis // 1h default
    ) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(base64Secret));
        this.expirationMillis = expirationMillis;
    }

    public String generateToken(Long authUserId, String username, Set<String> roles) {
        Instant now = Instant.now();
        Instant exp = now.plusMillis(expirationMillis);

        return Jwts.builder()
                .setSubject(String.valueOf(authUserId))
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(exp))
                .claim("username", username)
                .claim("roles", roles)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }
}