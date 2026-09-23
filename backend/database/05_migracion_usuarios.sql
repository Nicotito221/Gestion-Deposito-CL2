DECLARE @ConstraintName nvarchar(200);
SELECT @ConstraintName = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('dbo.usuario') 
  AND definition LIKE '%rol%';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.usuario DROP CONSTRAINT ' + @ConstraintName);
END;

ALTER TABLE dbo.usuario 
ADD CONSTRAINT CK_usuario_rol 
CHECK (rol IN ('administrador', 'supervisor', 'operario_deposito', 'operario_planta', 'solicitante'));

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuario' AND COLUMN_NAME = 'sector')
BEGIN
    ALTER TABLE dbo.usuario ADD sector VARCHAR(50) NOT NULL CONSTRAINT DF_usuario_sector DEFAULT 'TODOS';
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuario' AND COLUMN_NAME = 'email')
BEGIN
    ALTER TABLE dbo.usuario ADD email VARCHAR(120) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuario' AND COLUMN_NAME = 'ultimo_acceso')
BEGIN
    ALTER TABLE dbo.usuario ADD ultimo_acceso DATETIME2(0) NULL;
END;
