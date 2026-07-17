package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Articulo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ArticuloRepository extends JpaRepository<Articulo, Long> {
    @Query("SELECT a FROM Articulo a WHERE a.usuario.id = :usuarioId")
    List<Articulo> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
