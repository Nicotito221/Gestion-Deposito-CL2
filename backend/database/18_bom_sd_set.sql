IF OBJECT_ID(N'dbo.bom_sd_set', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bom_sd_set (
        [codigo_sd] varchar(30) NOT NULL,
        [id_set] varchar(30) NOT NULL,
        [descripcion_sd] varchar(100) NULL,
        [cantidad] decimal(18, 4) NOT NULL DEFAULT 1.0,
        [unidad] varchar(10) NOT NULL DEFAULT 'UN',
        [nombre_archivo] varchar(255) NULL,
        [fecha_carga] datetime2(0) NOT NULL DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_bom_sd_set PRIMARY KEY ([codigo_sd], [id_set]),
        CONSTRAINT FK_bom_sd_set_material FOREIGN KEY ([id_set]) REFERENCES dbo.material ([id_material])
    );

    CREATE NONCLUSTERED INDEX IX_bom_sd_set_set ON dbo.bom_sd_set ([id_set]) INCLUDE ([codigo_sd]);
END
GO

IF OBJECT_ID(N'dbo.bom_set_producto', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bom_set_producto (
        [id_set] varchar(30) NOT NULL,
        [id_producto] varchar(30) NOT NULL,
        [cantidad] decimal(18, 4) NOT NULL DEFAULT 1.0,
        [unidad] varchar(10) NOT NULL DEFAULT 'UN',
        CONSTRAINT PK_bom_set_producto PRIMARY KEY ([id_set], [id_producto]),
        CONSTRAINT FK_bom_set_producto_set FOREIGN KEY ([id_set]) REFERENCES dbo.material ([id_material]),
        CONSTRAINT FK_bom_set_producto_producto FOREIGN KEY ([id_producto]) REFERENCES dbo.material ([id_material])
    );

    CREATE NONCLUSTERED INDEX IX_bom_set_producto_producto ON dbo.bom_set_producto ([id_producto]);
END
GO
