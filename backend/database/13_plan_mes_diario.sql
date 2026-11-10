IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'plan_mes_diario')
BEGIN
    CREATE TABLE dbo.plan_mes_diario (
        anio INT NOT NULL,
        mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
        id_importacion INT NULL,
        fecha_carga DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_plan_mes_diario PRIMARY KEY (anio, mes)
    );
END;
GO
