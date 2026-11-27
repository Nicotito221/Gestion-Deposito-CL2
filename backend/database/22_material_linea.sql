-- Migracion 22: cada material del rundown puede asignarse a una linea del proveedor.
-- Si el material no tiene linea (o su linea ya no es del proveedor), se muestra en la primera linea del proveedor.
-- Motor: SQL Server. Es idempotente.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'dbo.rundown_parametro_material', N'id_seccion') IS NULL
BEGIN
    ALTER TABLE dbo.rundown_parametro_material ADD id_seccion INT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_rpm_seccion')
BEGIN
    ALTER TABLE dbo.rundown_parametro_material
        ADD CONSTRAINT FK_rpm_seccion FOREIGN KEY (id_seccion) REFERENCES dbo.rundown_seccion (id_seccion);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_rpm_seccion' AND object_id = OBJECT_ID(N'dbo.rundown_parametro_material')
)
BEGIN
    CREATE INDEX IX_rpm_seccion ON dbo.rundown_parametro_material (id_seccion) WHERE id_seccion IS NOT NULL;
END
GO

IF OBJECT_ID(N'dbo.schema_migration', N'U') IS NOT NULL
    EXEC('IF NOT EXISTS (SELECT 1 FROM dbo.schema_migration WHERE version = ''22'')
              INSERT INTO dbo.schema_migration (version, descripcion) VALUES (''22'', ''Linea por material del rundown'')');
GO
