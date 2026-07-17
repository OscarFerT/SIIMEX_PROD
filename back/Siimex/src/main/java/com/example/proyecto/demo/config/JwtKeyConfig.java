package com.example.proyecto.demo.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.SecretKey;

@Configuration
@Slf4j
public class JwtKeyConfig {
    @Bean
    public SecretKey jwtSecretKey(
            @Value("${security.jwt.secret-base64}") String base64Secret,
            @Value("${spring.profiles.active:}") String activeProfiles
    ) {
        if (StringUtils.hasText(base64Secret)) {
            return Keys.hmacShaKeyFor(Decoders.BASE64.decode(base64Secret)); // >= 256 bits
        }

        boolean isProd = StringUtils.hasText(activeProfiles) && activeProfiles.toLowerCase().contains("prod");
        if (isProd) {
            throw new IllegalStateException(
                    "Falta configurar security.jwt.secret-base64 (o JWT_SECRET_BASE64) en producción."
            );
        }

        log.warn("JWT secret no configurado. Se generará una clave temporal para desarrollo. "
                + "Los tokens dejarán de ser válidos al reiniciar la aplicación.");
        return Jwts.SIG.HS256.key().build();
    }
}
