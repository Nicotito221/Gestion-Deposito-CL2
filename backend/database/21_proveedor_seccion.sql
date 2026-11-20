-- Migracion 21: un proveedor puede pertenecer a mas de una linea (seccion de rundown).
-- Motor: SQL Server. Es idempotente.

IF OBJECT_ID(N'dbo.proveedor_seccion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.proveedor_seccion (
        id_proveedor INT NOT NULL,
        id_seccion INT NOT NULL,
        CONSTRAINT PK_proveedor_seccion PRIMARY KEY (id_proveedor, id_seccion),
        CONSTRAINT FK_proveedor_seccion_proveedor FOREIGN KEY (id_proveedor) REFERENCES dbo.proveedor (id_proveedor),
        CONSTRAINT FK_proveedor_seccion_seccion FOREIGN KEY (id_seccion) REFERENCES dbo.rundown_seccion (id_seccion)
    );

    CREATE INDEX IX_proveedor_seccion_seccion ON dbo.proveedor_seccion (id_seccion);
END
GO

INSERT INTO dbo.proveedor_seccion (id_proveedor, id_seccion)
SELECT p.id_proveedor, p.id_seccion
FROM dbo.proveedor p
WHERE p.id_seccion IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.proveedor_seccion ps
      WHERE ps.id_proveedor = p.id_proveedor AND ps.id_seccion = p.id_seccion
  );
GO

IF OBJECT_ID(N'dbo.schema_migration', N'U') IS NOT NULL
    EXEC('IF NOT EXISTS (SELECT 1 FROM dbo.schema_migration WHERE version = ''21'')
              INSERT INTO dbo.schema_migration (version, descripcion) VALUES (''21'', ''Proveedores en varias lineas (proveedor_seccion)'')');
GO
