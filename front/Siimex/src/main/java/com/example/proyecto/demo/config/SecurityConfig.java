package com.example.proyecto.demo.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.example.proyecto.demo.config.RedirectUnauthorizedEntryPoint;
import com.example.proyecto.demo.security.JwtFilter;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableMethodSecurity // por si usas @PreAuthorize
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final RedirectUnauthorizedEntryPoint redirectUnauthorizedEntryPoint;

    @Value("${app.cors.allowed-origin-patterns}")
    private List<String> allowedOriginPatterns;

    @Value("${app.security.require-https:false}")
    private boolean requireHttps;

    @Value("${app.security.hsts-max-age-seconds:31536000}")
    private long hstsMaxAgeSeconds;

    @Value("${app.security.content-security-policy:default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'}")
    private String contentSecurityPolicy;

    @Value("${app.security.permissions-policy:geolocation=(), microphone=(), camera=()}")
    private String permissionsPolicy;

    @Bean
    public SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
                // API stateless: desactiva CSRF para permitir POST/PATCH/DELETE sin token CSRF
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requiresChannel(channel -> {
                    if (requireHttps) {
                        channel.anyRequest().requiresSecure();
                    }
                })
                .headers(headers -> headers
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .preload(true)
                                .maxAgeInSeconds(hstsMaxAgeSeconds)
                        )
                        .contentSecurityPolicy(csp -> csp.policyDirectives(contentSecurityPolicy))
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(Customizer.withDefaults())
                        .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .permissionsPolicyHeader(permissions -> permissions.policy(permissionsPolicy))
                )

                // Autorizaciones
                .authorizeHttpRequests(auth -> auth

                        // Preflight de navegadores
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Público
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/contacto").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/contacto").permitAll()
                        .requestMatchers(
                                HttpMethod.POST,
                                "/auth/register",
                                "/api/auth/register",
                                "/auth/verify-email",
                                "/api/auth/verify-email",
                                "/auth/login",
                                "/api/auth/login",
                                "/auth/login-admin",
                                "/api/auth/login-admin",
                                "/auth/login/request-code",
                                "/api/auth/login/request-code",
                                "/auth/login/verify-code",
                                "/api/auth/login/verify-code",
                                "/auth/reset-password",
                                "/api/auth/reset-password"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/info", "/api/actuator/health", "/api/actuator/info").permitAll()
                        .requestMatchers(HttpMethod.POST, "/registro1").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/registro1").permitAll()
                        .requestMatchers(HttpMethod.POST, "/migracion").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/migracion").authenticated()


                        // Usuarios: exige estar autenticado (primero probamos así para descartar rol)
                        //.requestMatchers("/usuarios/**").authenticated()
                        //.anyRequest().authenticated()
                        .requestMatchers(HttpMethod.GET, "/documentos/publico/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/documentos/publico/**").permitAll()
                        .requestMatchers("/documentos/**").authenticated()
                        .requestMatchers("/api/documentos/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/folios-aprobados").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/folios-aprobados").permitAll()
                        .requestMatchers(HttpMethod.GET, "/usuarios/investigadores").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/usuarios/investigadores").permitAll()
                        .requestMatchers(HttpMethod.GET, "/convocatorias-imagenes/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/convocatorias-imagenes/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/usuarios/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/usuarios/me").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/usuarios/me").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/usuarios/me").authenticated()
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )

                // Filtro JWT antes del filtro de usuario/clave
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)

                // 401: redirigir al login del frontend (evita Whitelabel Error Page)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(redirectUnauthorizedEntryPoint)
                        .accessDeniedHandler((req, res, ex) -> res.sendError(HttpServletResponse.SC_FORBIDDEN))
                )

                // Opcional: CORS si pegas desde navegador
                .cors(Customizer.withDefaults());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();

        cfg.setAllowedOriginPatterns(allowedOriginPatterns);

        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*")); // incluye Content-Type y Authorization
        cfg.setExposedHeaders(List.of("Authorization","Content-Type","Cache-Control"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
}
