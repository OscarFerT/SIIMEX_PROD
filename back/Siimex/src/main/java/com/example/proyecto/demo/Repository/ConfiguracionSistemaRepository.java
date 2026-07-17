package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.ConfiguracionSistema;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ConfiguracionSistemaRepository extends JpaRepository<ConfiguracionSistema, Long> {
    Optional<ConfiguracionSistema> findByClave(String clave);
    List<ConfiguracionSistema> findByClaveIn(Collection<String> claves);
}
