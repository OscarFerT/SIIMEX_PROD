-- Script SQL para cambiar columnas @Lob a LONGTEXT en MySQL
-- Ejecutar este script en la base de datos bd_siimex
-- Usuario: root
-- Base de datos: bd_siimex

USE bd_siimex;

-- ============================================
-- TABLA: trayectorias_profesionales
-- ============================================
ALTER TABLE trayectorias_profesionales 
MODIFY COLUMN logros LONGTEXT;

-- ============================================
-- TABLA: estancias
-- ============================================
ALTER TABLE estancias 
MODIFY COLUMN logros LONGTEXT;

ALTER TABLE estancias 
MODIFY COLUMN nombre_proyecto LONGTEXT;

-- ============================================
-- TABLA: trayectorias_academicas
-- ============================================
ALTER TABLE trayectorias_academicas 
MODIFY COLUMN titulo_tesis LONGTEXT;

-- ============================================
-- TABLA: logros
-- ============================================
ALTER TABLE logros 
MODIFY COLUMN nombre LONGTEXT;

-- ============================================
-- TABLA: intereses_habilidades
-- ============================================
ALTER TABLE intereses_habilidades 
MODIFY COLUMN interes_descripcion LONGTEXT;

-- ============================================
-- TABLA: cursos
-- ============================================
ALTER TABLE cursos 
MODIFY COLUMN nombre LONGTEXT;

-- ============================================
-- TABLA: congresos
-- ============================================
ALTER TABLE congresos 
MODIFY COLUMN nombre_evento LONGTEXT;

ALTER TABLE congresos 
MODIFY COLUMN titulo_trabajo LONGTEXT;

-- ============================================
-- TABLA: divulgaciones
-- ============================================
ALTER TABLE divulgaciones 
MODIFY COLUMN titulo LONGTEXT;

-- ============================================
-- TABLA: articulos
-- ============================================
ALTER TABLE articulos 
MODIFY COLUMN nombre_revista LONGTEXT;

ALTER TABLE articulos 
MODIFY COLUMN titulo LONGTEXT;

ALTER TABLE articulos 
MODIFY COLUMN fondo_programa_nombre LONGTEXT;

-- ============================================
-- VERIFICACIÓN DE CAMBIOS
-- ============================================
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'bd_siimex'
    AND COLUMN_NAME IN (
        'logros', 
        'nombre_proyecto', 
        'titulo_tesis', 
        'nombre', 
        'interes_descripcion',
        'nombre_evento',
        'titulo_trabajo',
        'titulo',
        'nombre_revista',
        'fondo_programa_nombre'
    )
ORDER BY 
    TABLE_NAME, COLUMN_NAME;

-- Verificar que todas las columnas sean LONGTEXT
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    CASE 
        WHEN DATA_TYPE = 'longtext' THEN '✓ OK'
        ELSE '✗ NECESITA CAMBIO'
    END AS ESTADO
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'bd_siimex'
    AND COLUMN_NAME IN (
        'logros', 
        'nombre_proyecto', 
        'titulo_tesis', 
        'nombre', 
        'interes_descripcion',
        'nombre_evento',
        'titulo_trabajo',
        'titulo',
        'nombre_revista',
        'fondo_programa_nombre'
    )
ORDER BY 
    TABLE_NAME, COLUMN_NAME;
