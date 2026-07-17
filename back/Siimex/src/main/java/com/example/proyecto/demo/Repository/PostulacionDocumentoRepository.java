package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.PostulacionDocumento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PostulacionDocumentoRepository extends JpaRepository<PostulacionDocumento, Long> {

    List<PostulacionDocumento> findByPostulacionId(Long postulacionId);

    @Query("SELECT pd FROM PostulacionDocumento pd JOIN FETCH pd.documento WHERE pd.postulacion.id = :postulacionId")
    List<PostulacionDocumento> findByPostulacionIdWithDocumento(@Param("postulacionId") Long postulacionId);

    Optional<PostulacionDocumento> findByPostulacionIdAndClave(Long postulacionId, String clave);
}
