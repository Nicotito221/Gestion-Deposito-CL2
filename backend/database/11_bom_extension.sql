DECLARE @largo_material INT = COL_LENGTH('dbo.material', 'id_material');
DECLARE @tipo_codigo NVARCHAR(20) = N'VARCHAR(' + CAST(@largo_material AS NVARCHAR(10)) + N')';
DECLARE @sql NVARCHAR(MAX);

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bom_componente_directo')
BEGIN
    SET @sql = N'
    CREATE TABLE dbo.bom_componente_directo (
        id_version INT NOT NULL FOREIGN KEY REFERENCES dbo.bom_version(id_version),
        id_padre ' + @tipo_codigo + N' NOT NULL,
        id_hijo ' + @tipo_codigo + N' NOT NULL,
        cantidad DECIMAL(18,4) NOT NULL,
        unidad VARCHAR(10) NOT NULL DEFAULT ''UN'',
        CONSTRAINT PK_bom_componente_directo PRIMARY KEY (id_version, id_padre, id_hijo)
    );';
    EXEC sp_executesql @sql;
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bom_extension')
BEGIN
    SET @sql = N'
    CREATE TABLE dbo.bom_extension (
        id_extension INT IDENTITY(1,1) PRIMARY KEY,
        id_padre ' + @tipo_codigo + N' NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        id_hijo ' + @tipo_codigo + N' NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        cantidad DECIMAL(18,4) NOT NULL CHECK (cantidad > 0),
        unidad VARCHAR(10) NOT NULL DEFAULT ''UN'',
        observacion NVARCHAR(250) NULL,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion INT NULL,
        fecha_actualizacion DATETIME2 NULL,
        id_usuario_actualizacion INT NULL,
        CONSTRAINT UQ_bom_extension UNIQUE (id_padre, id_hijo),
        CONSTRAINT CK_bom_extension_distintos CHECK (id_padre <> id_hijo)
    );';
    EXEC sp_executesql @sql;
END;
GO
