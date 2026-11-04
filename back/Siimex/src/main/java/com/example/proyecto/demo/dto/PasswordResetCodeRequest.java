package com.example.proyecto.demo.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetCodeRequest(@NotBlank @Email @Size(max = 180) String email) {}
