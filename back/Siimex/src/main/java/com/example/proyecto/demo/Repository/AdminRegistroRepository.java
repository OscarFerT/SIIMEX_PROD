package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Usuario;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/** Scalar projections keep profile relations, credentials and document BLOBs out of the listing. */
public interface AdminRegistroRepository extends Repository<Usuario, Long> {
    String FROM = """
            FROM usuarios u
            JOIN auth_users a ON a.id = u.auth_user_id
            LEFT JOIN registro1 r ON r.id = u.id
            """;
    String FILTROS = """
            WHERE (:perfil = '' OR r.tipo_perfil = :perfil)
              AND (:sexo = '' OR r.genero = :sexo)
              AND (:entidad = '' OR TRIM(r.entidad_federativa) = :entidad)
              AND (:municipio = '' OR TRIM(r.municipio) = :municipio)
              AND (:busqueda = '' OR
                LOWER(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido_paterno, ''), ' ',
                             COALESCE(u.apellido_materno, ''))) LIKE :busqueda ESCAPE '!' OR
                LOWER(COALESCE(a.email, '')) LIKE :busqueda ESCAPE '!' OR
                LOWER(COALESCE(r.curp, '')) LIKE :busqueda ESCAPE '!' OR
                LOWER(COALESCE(r.tipo_perfil, '')) LIKE :busqueda ESCAPE '!' OR
                LOWER(COALESCE(r.genero, '')) LIKE :busqueda ESCAPE '!' OR
                LOWER(COALESCE(r.entidad_federativa, '')) LIKE :busqueda ESCAPE '!' OR
                LOWER(COALESCE(r.municipio, '')) LIKE :busqueda ESCAPE '!' OR
                REPLACE(COALESCE(r.telefono, ''), ' ', '') LIKE :telefono ESCAPE '!')
            """;

    @Query(value = """
            SELECT u.id AS id, a.id AS authUserId, u.nombre AS nombre,
                   u.apellido_paterno AS apellidoPaterno, u.apellido_materno AS apellidoMaterno,
                   a.email AS email, a.last_login_at AS lastLoginAt,
                   r.curp AS curp, r.rfc AS rfc, r.tipo_perfil AS tipoPerfil,
                   r.telefono AS telefono, r.genero AS genero,
                   r.entidad_federativa AS entidadFederativa, r.municipio AS municipio,
                   (SELECT d.id FROM documentos d WHERE d.usuario_id = u.id AND d.tipo = 'FOTO_PERFIL'
                    ORDER BY d.fecha_subida DESC, d.id DESC LIMIT 1) AS fotoDocumentoId,
                   CASE WHEN EXISTS (
                     SELECT 1 FROM lista_negra l WHERE l.activa = true
                       AND (l.fecha_inicio IS NULL OR l.fecha_inicio <= :hoy)
                       AND (l.fecha_fin IS NULL OR l.fecha_fin >= :hoy)
                       AND (l.usuario_id = u.id OR
                         (a.email IS NOT NULL AND a.email <> '' AND LOWER(l.email) = LOWER(TRIM(a.email))) OR
                         (r.curp IS NOT NULL AND r.curp <> '' AND UPPER(l.curp) = UPPER(TRIM(r.curp))))
                   ) THEN 1 ELSE 0 END AS bloqueadoListaNegra
            """ + FROM + FILTROS + " ORDER BY u.id ASC",
            countQuery = "SELECT COUNT(*) " + FROM + FILTROS, nativeQuery = true)
    Page<Resumen> buscar(@Param("busqueda") String busqueda, @Param("telefono") String telefono,
                         @Param("perfil") String perfil, @Param("sexo") String sexo,
                         @Param("entidad") String entidad, @Param("municipio") String municipio,
                         @Param("hoy") LocalDate hoy, Pageable pageable);

    @Query(value = "SELECT COUNT(*) FROM usuarios u JOIN auth_users a ON a.id = u.auth_user_id", nativeQuery = true)
    long contarTodos();

    @Query(value = "SELECT DISTINCT TRIM(r.entidad_federativa) " + FROM +
            " WHERE TRIM(COALESCE(r.entidad_federativa, '')) <> '' ORDER BY 1", nativeQuery = true)
    List<String> entidades();

    @Query(value = "SELECT DISTINCT TRIM(r.municipio) " + FROM +
            " WHERE TRIM(COALESCE(r.municipio, '')) <> '' ORDER BY 1", nativeQuery = true)
    List<String> municipios();

    @Query(value = "SELECT auth_user_id AS authUserId, role AS rol FROM auth_user_roles WHERE auth_user_id IN :ids", nativeQuery = true)
    List<Rol> roles(@Param("ids") List<Long> ids);

    @Query(value = "SELECT u.id " + FROM + FILTROS + " ORDER BY u.id ASC", nativeQuery = true)
    List<Long> idsParaExportar(@Param("busqueda") String busqueda, @Param("telefono") String telefono,
                              @Param("perfil") String perfil, @Param("sexo") String sexo,
                              @Param("entidad") String entidad, @Param("municipio") String municipio);

    @Query(value = "SELECT u.id FROM usuarios u JOIN auth_users a ON a.id = u.auth_user_id WHERE u.id IN :ids ORDER BY u.id", nativeQuery = true)
    List<Long> idsExistentes(@Param("ids") List<Long> ids);

    @Query(value = "SELECT COUNT(*) FROM auth_users a JOIN auth_user_roles r ON r.auth_user_id = a.id " +
            "WHERE a.id = :id AND a.enabled = true AND a.locked = false AND r.role = 'ROLE_ADMIN'", nativeQuery = true)
    long contarAdministradorActivo(@Param("id") Long id);

    interface Resumen {
        Long getId();
        Long getAuthUserId();
        String getNombre();
        String getApellidoPaterno();
        String getApellidoMaterno();
        String getEmail();
        Object getLastLoginAt();
        String getCurp();
        String getRfc();
        String getTipoPerfil();
        String getTelefono();
        String getGenero();
        String getEntidadFederativa();
        String getMunicipio();
        Long getFotoDocumentoId();
        Integer getBloqueadoListaNegra();
    }

    interface Rol {
        Long getAuthUserId();
        String getRol();
    }
}
