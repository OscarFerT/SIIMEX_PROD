-- Agrega columna limite_aceptados a convocatorias (null = sin límite)
-- Ejecutar solo si la columna no existe (Hibernate con ddl-auto=update la crea automáticamente)
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS limite_aceptados INTEGER NULL;
