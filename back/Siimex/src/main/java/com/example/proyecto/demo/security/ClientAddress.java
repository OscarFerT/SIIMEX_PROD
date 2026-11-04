package com.example.proyecto.demo.security;

import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletRequestWrapper;
import jakarta.servlet.http.HttpServletRequest;

public final class ClientAddress {
    private ClientAddress() {}

    public static String remote(HttpServletRequest request) {
        ServletRequest original = request;
        // Framework forwarded-header wrappers must not make client-supplied headers trusted.
        while (original instanceof ServletRequestWrapper wrapper) original = wrapper.getRequest();
        return original.getRemoteAddr();
    }
}
