package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    @Query("SELECT u FROM Usuario u LEFT JOIN FETCH u.registro1 WHERE u.authUser.id = :authUserId")
    Optional<Usuario> findByAuthUserIdWithRegistro1(@Param("authUserId") Long authUserId);
    
    @Query("SELECT u FROM Usuario u LEFT JOIN FETCH u.registro1 LEFT JOIN FETCH u.perfilMigracion WHERE u.authUser.id = :authUserId")
    Optional<Usuario> findByAuthUserIdWithRegistro1AndPerfilMigracion(@Param("authUserId") Long authUserId);

    // (opcional) Busca por el email del AuthUser
    Optional<Usuario> findByAuthUser_Email(String email);
    
    // Método para obtener todos los usuarios con sus relaciones para investigadores
    @Query("SELECT DISTINCT u FROM Usuario u LEFT JOIN FETCH u.authUser LEFT JOIN FETCH u.registro1 LEFT JOIN FETCH u.perfilMigracion WHERE u.authUser IS NOT NULL")
    List<Usuario> findAllWithRelations();

    // Variante para dashboard/admin: incluye también usuarios importados sin authUser.
    @Query("SELECT DISTINCT u FROM Usuario u LEFT JOIN FETCH u.authUser LEFT JOIN FETCH u.registro1 LEFT JOIN FETCH u.perfilMigracion")
    List<Usuario> findAllWithRelationsIncludingSinAuth();

    @Query("SELECT DISTINCT u FROM Usuario u JOIN FETCH u.authUser")
    List<Usuario> findAllWithAuthUser();
}
