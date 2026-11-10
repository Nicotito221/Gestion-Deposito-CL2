IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'demanda_despacho')
BEGIN
    CREATE TABLE dbo.demanda_despacho (
        id_despacho INT IDENTITY(1,1) PRIMARY KEY,
        id_producto VARCHAR(50) NOT NULL,
        empresa_destino NVARCHAR(100) NOT NULL,
        anio INT NOT NULL,
        mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
        cantidad DECIMAL(18,4) NOT NULL CHECK (cantidad >= 0),
        observacion NVARCHAR(250) NULL,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        id_usuario_creacion INT NULL,
        fecha_actualizacion DATETIME2 NULL,
        id_usuario_actualizacion INT NULL,
        CONSTRAINT UQ_demanda_despacho UNIQUE (id_producto, empresa_destino, anio, mes)
    );
    CREATE INDEX IX_demanda_despacho_periodo ON dbo.demanda_despacho (anio, mes);
END;
GO
