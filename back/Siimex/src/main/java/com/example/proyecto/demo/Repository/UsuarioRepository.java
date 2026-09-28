package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Query(value = """
            SELECT DISTINCT u FROM Usuario u
            JOIN u.authUser au
            LEFT JOIN u.registro1 r
            WHERE au.enabled = true
              AND r.tipoPerfil IN :tipos
              AND (
                :busqueda IS NULL OR :busqueda = '' OR
                LOWER(COALESCE(u.nombre, '')) LIKE LOWER(CONCAT('%', :busqueda, '%')) OR
                LOWER(COALESCE(u.apellidoPaterno, '')) LIKE LOWER(CONCAT('%', :busqueda, '%')) OR
                LOWER(COALESCE(u.apellidoMaterno, '')) LIKE LOWER(CONCAT('%', :busqueda, '%'))
              )
              AND (
                :grado IS NULL OR :grado = '' OR
                EXISTS (
                  SELECT ta.id FROM TrayectoriaAcademica ta
                  WHERE ta.usuario = u
                    AND LOWER(COALESCE(ta.nivelNombre, '')) = LOWER(:grado)
                )
              )
              AND (
                :area IS NULL OR :area = '' OR
                EXISTS (
                  SELECT ac.id FROM AreaConocimiento ac
                  WHERE ac.usuario = u
                    AND (
                      LOWER(COALESCE(ac.areaNombre, '')) = LOWER(:area) OR
                      LOWER(COALESCE(ac.campoNombre, '')) = LOWER(:area) OR
                      LOWER(COALESCE(ac.disciplinaNombre, '')) = LOWER(:area) OR
                      LOWER(COALESCE(ac.subdisciplinaNombre, '')) = LOWER(:area)
                    )
                )
              )
              AND (
                :palabrasClave IS NULL OR :palabrasClave = '' OR
                LOWER(CONCAT(
                  COALESCE(u.nombre, ''), ' ',
                  COALESCE(u.apellidoPaterno, ''), ' ',
                  COALESCE(u.apellidoMaterno, ''), ' ',
                  COALESCE(u.semblanza, '')
                )) LIKE LOWER(CONCAT('%', :palabrasClave, '%')) OR
                EXISTS (
                  SELECT ac2.id FROM AreaConocimiento ac2
                  WHERE ac2.usuario = u
                    AND LOWER(CONCAT(
                      COALESCE(ac2.areaNombre, ''), ' ',
                      COALESCE(ac2.campoNombre, ''), ' ',
                      COALESCE(ac2.disciplinaNombre, ''), ' ',
                      COALESCE(ac2.subdisciplinaNombre, '')
                    )) LIKE LOWER(CONCAT('%', :palabrasClave, '%'))
                ) OR
                EXISTS (
                  SELECT h.id FROM Herramienta h
                  WHERE h.usuario = u
                    AND LOWER(COALESCE(h.nombre, '')) LIKE LOWER(CONCAT('%', :palabrasClave, '%'))
                ) OR
                EXISTS (
                  SELECT i.id FROM Idioma i
                  WHERE i.usuario = u
                    AND LOWER(CONCAT(COALESCE(i.nombre, ''), ' ', COALESCE(i.dominioNombre, ''), ' ', COALESCE(i.conversacion, ''))) LIKE LOWER(CONCAT('%', :palabrasClave, '%'))
                )
              )
            """,
            countQuery = """
            SELECT COUNT(DISTINCT u) FROM Usuario u
            JOIN u.authUser au
            LEFT JOIN u.registro1 r
            WHERE au IS NOT NULL
              AND au.enabled = true
              AND r.tipoPerfil IN :tipos
              AND (
                :busqueda IS NULL OR :busqueda = '' OR
                LOWER(COALESCE(u.nombre, '')) LIKE LOWER(CONCAT('%', :busqueda, '%')) OR
                LOWER(COALESCE(u.apellidoPaterno, '')) LIKE LOWER(CONCAT('%', :busqueda, '%')) OR
                LOWER(COALESCE(u.apellidoMaterno, '')) LIKE LOWER(CONCAT('%', :busqueda, '%'))
              )
              AND (
                :grado IS NULL OR :grado = '' OR
                EXISTS (
                  SELECT ta.id FROM TrayectoriaAcademica ta
                  WHERE ta.usuario = u
                    AND LOWER(COALESCE(ta.nivelNombre, '')) = LOWER(:grado)
                )
              )
              AND (
                :area IS NULL OR :area = '' OR
                EXISTS (
                  SELECT ac.id FROM AreaConocimiento ac
                  WHERE ac.usuario = u
                    AND (
                      LOWER(COALESCE(ac.areaNombre, '')) = LOWER(:area) OR
                      LOWER(COALESCE(ac.campoNombre, '')) = LOWER(:area) OR
                      LOWER(COALESCE(ac.disciplinaNombre, '')) = LOWER(:area) OR
                      LOWER(COALESCE(ac.subdisciplinaNombre, '')) = LOWER(:area)
                    )
                )
              )
              AND (
                :palabrasClave IS NULL OR :palabrasClave = '' OR
                LOWER(CONCAT(
                  COALESCE(u.nombre, ''), ' ',
                  COALESCE(u.apellidoPaterno, ''), ' ',
                  COALESCE(u.apellidoMaterno, ''), ' ',
                  COALESCE(u.semblanza, '')
                )) LIKE LOWER(CONCAT('%', :palabrasClave, '%')) OR
                EXISTS (
                  SELECT ac2.id FROM AreaConocimiento ac2
                  WHERE ac2.usuario = u
                    AND LOWER(CONCAT(
                      COALESCE(ac2.areaNombre, ''), ' ',
                      COALESCE(ac2.campoNombre, ''), ' ',
                      COALESCE(ac2.disciplinaNombre, ''), ' ',
                      COALESCE(ac2.subdisciplinaNombre, '')
                    )) LIKE LOWER(CONCAT('%', :palabrasClave, '%'))
                ) OR
                EXISTS (
                  SELECT h.id FROM Herramienta h
                  WHERE h.usuario = u
                    AND LOWER(COALESCE(h.nombre, '')) LIKE LOWER(CONCAT('%', :palabrasClave, '%'))
                ) OR
                EXISTS (
                  SELECT i.id FROM Idioma i
                  WHERE i.usuario = u
                    AND LOWER(CONCAT(COALESCE(i.nombre, ''), ' ', COALESCE(i.dominioNombre, ''), ' ', COALESCE(i.conversacion, ''))) LIKE LOWER(CONCAT('%', :palabrasClave, '%'))
                )
              )
            """)
    Page<Usuario> findDirectorioPage(@Param("tipos") List<com.example.proyecto.demo.Entity.Registro1.TipoPerfil> tipos,
                                     @Param("busqueda") String busqueda,
                                     @Param("grado") String grado,
                                     @Param("area") String area,
                                     @Param("palabrasClave") String palabrasClave,
                                     Pageable pageable);

    @Query("""
            SELECT DISTINCT ta.nivelNombre FROM TrayectoriaAcademica ta
            JOIN ta.usuario u
            JOIN u.authUser au
            LEFT JOIN u.registro1 r
            WHERE au IS NOT NULL
              AND au.enabled = true
              AND r.tipoPerfil IN :tipos
              AND ta.nivelNombre IS NOT NULL
              AND ta.nivelNombre <> ''
            ORDER BY ta.nivelNombre
            """)
    List<String> findDirectorioGradosByTipos(@Param("tipos") List<com.example.proyecto.demo.Entity.Registro1.TipoPerfil> tipos);

    @Query("""
            SELECT DISTINCT ac.areaNombre FROM AreaConocimiento ac
            JOIN ac.usuario u
            JOIN u.authUser au
            LEFT JOIN u.registro1 r
            WHERE au IS NOT NULL
              AND au.enabled = true
              AND r.tipoPerfil IN :tipos
              AND ac.areaNombre IS NOT NULL
              AND ac.areaNombre <> ''
            ORDER BY ac.areaNombre
            """)
    List<String> findDirectorioAreasByTipos(@Param("tipos") List<com.example.proyecto.demo.Entity.Registro1.TipoPerfil> tipos);

    @Query("""
            SELECT COUNT(DISTINCT u) FROM Usuario u
            JOIN u.authUser au
            LEFT JOIN u.registro1 r
            WHERE au IS NOT NULL
              AND au.enabled = true
              AND r.tipoPerfil IN :tipos
            """)
    long countDirectorioByTipos(@Param("tipos") List<com.example.proyecto.demo.Entity.Registro1.TipoPerfil> tipos);

    @Query("SELECT DISTINCT u FROM Usuario u JOIN FETCH u.authUser")
    List<Usuario> findAllWithAuthUser();
}
