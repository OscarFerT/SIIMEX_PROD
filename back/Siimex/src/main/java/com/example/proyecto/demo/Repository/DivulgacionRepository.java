package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.Divulgacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DivulgacionRepository extends JpaRepository<Divulgacion, Long> {
    @Query("SELECT d FROM Divulgacion d WHERE d.usuario.id = :usuarioId")
    List<Divulgacion> findByUsuarioId(@Param("usuarioId") Long usuarioId);
}
