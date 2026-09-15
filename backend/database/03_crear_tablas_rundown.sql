IF NOT EXISTS (SELECT 1 FROM dbo.proveedor WHERE codigo_proveedor = 'HOWA')
BEGIN
    INSERT INTO dbo.proveedor (codigo_proveedor, nombre, pais, activo)
    VALUES ('HOWA', 'HOWA TRAMICO S.A.', 'Argentina', 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_parametro_material')
BEGIN
    CREATE TABLE dbo.rundown_parametro_material (
        id_parametro INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.proveedor(id_proveedor),
        id_material VARCHAR(50) NOT NULL,
        descripcion VARCHAR(150) NULL,
        unidad VARCHAR(10) NOT NULL DEFAULT 'MTS',
        lote_mts DECIMAL(18,4) NULL,
        scrap_porcentaje DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
        factor_conversion DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
        categoria_cabina VARCHAR(30) NULL,
        stock_inicial_referencia DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        fecha_stock_inicial DATE NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_rundown_parametro_material ON dbo.rundown_parametro_material (id_proveedor, id_material);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_parametro_producto')
BEGIN
    CREATE TABLE dbo.rundown_parametro_producto (
        id_parametro_producto INT IDENTITY(1,1) PRIMARY KEY,
        id_parametro INT NOT NULL FOREIGN KEY REFERENCES dbo.rundown_parametro_material(id_parametro) ON DELETE CASCADE,
        id_producto VARCHAR(50) NOT NULL,
        factor_uso DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_rundown_parametro_producto ON dbo.rundown_parametro_producto (id_parametro, id_producto);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_transito_arribo')
BEGIN
    CREATE TABLE dbo.rundown_transito_arribo (
        id_transito INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.proveedor(id_proveedor),
        id_material VARCHAR(50) NOT NULL,
        fecha_eta DATE NOT NULL,
        tipo_via VARCHAR(30) NOT NULL,
        po_numero VARCHAR(50) NULL,
        factura_numero VARCHAR(50) NULL,
        cantidad DECIMAL(18,4) NOT NULL,
        observacion VARCHAR(255) NULL,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_rundown_transito_arribo ON dbo.rundown_transito_arribo (id_proveedor, id_material, fecha_eta);
END
GO
