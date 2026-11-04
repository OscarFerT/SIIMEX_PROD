package com.example.proyecto.demo.security;

import com.example.proyecto.demo.Entity.Usuario;
import java.util.Locale;

public final class PublicProfilePolicy {
    private PublicProfilePolicy() {}

    public static boolean canPublish(Usuario user) {
        if (user == null || !Boolean.TRUE.equals(user.getConsentimientoDirectorioPublico())
                || user.getAuthUser() == null || user.getRegistro1() == null
                || user.getRegistro1().getTipoPerfil() == null) return false;
        var account = user.getAuthUser();
        return account.isEnabled() && !account.isLocked() && !account.getRoles().contains("ROLE_ADMIN");
    }

    public static String visibility(Usuario user) {
        String value = user != null && user.getVisibilidadPerfil() != null
                ? user.getVisibilidadPerfil().trim().toUpperCase(Locale.ROOT) : "MINIMA";
        return switch (value) {
            case "ESTANDAR", "COMPLETA" -> value;
            default -> "MINIMA";
        };
    }
}
