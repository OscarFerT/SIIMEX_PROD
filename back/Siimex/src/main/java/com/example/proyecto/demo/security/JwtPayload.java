package com.example.proyecto.demo.security;

import java.util.Set;

public record JwtPayload(Long authUserId, String username, Set<String> roles) {}
