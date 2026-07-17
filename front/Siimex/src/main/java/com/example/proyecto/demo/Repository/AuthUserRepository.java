package com.example.proyecto.demo.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
   
import com.example.proyecto.demo.Entity.AuthUser;   

public interface AuthUserRepository extends JpaRepository<AuthUser, Long> {
    Optional<AuthUser> findByEmail(String email);
    boolean existsByEmail(String email);
}

