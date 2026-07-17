package com.example.proyecto.demo.Service;


import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.List;

import javax.crypto.SecretKey;


@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            SecretKey key,
            @Value("${security.jwt.expiration-ms:3600000}") long expirationMs
    ) {
        this.key = key;
        this.expirationMs = expirationMs;
    }

    public String generateToken(Long authUserId, String username, List<String> roles) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(authUserId.toString())
                .claim("username", username)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }
}
