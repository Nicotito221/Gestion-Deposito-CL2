-- ============================================================================
-- Migracion de BOM para Base de Datos: GestionDeposito
-- Motor: Microsoft SQL Server
-- ============================================================================

USE GestionDeposito;
GO

IF OBJECT_ID(N'dbo.bom', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.bom;
END
GO

IF OBJECT_ID(N'dbo.bom_version', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bom_version (
        [id_version] int IDENTITY(1, 1) PRIMARY KEY,
        [nombre_archivo] varchar(150) NOT NULL,
        [fecha_importacion] datetime2(0) NOT NULL DEFAULT (SYSDATETIME()),
        [total_lineas] int NOT NULL,
        [es_vigente] bit NOT NULL DEFAULT (0),
        [observacion] varchar(250) NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_bom_version_activa' AND object_id = OBJECT_ID(N'dbo.bom_version'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_bom_version_activa 
    ON dbo.bom_version ([es_vigente]) 
    WHERE [es_vigente] = 1;
END
GO

IF OBJECT_ID(N'dbo.bom_estructura', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bom_estructura (
        [id_bom] int IDENTITY(1, 1) PRIMARY KEY,
        [id_version] int NOT NULL,
        [id_producto_raiz] varchar(30) NOT NULL,
        [id_padre] varchar(30) NOT NULL,
        [id_hijo] varchar(30) NOT NULL,
        [cantidad] decimal(18, 4) NOT NULL,
        [unidad] varchar(10) NOT NULL DEFAULT 'UN',
        [nivel] int NOT NULL,
        [orden] int NOT NULL DEFAULT 1,
        CONSTRAINT FK_bom_version FOREIGN KEY ([id_version]) REFERENCES dbo.bom_version ([id_version]) ON DELETE CASCADE,
        CONSTRAINT FK_bom_padre FOREIGN KEY ([id_padre]) REFERENCES dbo.material ([id_material]),
        CONSTRAINT FK_bom_hijo FOREIGN KEY ([id_hijo]) REFERENCES dbo.material ([id_material]),
        CONSTRAINT FK_bom_raiz FOREIGN KEY ([id_producto_raiz]) REFERENCES dbo.material ([id_material])
    );

    CREATE NONCLUSTERED INDEX IX_bom_estructura_raiz_padre 
    ON dbo.bom_estructura ([id_version], [id_producto_raiz], [id_padre]) 
    INCLUDE ([id_hijo], [cantidad], [unidad], [nivel], [orden]);

    CREATE NONCLUSTERED INDEX IX_bom_estructura_version_hijo 
    ON dbo.bom_estructura ([id_version], [id_hijo]) 
    INCLUDE ([id_padre], [cantidad]);
END
GO

IF OBJECT_ID(N'dbo.bom_explosion_plana', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bom_explosion_plana (
        [id_version] int NOT NULL,
        [id_producto_raiz] varchar(30) NOT NULL,
        [id_material_insumo] varchar(30) NOT NULL,
        [factor_consumo_total] decimal(18, 4) NOT NULL,
        [unidad] varchar(10) NOT NULL DEFAULT 'UN',
        PRIMARY KEY ([id_version], [id_producto_raiz], [id_material_insumo]),
        CONSTRAINT FK_bom_plana_version FOREIGN KEY ([id_version]) REFERENCES dbo.bom_version ([id_version]) ON DELETE CASCADE,
        CONSTRAINT FK_bom_plana_raiz FOREIGN KEY ([id_producto_raiz]) REFERENCES dbo.material ([id_material]),
        CONSTRAINT FK_bom_plana_insumo FOREIGN KEY ([id_material_insumo]) REFERENCES dbo.material ([id_material])
    );

    CREATE NONCLUSTERED INDEX IX_bom_plana_raiz 
    ON dbo.bom_explosion_plana ([id_producto_raiz]) 
    INCLUDE ([id_material_insumo], [factor_consumo_total], [unidad]);
END
GO

CREATE OR ALTER VIEW dbo.vw_bom_activa
AS
SELECT 
    p.[id_version],
    p.[id_producto_raiz] AS [id_producto],
    p.[id_material_insumo] AS [id_material],
    m.[nombre] AS [nombre_material],
    p.[factor_consumo_total] AS [cantidad_por_unidad],
    p.[unidad],
    v.[fecha_importacion]
FROM dbo.bom_explosion_plana p
INNER JOIN dbo.bom_version v ON p.[id_version] = v.[id_version]
INNER JOIN dbo.material m ON p.[id_material_insumo] = m.[id_material]
WHERE v.[es_vigente] = 1;
GO

CREATE OR ALTER PROCEDURE dbo.usp_generar_explosion_bom_version
    @id_version int
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.bom_explosion_plana WHERE [id_version] = @id_version;

    WITH JerarquiaBOM AS (
        SELECT 
            b.[id_producto_raiz] AS [id_raiz],
            b.[id_hijo] AS [id_actual],
            CAST(b.[cantidad] AS decimal(18, 4)) AS [factor_acumulado],
            b.[unidad],
            1 AS [profundidad]
        FROM dbo.bom_estructura b
        WHERE b.[id_version] = @id_version
          AND b.[id_padre] = b.[id_producto_raiz]

        UNION ALL

        SELECT 
            j.[id_raiz],
            b.[id_hijo] AS [id_actual],
            CAST(j.[factor_acumulado] * b.[cantidad] AS decimal(18, 4)) AS [factor_acumulado],
            b.[unidad],
            j.[profundidad] + 1 AS [profundidad]
        FROM dbo.bom_estructura b
        INNER JOIN JerarquiaBOM j 
           ON b.[id_version] = @id_version
          AND b.[id_producto_raiz] = j.[id_raiz]
          AND b.[id_padre] = j.[id_actual]
    )
    INSERT INTO dbo.bom_explosion_plana (
        [id_version],
        [id_producto_raiz],
        [id_material_insumo],
        [factor_consumo_total],
        [unidad]
    )
    SELECT 
        @id_version,
        j.[id_raiz],
        j.[id_actual],
        SUM(j.[factor_acumulado]),
        j.[unidad]
    FROM JerarquiaBOM j
    WHERE NOT EXISTS (
        SELECT 1 
        FROM dbo.bom_estructura sub 
        WHERE sub.[id_version] = @id_version 
          AND sub.[id_producto_raiz] = j.[id_raiz]
          AND sub.[id_padre] = j.[id_actual]
    )
    GROUP BY j.[id_raiz], j.[id_actual], j.[unidad]
    OPTION (MAXRECURSION 50);
END;
GO
