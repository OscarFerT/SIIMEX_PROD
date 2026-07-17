package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Documento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentoRepository extends JpaRepository<Documento, Long> {
    
    /**
     * Obtiene documentos SIN cargar el contenido BLOB (optimizado para listados)
     * Solo carga metadatos: id, tipo, nombreArchivo, contentType, sizeBytes, fechaSubida
     */
    @Query("SELECT d FROM Documento d WHERE d.usuario.id = :usuarioId")
    List<Documento> findByUsuarioId(@Param("usuarioId") Long usuarioId);
    
    /**
     * Obtiene un documento específico (incluye contenido BLOB solo cuando se accede)
     */
    @Query("SELECT d FROM Documento d WHERE d.usuario.id = :usuarioId AND d.tipo = :tipo")
    Optional<Documento> findByUsuarioIdAndTipo(@Param("usuarioId") Long usuarioId, @Param("tipo") Documento.TipoDocumento tipo);
    
    /**
     * Obtiene documentos por lista de tipos SIN cargar contenido BLOB
     */
    @Query("SELECT d FROM Documento d WHERE d.usuario.id = :usuarioId AND d.tipo IN :tipos")
    List<Documento> findByUsuarioIdAndTipoIn(@Param("usuarioId") Long usuarioId, @Param("tipos") List<Documento.TipoDocumento> tipos);
}
