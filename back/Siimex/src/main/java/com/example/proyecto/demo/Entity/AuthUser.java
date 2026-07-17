package com.example.proyecto.demo.Entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "auth_users", indexes = {
        @Index(name = "idx_auth_users_username", columnList = "username", unique = true),
        @Index(name = "idx_auth_users_email", columnList = "email", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    
    @OneToOne(mappedBy = "authUser",  cascade = CascadeType.ALL)
    @JoinColumn(name = "usuario_id", unique = true) // AuthUser tiene la FK
    private Usuario usuario;


    @Column(nullable = false, length = 80, unique = true)
    private String username;         // o usar email como username

    @Column(nullable = false, length = 180, unique = true)
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Column(nullable = false, length = 72) // BCrypt ~60
    private String passwordHash;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(nullable = false)
    @Builder.Default
    private boolean locked = false;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "auth_user_roles", joinColumns = @JoinColumn(name = "auth_user_id"))
    @Column(name = "role", length = 40)
    @Builder.Default
    private Set<String> roles = new HashSet<>();

    /** Fecha y hora del último inicio de sesión exitoso. */
    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    /** Token "recuérdame" hasheado para saltar 2FA en dispositivos de confianza. */
    @Column(name = "remember_token_hash", length = 64)
    private String rememberTokenHash;

    @Column(name = "remember_token_expiry")
    private Instant rememberTokenExpiry;
}
