-- Migracion 20: correcciones de integridad, tipos e indices surgidas de la revision de codigo.
-- Motor: SQL Server. Es idempotente: se puede ejecutar mas de una vez.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF OBJECT_ID(N'dbo.schema_migration', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.schema_migration (
        version VARCHAR(20) NOT NULL PRIMARY KEY,
        descripcion VARCHAR(200) NOT NULL,
        aplicado_en DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
    );
END
GO

-- Roles validos: lista completa que usa la aplicacion
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_usuario_rol' AND parent_object_id = OBJECT_ID('dbo.usuario'))
    ALTER TABLE dbo.usuario DROP CONSTRAINT CK_usuario_rol;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_usuario_rol' AND parent_object_id = OBJECT_ID('dbo.usuario'))
    ALTER TABLE dbo.usuario WITH NOCHECK ADD CONSTRAINT CK_usuario_rol CHECK (rol IN (
        'administrador', 'gerente', 'jefe', 'analista', 'deposito', 'contador_ciclico',
        'operario_deposito', 'operario_planta', 'supervisor', 'solicitante'
    ));
GO

-- Comentarios de pedido: la cancelacion concatena el motivo al comentario existente
IF COL_LENGTH('dbo.pedido', 'comentario') IS NOT NULL AND COL_LENGTH('dbo.pedido', 'comentario') < 2000
    ALTER TABLE dbo.pedido ALTER COLUMN comentario VARCHAR(2000) NULL;
GO
IF COL_LENGTH('dbo.material_pedido', 'comentario') IS NOT NULL AND COL_LENGTH('dbo.material_pedido', 'comentario') < 1000
    ALTER TABLE dbo.material_pedido ALTER COLUMN comentario VARCHAR(1000) NULL;
GO

-- Precision de factores de BOM: consumos menores a 0,00005 por unidad se redondeaban a 0
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bom_estructura_raiz_padre' AND object_id = OBJECT_ID('dbo.bom_estructura'))
    DROP INDEX IX_bom_estructura_raiz_padre ON dbo.bom_estructura;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bom_estructura_version_hijo' AND object_id = OBJECT_ID('dbo.bom_estructura'))
    DROP INDEX IX_bom_estructura_version_hijo ON dbo.bom_estructura;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bom_plana_raiz' AND object_id = OBJECT_ID('dbo.bom_explosion_plana'))
    DROP INDEX IX_bom_plana_raiz ON dbo.bom_explosion_plana;
GO

ALTER TABLE dbo.bom_estructura ALTER COLUMN cantidad DECIMAL(18, 8) NOT NULL;
ALTER TABLE dbo.bom_explosion_plana ALTER COLUMN factor_consumo_total DECIMAL(18, 8) NOT NULL;
IF OBJECT_ID(N'dbo.bom_componente_directo', N'U') IS NOT NULL
    ALTER TABLE dbo.bom_componente_directo ALTER COLUMN cantidad DECIMAL(18, 8) NOT NULL;
IF OBJECT_ID(N'dbo.bom_extension', N'U') IS NOT NULL
BEGIN
    DECLARE @ck_extension SYSNAME;
    SELECT @ck_extension = cc.name
    FROM sys.check_constraints cc
    INNER JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
    WHERE cc.parent_object_id = OBJECT_ID('dbo.bom_extension') AND c.name = 'cantidad';
    IF @ck_extension IS NOT NULL
        EXEC('ALTER TABLE dbo.bom_extension DROP CONSTRAINT ' + @ck_extension);
    ALTER TABLE dbo.bom_extension ALTER COLUMN cantidad DECIMAL(18, 8) NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_bom_extension_cantidad')
        ALTER TABLE dbo.bom_extension WITH CHECK ADD CONSTRAINT CK_bom_extension_cantidad CHECK (cantidad > 0);
END
IF OBJECT_ID(N'dbo.bom_set_producto', N'U') IS NOT NULL
    ALTER TABLE dbo.bom_set_producto ALTER COLUMN cantidad DECIMAL(18, 8) NOT NULL;
IF OBJECT_ID(N'dbo.rundown_parametro_producto', N'U') IS NOT NULL
    ALTER TABLE dbo.rundown_parametro_producto ALTER COLUMN factor_uso DECIMAL(18, 8) NOT NULL;
GO

CREATE NONCLUSTERED INDEX IX_bom_estructura_raiz_padre
ON dbo.bom_estructura (id_version, id_producto_raiz, id_padre)
INCLUDE (id_hijo, cantidad, unidad, nivel, orden);

CREATE NONCLUSTERED INDEX IX_bom_estructura_version_hijo
ON dbo.bom_estructura (id_version, id_hijo)
INCLUDE (id_padre, cantidad);

CREATE NONCLUSTERED INDEX IX_bom_plana_raiz
ON dbo.bom_explosion_plana (id_producto_raiz)
INCLUDE (id_material_insumo, factor_consumo_total, unidad);
GO

-- Indices para filtros y joins frecuentes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mov_fecha' AND object_id = OBJECT_ID('dbo.movimiento_stock'))
    CREATE INDEX IX_mov_fecha ON dbo.movimiento_stock (fecha DESC, id_movimiento DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mov_material' AND object_id = OBJECT_ID('dbo.movimiento_stock'))
    CREATE INDEX IX_mov_material ON dbo.movimiento_stock (id_material);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_remito_pedido' AND object_id = OBJECT_ID('dbo.remito'))
    CREATE INDEX IX_remito_pedido ON dbo.remito (id_pedido, fecha_emision);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_auditoria_ent' AND object_id = OBJECT_ID('dbo.auditoria'))
    CREATE INDEX IX_auditoria_ent ON dbo.auditoria (entidad, id_entidad, fecha);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pp_fecha' AND object_id = OBJECT_ID('dbo.produccion_planificada'))
    CREATE INDEX IX_pp_fecha ON dbo.produccion_planificada (fecha) INCLUDE (id_producto, cantidad_planificada);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_rpm_material' AND object_id = OBJECT_ID('dbo.rundown_parametro_material'))
    CREATE INDEX IX_rpm_material ON dbo.rundown_parametro_material (id_material) INCLUDE (id_proveedor, activo);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pm_material' AND object_id = OBJECT_ID('dbo.proveedor_material'))
    CREATE INDEX IX_pm_material ON dbo.proveedor_material (id_material);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pedido_fecha_req' AND object_id = OBJECT_ID('dbo.pedido'))
    CREATE INDEX IX_pedido_fecha_req ON dbo.pedido (fecha_requerida, estado);
GO

-- Un solo parametro activo por material (solo si los datos actuales lo cumplen)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_rpm_material_activo' AND object_id = OBJECT_ID('dbo.rundown_parametro_material'))
BEGIN
    IF EXISTS (
        SELECT id_material FROM dbo.rundown_parametro_material WHERE activo = 1
        GROUP BY id_material HAVING COUNT(*) > 1
    )
        PRINT 'AVISO: hay materiales con mas de un parametro activo en rundown_parametro_material. No se creo UX_rpm_material_activo; depurar y volver a ejecutar.';
    ELSE
        CREATE UNIQUE INDEX UX_rpm_material_activo ON dbo.rundown_parametro_material (id_material) WHERE activo = 1;
END
GO

-- Indices duplicados
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_rundown_calendario_laboral_fecha' AND object_id = OBJECT_ID('dbo.rundown_calendario_laboral'))
   AND EXISTS (
       SELECT 1 FROM sys.indexes i
       INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
       INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
       WHERE i.object_id = OBJECT_ID('dbo.rundown_calendario_laboral')
         AND i.is_unique = 1 AND i.is_primary_key = 0
         AND i.name <> 'IX_rundown_calendario_laboral_fecha'
         AND c.name = 'fecha'
   )
    DROP INDEX IX_rundown_calendario_laboral_fecha ON dbo.rundown_calendario_laboral;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_rundown_stock_ajuste_mat_fecha' AND object_id = OBJECT_ID('dbo.rundown_stock_ajuste'))
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_rundown_stock_ajuste' AND object_id = OBJECT_ID('dbo.rundown_stock_ajuste'))
    DROP INDEX IX_rundown_stock_ajuste_mat_fecha ON dbo.rundown_stock_ajuste;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.schema_migration WHERE version = '20')
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.columns c
        WHERE (c.object_id = OBJECT_ID('dbo.bom_estructura') AND c.name = 'cantidad')
           OR (c.object_id = OBJECT_ID('dbo.bom_explosion_plana') AND c.name = 'factor_consumo_total')
           OR (c.object_id = OBJECT_ID('dbo.bom_componente_directo') AND c.name = 'cantidad')
           OR (c.object_id = OBJECT_ID('dbo.bom_extension') AND c.name = 'cantidad')
           OR (c.object_id = OBJECT_ID('dbo.bom_set_producto') AND c.name = 'cantidad')
           OR (c.object_id = OBJECT_ID('dbo.rundown_parametro_producto') AND c.name = 'factor_uso')
        HAVING MIN(c.scale) < 8
    )
        RAISERROR('La migracion 20 no se registro: hay columnas de factores que no quedaron con 8 decimales. Revisar los errores anteriores.', 16, 1);
    ELSE
        INSERT INTO dbo.schema_migration (version, descripcion)
        VALUES ('20', 'Revision: roles, comentarios, precision BOM, indices y unicidades');
END
GO
