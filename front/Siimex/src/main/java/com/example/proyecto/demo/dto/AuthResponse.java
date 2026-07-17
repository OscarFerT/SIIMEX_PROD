package com.example.proyecto.demo.dto;



import lombok.Data;
@Data
public class AuthResponse {
    private Long userId;
    private String username;
    private String token;

    public AuthResponse(Long userId, String username, String token) {
        this.userId = userId;
        this.username = username;
        this.token = token;
    }

}
