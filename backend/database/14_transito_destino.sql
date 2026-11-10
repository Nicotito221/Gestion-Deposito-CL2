IF COL_LENGTH('dbo.rundown_transito_arribo', 'destino') IS NULL
BEGIN
    ALTER TABLE dbo.rundown_transito_arribo
        ADD destino VARCHAR(10) NOT NULL
            CONSTRAINT DF_rundown_transito_arribo_destino DEFAULT 'total'
            CONSTRAINT CK_rundown_transito_arribo_destino CHECK (destino IN ('total', 'planta'));
END;
GO
