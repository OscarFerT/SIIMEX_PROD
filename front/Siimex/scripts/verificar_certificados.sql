-- Script SQL para verificar certificados en la base de datos
-- Ejecutar este script para revisar qué certificados están guardados

USE bd_siimex;

-- Ver todos los documentos de tipo CERTIFICADO o OTRO que sean certificaciones
SELECT 
    d.id,
    d.tipo,
    d.nombre_archivo,
    d.content_type,
    d.size_bytes,
    d.fecha_subida,
    d.usuario_id,
    u.nombre as usuario_nombre
FROM 
    documentos d
    INNER JOIN usuarios u ON d.usuario_id = u.id
WHERE 
    d.tipo IN ('CERTIFICADO_1', 'CERTIFICADO_2', 'OTRO')
    AND (
        UPPER(d.nombre_archivo) LIKE 'CERTIFICADO_%'
        OR UPPER(d.nombre_archivo) LIKE 'OTRO_CERTIFICADO_%'
        OR UPPER(d.nombre_archivo) LIKE 'CERTIFICACIONES_%'
        OR UPPER(d.nombre_archivo) LIKE '%CERTIFICADO%'
        OR UPPER(d.nombre_archivo) LIKE '%CERTIFICACIONES%'
    )
ORDER BY 
    d.usuario_id, d.fecha_subida DESC;

-- Contar certificados por usuario
SELECT 
    u.id as usuario_id,
    u.nombre as usuario_nombre,
    COUNT(*) as total_certificados
FROM 
    documentos d
    INNER JOIN usuarios u ON d.usuario_id = u.id
WHERE 
    d.tipo IN ('CERTIFICADO_1', 'CERTIFICADO_2', 'OTRO')
    AND (
        UPPER(d.nombre_archivo) LIKE 'CERTIFICADO_%'
        OR UPPER(d.nombre_archivo) LIKE 'OTRO_CERTIFICADO_%'
        OR UPPER(d.nombre_archivo) LIKE 'CERTIFICACIONES_%'
        OR UPPER(d.nombre_archivo) LIKE '%CERTIFICADO%'
        OR UPPER(d.nombre_archivo) LIKE '%CERTIFICACIONES%'
    )
GROUP BY 
    u.id, u.nombre
ORDER BY 
    u.id;

-- Verificar que todos tengan contentType
SELECT 
    d.id,
    d.tipo,
    d.nombre_archivo,
    d.content_type,
    CASE 
        WHEN d.content_type IS NULL OR d.content_type = '' THEN '✗ SIN CONTENT TYPE'
        ELSE '✓ OK'
    END AS estado_content_type
FROM 
    documentos d
WHERE 
    d.tipo IN ('CERTIFICADO_1', 'CERTIFICADO_2', 'OTRO')
    AND (
        UPPER(d.nombre_archivo) LIKE 'CERTIFICADO_%'
        OR UPPER(d.nombre_archivo) LIKE 'OTRO_CERTIFICADO_%'
        OR UPPER(d.nombre_archivo) LIKE 'CERTIFICACIONES_%'
        OR UPPER(d.nombre_archivo) LIKE '%CERTIFICADO%'
        OR UPPER(d.nombre_archivo) LIKE '%CERTIFICACIONES%'
    )
ORDER BY 
    d.usuario_id, d.fecha_subida DESC;
