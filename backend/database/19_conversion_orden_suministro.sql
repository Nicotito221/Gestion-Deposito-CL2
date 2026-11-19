IF OBJECT_ID(N'dbo.conversion_orden_suministro', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.conversion_orden_suministro (
        [pn_orden] varchar(30) NOT NULL PRIMARY KEY,
        [codigo_tasa] varchar(30) NULL,
        [codigo_sap] varchar(30) NULL,
        [nombre_archivo] varchar(255) NULL,
        [fecha_carga] datetime2(0) NOT NULL DEFAULT (SYSDATETIME())
    );
END
GO
