package com.example.proyecto.demo.Repository;

import com.example.proyecto.demo.Entity.CatalogOption;
import com.example.proyecto.demo.Entity.CatalogOption.CatalogType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CatalogOptionRepository extends JpaRepository<CatalogOption, Long> {

    long countByCatalogType(CatalogType catalogType);

    Optional<CatalogOption> findByCatalogTypeAndClaveIgnoreCase(CatalogType catalogType, String clave);

    List<CatalogOption> findByCatalogTypeAndActivoTrueOrderBySortOrderAscNombreAsc(CatalogType catalogType);

    List<CatalogOption> findByCatalogTypeAndParentKeyIgnoreCaseAndActivoTrueOrderBySortOrderAscNombreAsc(CatalogType catalogType, String parentKey);
}
