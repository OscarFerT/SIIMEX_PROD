package com.example.proyecto.demo.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.proyecto.demo.Entity.EmailVerificationToken;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    Optional<EmailVerificationToken> findByToken(String token);

    Optional<EmailVerificationToken> findTopByAuthUser_IdOrderByCreatedAtDesc(Long authUserId);

    void deleteByAuthUser_Id(Long authUserId);
}
