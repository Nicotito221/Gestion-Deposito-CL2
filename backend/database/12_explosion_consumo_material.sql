IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'explosion_consumo_material')
BEGIN
    CREATE TABLE dbo.explosion_consumo_material (
        id_explosion_consumo BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_material VARCHAR(50) NOT NULL,
        descripcion NVARCHAR(250) NULL,
        proveedor NVARCHAR(150) NULL,
        tipo_periodo CHAR(1) NOT NULL CHECK (tipo_periodo IN ('D', 'M')),
        anio INT NOT NULL,
        mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
        fecha DATE NOT NULL,
        cantidad DECIMAL(18,4) NOT NULL,
        id_importacion INT NULL,
        fecha_generacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_explosion_consumo_material_material ON dbo.explosion_consumo_material (id_material, fecha);
    CREATE INDEX IX_explosion_consumo_material_periodo ON dbo.explosion_consumo_material (anio, mes, tipo_periodo);
END;
GO
