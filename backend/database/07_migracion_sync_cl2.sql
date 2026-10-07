-- Migracion: Tablas de soporte para Sincronizacion Segura CL2 y Auditoria de Terceros
-- Motor: Microsoft SQL Server

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SyncOutbox' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SyncOutbox (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        AggregateType NVARCHAR(50) NOT NULL,
        AggregateId NVARCHAR(100) NOT NULL,
        EventType NVARCHAR(50) NOT NULL,
        PayloadJson NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
        RetryCount INT NOT NULL DEFAULT 0,
        MaxRetries INT NOT NULL DEFAULT 5,
        NextRetryAt DATETIME2 NULL,
        ProcessedAt DATETIME2 NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_SyncOutbox_Status_NextRetryAt 
    ON dbo.SyncOutbox (Status, NextRetryAt);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProcessedEvents' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ProcessedEvents (
        EventId NVARCHAR(100) PRIMARY KEY,
        EventType NVARCHAR(50) NOT NULL,
        ProcessedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO
