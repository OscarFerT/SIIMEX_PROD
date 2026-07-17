-- Migración: Tabla propiedad_intelectual
-- Se ejecuta automáticamente con Hibernate (ddl-auto=update).
-- Este script es opcional para entornos que usan migraciones SQL explícitas.

CREATE TABLE IF NOT EXISTS propiedad_intelectual (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    numero_registro VARCHAR(100),
    institucion_oficina VARCHAR(255),
    pais VARCHAR(100),
    fecha_registro DATE,
    anio INT,
    descripcion TEXT,
    documento_id BIGINT,
    CONSTRAINT fk_pi_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_pi_usuario ON propiedad_intelectual(usuario_id);
