-- Script SQL para crear la tabla de herramientas
-- Ejecutar este script en la base de datos bd_siimex

USE bd_siimex;

-- Crear tabla de herramientas
CREATE TABLE IF NOT EXISTS herramientas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_herramientas_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar que la tabla se creó correctamente
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_KEY
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'bd_siimex'
    AND TABLE_NAME = 'herramientas'
ORDER BY 
    ORDINAL_POSITION;
