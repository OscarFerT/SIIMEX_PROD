-- Convierte fechas de convocatorias a fecha-hora.
-- Necesario si la tabla ya existía con columnas DATE, porque Hibernate ddl-auto=update
-- normalmente no cambia el tipo de columnas existentes de DATE a DATETIME.

ALTER TABLE convocatorias
  MODIFY fecha_apertura DATETIME NULL,
  MODIFY fecha_cierre DATETIME NOT NULL;