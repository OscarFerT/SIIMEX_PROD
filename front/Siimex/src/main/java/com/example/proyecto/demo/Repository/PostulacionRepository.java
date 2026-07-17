package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Postulacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PostulacionRepository extends JpaRepository<Postulacion, Long> {

    @Query("SELECT p FROM Postulacion p WHERE p.usuario.id = :usuarioId ORDER BY p.fechaCreacion DESC")
    List<Postulacion> findByUsuarioId(@Param("usuarioId") Long usuarioId);

    @Query("SELECT p FROM Postulacion p JOIN FETCH p.convocatoria LEFT JOIN FETCH p.curriculumDocumento WHERE p.usuario.id = :usuarioId ORDER BY p.fechaCreacion DESC")
    List<Postulacion> findByUsuarioIdWithConvocatoria(@Param("usuarioId") Long usuarioId);

    @Query("SELECT p FROM Postulacion p JOIN FETCH p.usuario u LEFT JOIN FETCH u.authUser JOIN FETCH p.convocatoria LEFT JOIN FETCH p.curriculumDocumento LEFT JOIN FETCH p.informeParcialDocumento LEFT JOIN FETCH p.informeFinalDocumento LEFT JOIN FETCH p.reciboPagoDocumento LEFT JOIN FETCH p.cartaEvaluadorDocumento LEFT JOIN FETCH p.dictamenEvaluacionDocumento LEFT JOIN FETCH p.constanciaEvaluadorDocumento LEFT JOIN FETCH p.oficioAprobacionDocumento LEFT JOIN FETCH p.nombramientoDocumento WHERE p.convocatoria.id = :convocatoriaId ORDER BY p.fechaCreacion DESC")
    List<Postulacion> findByConvocatoriaIdWithUsuario(@Param("convocatoriaId") Long convocatoriaId);

    @Query("SELECT DISTINCT p FROM Postulacion p JOIN FETCH p.usuario u LEFT JOIN FETCH u.authUser LEFT JOIN FETCH u.registro1 JOIN FETCH p.convocatoria LEFT JOIN FETCH p.curriculumDocumento LEFT JOIN FETCH p.informeParcialDocumento LEFT JOIN FETCH p.informeFinalDocumento LEFT JOIN FETCH p.reciboPagoDocumento LEFT JOIN FETCH p.cartaEvaluadorDocumento LEFT JOIN FETCH p.dictamenEvaluacionDocumento LEFT JOIN FETCH p.constanciaEvaluadorDocumento LEFT JOIN FETCH p.oficioAprobacionDocumento LEFT JOIN FETCH p.nombramientoDocumento ORDER BY p.fechaCreacion DESC")
    List<Postulacion> findAllWithUsuarioAndConvocatoria();

    @Query("SELECT p FROM Postulacion p WHERE p.convocatoria.id = :convocatoriaId")
    List<Postulacion> findByConvocatoriaId(@Param("convocatoriaId") Long convocatoriaId);

    @Query("SELECT p FROM Postulacion p WHERE p.usuario.id = :usuarioId AND p.convocatoria.id = :convocatoriaId")
    List<Postulacion> findByUsuarioIdAndConvocatoriaId(@Param("usuarioId") Long usuarioId, @Param("convocatoriaId") Long convocatoriaId);

    @Query("SELECT p FROM Postulacion p JOIN FETCH p.convocatoria LEFT JOIN FETCH p.curriculumDocumento LEFT JOIN FETCH p.informeParcialDocumento LEFT JOIN FETCH p.informeFinalDocumento LEFT JOIN FETCH p.reciboPagoDocumento LEFT JOIN FETCH p.cartaEvaluadorDocumento LEFT JOIN FETCH p.dictamenEvaluacionDocumento LEFT JOIN FETCH p.constanciaEvaluadorDocumento LEFT JOIN FETCH p.oficioAprobacionDocumento LEFT JOIN FETCH p.nombramientoDocumento WHERE p.usuario.id = :usuarioId AND p.convocatoria.id = :convocatoriaId ORDER BY p.fechaCreacion DESC")
    List<Postulacion> findByUsuarioIdAndConvocatoriaIdWithConvocatoria(@Param("usuarioId") Long usuarioId, @Param("convocatoriaId") Long convocatoriaId);

    @Query("SELECT p FROM Postulacion p LEFT JOIN FETCH p.curriculumDocumento LEFT JOIN FETCH p.informeParcialDocumento LEFT JOIN FETCH p.informeFinalDocumento LEFT JOIN FETCH p.reciboPagoDocumento LEFT JOIN FETCH p.cartaEvaluadorDocumento LEFT JOIN FETCH p.dictamenEvaluacionDocumento LEFT JOIN FETCH p.constanciaEvaluadorDocumento LEFT JOIN FETCH p.oficioAprobacionDocumento LEFT JOIN FETCH p.nombramientoDocumento WHERE p.id = :postulacionId")
    Optional<Postulacion> findByIdWithCurriculum(@Param("postulacionId") Long postulacionId);

    long countByConvocatoriaIdAndEstado(Long convocatoriaId, String estado);

    @Query("SELECT COUNT(p) FROM Postulacion p WHERE p.convocatoria.id = :convocatoriaId AND LOWER(p.evaluadorEmail) = LOWER(:email)")
    long countByConvocatoriaIdAndEvaluadorEmailIgnoreCase(@Param("convocatoriaId") Long convocatoriaId, @Param("email") String email);

    @Query("SELECT COUNT(p) FROM Postulacion p JOIN p.usuario u JOIN u.authUser au WHERE p.convocatoria.id = :convocatoriaId AND LOWER(au.email) = LOWER(:email)")
    long countByConvocatoriaIdAndUsuarioAuthEmailIgnoreCase(@Param("convocatoriaId") Long convocatoriaId, @Param("email") String email);

    @Query("SELECT LOWER(au.email) FROM Postulacion p JOIN p.usuario u JOIN u.authUser au WHERE p.convocatoria.id = :convocatoriaId")
    List<String> findUsuarioAuthEmailsByConvocatoriaId(@Param("convocatoriaId") Long convocatoriaId);

    @Query("SELECT p FROM Postulacion p JOIN FETCH p.usuario u LEFT JOIN FETCH u.registro1 JOIN FETCH p.convocatoria WHERE p.convocatoria.id = :convocatoriaId AND UPPER(p.estado) = 'ACEPTADA' ORDER BY p.fechaCreacion ASC")
    List<Postulacion> findAceptadasByConvocatoriaIdWithUsuario(@Param("convocatoriaId") Long convocatoriaId);

    @Query("SELECT DISTINCT p FROM Postulacion p JOIN FETCH p.usuario u LEFT JOIN FETCH u.authUser LEFT JOIN FETCH u.registro1 JOIN FETCH p.convocatoria c WHERE (UPPER(p.estado) = 'ACEPTADA' OR UPPER(p.estadoComite) = 'APROBADA') AND UPPER(p.estado) <> 'CANCELADA' ORDER BY c.fechaCierre DESC, p.fechaCreacion DESC")
    List<Postulacion> findBeneficiariasAprobadas();

    @Query("SELECT p FROM Postulacion p JOIN FETCH p.usuario u LEFT JOIN FETCH u.authUser LEFT JOIN FETCH u.registro1 JOIN FETCH p.convocatoria LEFT JOIN FETCH p.curriculumDocumento LEFT JOIN FETCH p.informeParcialDocumento LEFT JOIN FETCH p.informeFinalDocumento LEFT JOIN FETCH p.cartaEvaluadorDocumento LEFT JOIN FETCH p.dictamenEvaluacionDocumento LEFT JOIN FETCH p.constanciaEvaluadorDocumento WHERE LOWER(p.evaluadorEmail) = LOWER(:email) ORDER BY p.fechaCreacion DESC")
    List<Postulacion> findByEvaluadorEmailWithUsuarioAndConvocatoria(@Param("email") String email);

    @Query("SELECT p FROM Postulacion p JOIN FETCH p.usuario u LEFT JOIN FETCH u.authUser JOIN FETCH p.convocatoria WHERE (p.estadoComite = 'APROBADA' OR p.estado = 'ACEPTADA') AND p.estado <> 'CANCELADA'")
    List<Postulacion> findAprobadasConInformesActivos();
}
