package com.example.proyecto.demo.controller;

import com.example.proyecto.demo.security.JwtPayload;
import com.example.proyecto.demo.security.JwtVerifier;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

    private final JwtVerifier jwtVerifier;

    public UserController(JwtVerifier jwtVerifier) {
        this.jwtVerifier = jwtVerifier;
    }

    @GetMapping("/me")
    public JwtPayload me(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        return jwtVerifier.verifyAndParse(token);
    }
}
