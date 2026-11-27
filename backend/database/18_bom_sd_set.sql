-- Migracion 18: SD -> SET -> producto.
-- Los codigos de material se crean con el mismo tipo y largo que dbo.material.id_material
-- (en algunas bases es VARCHAR(30) y en otras VARCHAR(50)). Es idempotente.

DECLARE @tipo_codigo NVARCHAR(40) = (
    SELECT UPPER(t.name) + N'(' + CASE
        WHEN c.max_length = -1 THEN N'MAX'
        WHEN t.name IN (N'nvarchar', N'nchar') THEN CAST(c.max_length / 2 AS NVARCHAR(10))
        ELSE CAST(c.max_length AS NVARCHAR(10))
    END + N')'
    FROM sys.columns c
    INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.material') AND c.name = N'id_material'
);
DECLARE @sql NVARCHAR(MAX);

IF OBJECT_ID(N'dbo.bom_sd_set', N'U') IS NULL
BEGIN
    SET @sql = N'
    CREATE TABLE dbo.bom_sd_set (
        [codigo_sd] varchar(30) NOT NULL,
        [id_set] ' + @tipo_codigo + N' NOT NULL,
        [descripcion_sd] varchar(100) NULL,
        [cantidad] decimal(18, 4) NOT NULL DEFAULT 1.0,
        [unidad] varchar(10) NOT NULL DEFAULT ''UN'',
        [nombre_archivo] varchar(255) NULL,
        [fecha_carga] datetime2(0) NOT NULL DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_bom_sd_set PRIMARY KEY ([codigo_sd], [id_set]),
        CONSTRAINT FK_bom_sd_set_material FOREIGN KEY ([id_set]) REFERENCES dbo.material ([id_material])
    );
    CREATE NONCLUSTERED INDEX IX_bom_sd_set_set ON dbo.bom_sd_set ([id_set]) INCLUDE ([codigo_sd]);';
    EXEC sp_executesql @sql;
END

IF OBJECT_ID(N'dbo.bom_set_producto', N'U') IS NULL
BEGIN
    SET @sql = N'
    CREATE TABLE dbo.bom_set_producto (
        [id_set] ' + @tipo_codigo + N' NOT NULL,
        [id_producto] ' + @tipo_codigo + N' NOT NULL,
        [cantidad] decimal(18, 4) NOT NULL DEFAULT 1.0,
        [unidad] varchar(10) NOT NULL DEFAULT ''UN'',
        CONSTRAINT PK_bom_set_producto PRIMARY KEY ([id_set], [id_producto]),
        CONSTRAINT FK_bom_set_producto_set FOREIGN KEY ([id_set]) REFERENCES dbo.material ([id_material]),
        CONSTRAINT FK_bom_set_producto_producto FOREIGN KEY ([id_producto]) REFERENCES dbo.material ([id_material])
    );
    CREATE NONCLUSTERED INDEX IX_bom_set_producto_producto ON dbo.bom_set_producto ([id_producto]);';
    EXEC sp_executesql @sql;
END
GO
