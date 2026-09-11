-- ============================================================================
-- Tabla de configuracion maestra: Relacion Sets / Demandas -> Componentes 1° Nivel
-- Base de Datos: GestionDeposito
-- Motor: Microsoft SQL Server
-- ============================================================================

USE GestionDeposito;
GO

IF OBJECT_ID(N'dbo.set_componente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.set_componente (
        [id_set_componente] int IDENTITY(1, 1) PRIMARY KEY,
        [sector] varchar(50) NULL,
        [sd] varchar(50) NULL,
        [codigo_tasa] varchar(50) NOT NULL,
        [codigo_sap_padre] varchar(50) NOT NULL,
        [id_material_hijo] varchar(50) NOT NULL,
        [cantidad] decimal(18, 4) NOT NULL DEFAULT 1.0,
        [activo] bit NOT NULL DEFAULT 1,
        [fecha_creacion] datetime2(0) NOT NULL DEFAULT (SYSDATETIME())
    );

    CREATE NONCLUSTERED INDEX IX_set_componente_padres
    ON dbo.set_componente ([activo], [codigo_tasa], [codigo_sap_padre])
    INCLUDE ([id_material_hijo], [cantidad], [sector], [sd]);

    CREATE NONCLUSTERED INDEX IX_set_componente_hijo
    ON dbo.set_componente ([activo], [id_material_hijo]);
END
GO
