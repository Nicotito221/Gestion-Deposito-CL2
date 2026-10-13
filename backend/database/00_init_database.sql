-- ============================================================================
-- 00_init_database.sql
-- Inicialización limpia de la Base de Datos para Gestión Depósito
-- Motor: Microsoft SQL Server (T-SQL)
-- ============================================================================

SET NOCOUNT ON;

-- 1. TABLA: rundown_seccion
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_seccion')
BEGIN
    CREATE TABLE dbo.rundown_seccion (
        id_seccion INT IDENTITY(1,1) PRIMARY KEY,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(255) NULL,
        orden INT NOT NULL DEFAULT 1,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

-- 2. TABLA: proveedor
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'proveedor')
BEGIN
    CREATE TABLE dbo.proveedor (
        id_proveedor INT IDENTITY(1,1) PRIMARY KEY,
        codigo_proveedor VARCHAR(50) NULL UNIQUE,
        nombre VARCHAR(100) NOT NULL,
        pais VARCHAR(50) NULL,
        activo BIT NOT NULL DEFAULT 1,
        id_seccion INT NULL FOREIGN KEY REFERENCES dbo.rundown_seccion(id_seccion),
        dias_alerta_rojo FLOAT NULL DEFAULT 5.0,
        dias_alerta_amarillo FLOAT NULL DEFAULT 15.0,
        deposito_en_planta BIT NOT NULL DEFAULT 0,
        doh_sugerido_planta FLOAT NOT NULL DEFAULT 1.0
    );
END;

-- 3. TABLA: usuario
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'usuario')
BEGIN
    CREATE TABLE dbo.usuario (
        id_usuario INT IDENTITY(1,1) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        rol NVARCHAR(50) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        sector VARCHAR(50) NOT NULL DEFAULT 'TODOS',
        email VARCHAR(120) NULL,
        ultimo_acceso DATETIME2 NULL,
        eliminado BIT NOT NULL DEFAULT 0,
        CONSTRAINT CK_usuario_rol CHECK (rol IN (
            'administrador', 'gerente', 'jefe', 'analista', 'deposito',
            'contador_ciclico', 'operario_deposito', 'operario_planta', 'supervisor', 'solicitante'
        ))
    );
END;

-- 4. TABLA: material
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'material')
BEGIN
    CREATE TABLE dbo.material (
        id_material VARCHAR(50) NOT NULL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        unidad VARCHAR(10) NULL DEFAULT 'UN',
        categoria VARCHAR(50) NULL,
        centro VARCHAR(20) NULL,
        lote_minimo DECIMAL(18,4) NULL DEFAULT 0,
        controla_stock BIT NOT NULL DEFAULT 1,
        id_proveedor_principal INT NULL FOREIGN KEY REFERENCES dbo.proveedor(id_proveedor),
        activo BIT NOT NULL DEFAULT 1,
        tipo_empaque VARCHAR(50) NULL DEFAULT 'pallet',
        unidad_por_bulto DECIMAL(18,4) NULL,
        bultos_por_pallet INT NULL,
        en_cl2 BIT NOT NULL DEFAULT 0
    );
END;

-- 5. TABLA: proveedor_material
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'proveedor_material')
BEGIN
    CREATE TABLE dbo.proveedor_material (
        id_proveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.proveedor(id_proveedor),
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        codigo_material_proveedor VARCHAR(50) NULL,
        activo BIT NOT NULL DEFAULT 1,
        CONSTRAINT PK_proveedor_material PRIMARY KEY (id_proveedor, id_material)
    );
END;

-- 6. TABLA: stock_deposito
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'stock_deposito')
BEGIN
    CREATE TABLE dbo.stock_deposito (
        id_material VARCHAR(50) NOT NULL PRIMARY KEY FOREIGN KEY REFERENCES dbo.material(id_material),
        stock_actual DECIMAL(18,4) NOT NULL DEFAULT 0,
        stock_planta DECIMAL(18,4) NOT NULL DEFAULT 0.0,
        fecha_actualizacion DATETIME2 NULL DEFAULT SYSDATETIME(),
        stock_warehouse DECIMAL(18,4) NOT NULL DEFAULT 0.0
    );
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.stock_deposito') AND name = 'stock_planta')
    BEGIN
        ALTER TABLE dbo.stock_deposito ADD stock_planta DECIMAL(18,4) NOT NULL DEFAULT 0.0;
    END;
END;


-- 7. TABLA: producto
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'producto')
BEGIN
    CREATE TABLE dbo.producto (
        id_producto VARCHAR(50) NOT NULL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        descripcion VARCHAR(255) NULL,
        sector VARCHAR(50) NULL,
        activo BIT NOT NULL DEFAULT 1
    );
END;

-- 8. TABLA: configuracion_sistema
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'configuracion_sistema')
BEGIN
    CREATE TABLE dbo.configuracion_sistema (
        clave VARCHAR(50) NOT NULL PRIMARY KEY,
        valor NVARCHAR(255) NOT NULL,
        descripcion NVARCHAR(255) NULL,
        fecha_actualizacion DATETIME2 NULL DEFAULT SYSDATETIME()
    );
END;

-- 9. TABLAS BOM: version, estructura, explosion plana
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bom_version')
BEGIN
    CREATE TABLE dbo.bom_version (
        id_version INT IDENTITY(1,1) PRIMARY KEY,
        nombre_archivo VARCHAR(255) NOT NULL,
        fecha_importacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        total_lineas INT NOT NULL,
        es_vigente BIT NOT NULL DEFAULT 0,
        observacion VARCHAR(255) NULL
    );
    CREATE UNIQUE INDEX UQ_bom_version_activa ON dbo.bom_version (es_vigente) WHERE es_vigente = 1;
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bom_estructura')
BEGIN
    CREATE TABLE dbo.bom_estructura (
        id_bom INT IDENTITY(1,1) PRIMARY KEY,
        id_version INT NOT NULL FOREIGN KEY REFERENCES dbo.bom_version(id_version),
        id_producto_raiz VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        id_padre VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        id_hijo VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        cantidad DECIMAL(18,4) NOT NULL,
        unidad VARCHAR(10) NOT NULL DEFAULT 'UN',
        nivel INT NOT NULL,
        orden INT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_bom_estructura_raiz_padre ON dbo.bom_estructura (id_producto_raiz, id_padre, id_version);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'bom_explosion_plana')
BEGIN
    CREATE TABLE dbo.bom_explosion_plana (
        id_version INT NOT NULL FOREIGN KEY REFERENCES dbo.bom_version(id_version),
        id_producto_raiz VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        id_material_insumo VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        factor_consumo_total DECIMAL(18,4) NOT NULL,
        unidad VARCHAR(10) NOT NULL DEFAULT 'UN',
        CONSTRAINT PK_bom_explosion_plana PRIMARY KEY (id_version, id_producto_raiz, id_material_insumo)
    );
    CREATE INDEX IX_bom_plana_raiz ON dbo.bom_explosion_plana (id_producto_raiz);
END;

-- 10. TABLA: set_componente
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'set_componente')
BEGIN
    CREATE TABLE dbo.set_componente (
        id_set_componente INT IDENTITY(1,1) PRIMARY KEY,
        sector VARCHAR(50) NULL,
        sd VARCHAR(50) NULL,
        codigo_tasa VARCHAR(50) NOT NULL,
        codigo_sap_padre VARCHAR(50) NOT NULL,
        id_material_hijo VARCHAR(50) NOT NULL,
        cantidad DECIMAL(18,4) NOT NULL DEFAULT 1.0,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_set_componente_hijo ON dbo.set_componente (id_material_hijo, activo);
    CREATE INDEX IX_set_componente_padres ON dbo.set_componente (codigo_tasa, codigo_sap_padre, id_material_hijo, sector, sd, activo);
END;

-- 11. TABLAS DE PEDIDOS Y REMITOS
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'pedido')
BEGIN
    CREATE TABLE dbo.pedido (
        id_pedido INT IDENTITY(1,1) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        prioridad NVARCHAR(20) NOT NULL,
        id_usuario_solicitante INT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        origen NVARCHAR(30) NOT NULL,
        estado NVARCHAR(30) NOT NULL,
        fecha_creacion DATETIME2 NULL DEFAULT SYSDATETIME(),
        fecha_despacho DATETIME2 NULL,
        fecha_entrega DATETIME2 NULL,
        comentario VARCHAR(255) NULL,
        fecha_requerida DATE NULL,
        turno VARCHAR(20) NULL,
        id_conteo INT NULL,
        CONSTRAINT CK_pedido_prioridad CHECK (prioridad IN ('baja', 'normal', 'media', 'alta', 'urgente')),
        CONSTRAINT CK_pedido_origen CHECK (origen IN ('manual', 'conteo_planta', 'rundown')),
        CONSTRAINT CK_pedido_estado CHECK (estado IN ('pendiente', 'en_preparacion', 'en_transito', 'parcial', 'completo', 'cancelado'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'material_pedido')
BEGIN
    CREATE TABLE dbo.material_pedido (
        id_pedido INT NOT NULL FOREIGN KEY REFERENCES dbo.pedido(id_pedido),
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        cantidad_pedida DECIMAL(18,4) NOT NULL,
        cantidad_preparada DECIMAL(18,4) NULL DEFAULT 0,
        cantidad_entregada DECIMAL(18,4) NULL DEFAULT 0,
        estado NVARCHAR(30) NOT NULL,
        comentario VARCHAR(255) NULL,
        CONSTRAINT PK_material_pedido PRIMARY KEY (id_pedido, id_material),
        CONSTRAINT CK_material_pedido_estado CHECK (estado IN ('pendiente', 'en_preparacion', 'en_transito', 'parcial', 'completo', 'cancelado'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'remito')
BEGIN
    CREATE TABLE dbo.remito (
        id_remito VARCHAR(50) NOT NULL PRIMARY KEY,
        id_pedido INT NOT NULL FOREIGN KEY REFERENCES dbo.pedido(id_pedido),
        fecha_emision DATETIME2 NOT NULL,
        fecha_entrega DATETIME2 NULL,
        estado NVARCHAR(30) NOT NULL,
        id_usuario_emisor INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        observacion VARCHAR(255) NULL,
        CONSTRAINT CK_remito_estado CHECK (estado IN ('emitido', 'entregado', 'anulado'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'material_remito')
BEGIN
    CREATE TABLE dbo.material_remito (
        id_remito VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.remito(id_remito),
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        cantidad DECIMAL(18,4) NOT NULL,
        CONSTRAINT PK_material_remito PRIMARY KEY (id_remito, id_material)
    );
END;

-- 12. TABLAS DE CONTEO
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'conteo')
BEGIN
    CREATE TABLE dbo.conteo (
        id_conteo INT IDENTITY(1,1) PRIMARY KEY,
        tipo NVARCHAR(30) NOT NULL,
        id_usuario INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        estado NVARCHAR(30) NOT NULL,
        id_pedido_generado INT NULL FOREIGN KEY REFERENCES dbo.pedido(id_pedido),
        fecha_inicio DATETIME2 NULL DEFAULT SYSDATETIME(),
        fecha_finalizacion DATETIME2 NULL,
        observacion VARCHAR(255) NULL,
        fecha_impacto DATE NULL,
        CONSTRAINT CK_conteo_tipo CHECK (tipo IN ('ciclico', 'planta')),
        CONSTRAINT CK_conteo_estado CHECK (estado IN ('abierto', 'finalizado', 'cancelado'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK__pedido__id_conte__2022C2A6')
BEGIN
    ALTER TABLE dbo.pedido ADD CONSTRAINT FK__pedido__id_conte__2022C2A6 FOREIGN KEY (id_conteo) REFERENCES dbo.conteo(id_conteo);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'material_conteo')
BEGIN
    CREATE TABLE dbo.material_conteo (
        id_conteo INT NOT NULL FOREIGN KEY REFERENCES dbo.conteo(id_conteo),
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        stock_teorico DECIMAL(18,4) NOT NULL,
        stock_contado DECIMAL(18,4) NOT NULL,
        desvio DECIMAL(18,4) NULL,
        observacion VARCHAR(255) NULL,
        CONSTRAINT PK_material_conteo PRIMARY KEY (id_conteo, id_material)
    );
END;

-- 13. TABLAS DE RECEPCIÓN / INGRESOS DE MATERIAL
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ingreso_material')
BEGIN
    CREATE TABLE dbo.ingreso_material (
        id_ingreso INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.proveedor(id_proveedor),
        nro_remito_proveedor VARCHAR(50) NOT NULL,
        id_usuario INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        fecha_recibida DATE NOT NULL,
        completo BIT NOT NULL DEFAULT 1,
        observacion VARCHAR(255) NULL,
        numero_factura VARCHAR(50) NULL,
        orden_compra VARCHAR(50) NULL,
        fecha_emision DATE NULL,
        fecha_recepcion DATETIME2 NULL,
        estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
        id_usuario_recepcion INT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ingreso_material_detalle')
BEGIN
    CREATE TABLE dbo.ingreso_material_detalle (
        id_ingreso_detalle INT IDENTITY(1,1) PRIMARY KEY,
        id_ingreso INT NOT NULL FOREIGN KEY REFERENCES dbo.ingreso_material(id_ingreso),
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        cantidad_recibida DECIMAL(18,4) NOT NULL,
        conforme BIT NOT NULL DEFAULT 1,
        observacion VARCHAR(255) NULL,
        cantidad_facturada DECIMAL(18,4) NOT NULL DEFAULT 0.0
    );
END;

-- 14. TABLA: movimiento_stock
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'movimiento_stock')
BEGIN
    CREATE TABLE dbo.movimiento_stock (
        id_movimiento BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        tipo NVARCHAR(30) NOT NULL,
        cantidad DECIMAL(18,4) NOT NULL,
        stock_anterior DECIMAL(18,4) NOT NULL,
        stock_posterior DECIMAL(18,4) NOT NULL,
        id_pedido INT NULL FOREIGN KEY REFERENCES dbo.pedido(id_pedido),
        id_remito VARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.remito(id_remito),
        id_ingreso INT NULL FOREIGN KEY REFERENCES dbo.ingreso_material(id_ingreso),
        id_conteo INT NULL FOREIGN KEY REFERENCES dbo.conteo(id_conteo),
        id_usuario INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        fecha DATETIME2 NULL DEFAULT SYSDATETIME(),
        observacion VARCHAR(255) NULL,
        CONSTRAINT CK_movimiento_stock_tipo CHECK (tipo IN (
            'inventario_inicial', 'ingreso_proveedor', 'ingreso_pedido', 'egreso_pedido',
            'ajuste_conteo', 'ajuste_manual', 'consumo_produccion'
        ))
    );
END;

-- 15. TABLAS DE IMPORTACIÓN Y PRODUCCIÓN
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'importacion_archivo')
BEGIN
    CREATE TABLE dbo.importacion_archivo (
        id_importacion INT IDENTITY(1,1) PRIMARY KEY,
        tipo NVARCHAR(50) NOT NULL,
        nombre_archivo VARCHAR(255) NOT NULL,
        id_usuario INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        fecha_importacion DATETIME2 NULL DEFAULT SYSDATETIME(),
        estado NVARCHAR(50) NOT NULL,
        observacion VARCHAR(255) NULL,
        CONSTRAINT CK_importacion_archivo_tipo CHECK (tipo IN ('stock_inicial', 'produccion_real', 'produccion_planificada', 'bom_sap')),
        CONSTRAINT CK_importacion_archivo_estado CHECK (estado IN ('procesada', 'procesada_con_errores', 'rechazada'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'importacion_error')
BEGIN
    CREATE TABLE dbo.importacion_error (
        id_error INT IDENTITY(1,1) PRIMARY KEY,
        id_importacion INT NOT NULL FOREIGN KEY REFERENCES dbo.importacion_archivo(id_importacion),
        fila INT NULL,
        columna VARCHAR(50) NULL,
        detalle VARCHAR(255) NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'produccion_planificada')
BEGIN
    CREATE TABLE dbo.produccion_planificada (
        id_produccion_planificada BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_producto VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.producto(id_producto),
        fecha DATE NOT NULL,
        cantidad_planificada DECIMAL(18,4) NOT NULL,
        id_importacion INT NOT NULL FOREIGN KEY REFERENCES dbo.importacion_archivo(id_importacion),
        id_usuario INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        fecha_carga DATETIME2 NULL DEFAULT SYSDATETIME()
    );
    CREATE UNIQUE INDEX produccion_planificada_index_0 ON dbo.produccion_planificada (id_producto, fecha);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'produccion_real')
BEGIN
    CREATE TABLE dbo.produccion_real (
        id_produccion_real BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_producto VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.producto(id_producto),
        fecha DATE NOT NULL,
        cantidad_real DECIMAL(18,4) NOT NULL,
        id_usuario INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        fecha_carga DATETIME2 NULL DEFAULT SYSDATETIME(),
        observacion VARCHAR(255) NULL
    );
    CREATE UNIQUE INDEX produccion_real_index_1 ON dbo.produccion_real (id_producto, fecha);
END;

-- 16. TABLAS DE RUNDOWN VIVO Y PARÁMETROS
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_parametro_material')
BEGIN
    CREATE TABLE dbo.rundown_parametro_material (
        id_parametro INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.proveedor(id_proveedor),
        id_material VARCHAR(50) NOT NULL,
        descripcion VARCHAR(150) NULL,
        unidad VARCHAR(10) NOT NULL DEFAULT 'MTS',
        lote_mts DECIMAL(18,4) NULL,
        scrap_porcentaje DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
        factor_conversion DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
        categoria_cabina VARCHAR(30) NULL,
        stock_inicial_referencia DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        fecha_stock_inicial DATE NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        stock_inicial_planta DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        stock_inicial_total DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        doh_sugerido_planta FLOAT NULL,
        tipo_empaque VARCHAR(50) NOT NULL DEFAULT 'pallet',
        unidad_por_bulto DECIMAL(18,4) NULL,
        bultos_por_pallet INT NULL,
        en_cl2 BIT NULL
    );
    CREATE UNIQUE INDEX IX_rundown_parametro_material ON dbo.rundown_parametro_material (id_proveedor, id_material);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_parametro_producto')
BEGIN
    CREATE TABLE dbo.rundown_parametro_producto (
        id_parametro_producto INT IDENTITY(1,1) PRIMARY KEY,
        id_parametro INT NOT NULL FOREIGN KEY REFERENCES dbo.rundown_parametro_material(id_parametro) ON DELETE CASCADE,
        id_producto VARCHAR(50) NOT NULL,
        factor_uso DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_rundown_parametro_producto ON dbo.rundown_parametro_producto (id_parametro, id_producto);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_transito_arribo')
BEGIN
    CREATE TABLE dbo.rundown_transito_arribo (
        id_transito INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.proveedor(id_proveedor),
        id_material VARCHAR(50) NOT NULL,
        fecha_eta DATE NOT NULL,
        tipo_via VARCHAR(30) NOT NULL,
        po_numero VARCHAR(50) NULL,
        factura_numero VARCHAR(50) NULL,
        cantidad DECIMAL(18,4) NOT NULL,
        observacion VARCHAR(255) NULL,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        estado VARCHAR(30) NOT NULL DEFAULT 'planificado',
        CONSTRAINT CK_rundown_transito_arribo_estado CHECK (estado IN ('planificado', 'confirmado'))
    );
    CREATE INDEX IX_rundown_transito_arribo ON dbo.rundown_transito_arribo (id_proveedor, id_material, fecha_eta);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_stock_ajuste')
BEGIN
    CREATE TABLE dbo.rundown_stock_ajuste (
        id_ajuste INT IDENTITY(1,1) PRIMARY KEY,
        id_parametro INT NOT NULL,
        id_proveedor INT NOT NULL,
        id_material VARCHAR(50) NOT NULL,
        fecha DATE NOT NULL,
        tipo_stock VARCHAR(20) NOT NULL DEFAULT 'total',
        stock_ajustado DECIMAL(18,4) NOT NULL,
        observacion VARCHAR(255) NULL,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_rundown_stock_ajuste UNIQUE (id_parametro, fecha, tipo_stock)
    );
    CREATE INDEX IX_rundown_stock_ajuste_mat_fecha ON dbo.rundown_stock_ajuste (id_parametro, fecha);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_calendario_laboral')
BEGIN
    CREATE TABLE dbo.rundown_calendario_laboral (
        id_calendario INT IDENTITY(1,1) PRIMARY KEY,
        fecha DATE NOT NULL UNIQUE,
        es_laboral BIT NOT NULL DEFAULT 1,
        observacion VARCHAR(255) NULL,
        fecha_actualizacion DATETIME2 NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_rundown_calendario_laboral_fecha ON dbo.rundown_calendario_laboral (fecha);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_periodo_proyeccion')
BEGIN
    CREATE TABLE dbo.rundown_periodo_proyeccion (
        id_proyeccion INT IDENTITY(1,1) PRIMARY KEY,
        anio INT NOT NULL,
        mes INT NOT NULL,
        periodo_copia VARCHAR(20) NOT NULL,
        observacion VARCHAR(255) NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_rundown_periodo_proyeccion UNIQUE (anio, mes)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_plan_semanal_linea')
BEGIN
    CREATE TABLE dbo.rundown_plan_semanal_linea (
        id_plan_linea BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_seccion INT NOT NULL CONSTRAINT FK_plan_linea_seccion FOREIGN KEY REFERENCES dbo.rundown_seccion(id_seccion),
        sd VARCHAR(50) NOT NULL,
        id_producto VARCHAR(50) NOT NULL,
        fecha DATE NOT NULL,
        cantidad_diaria DECIMAL(18,4) NOT NULL,
        fecha_carga DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_plan_linea_seccion_fecha ON dbo.rundown_plan_semanal_linea (id_seccion, fecha);
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_diario')
BEGIN
    CREATE TABLE dbo.rundown_diario (
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        fecha DATE NOT NULL,
        stock_teorico_inicio DECIMAL(18,4) NOT NULL,
        conteo_real DECIMAL(18,4) NULL,
        desvio DECIMAL(18,4) NULL,
        consumo_estimado DECIMAL(18,4) NULL DEFAULT 0,
        consumo_real DECIMAL(18,4) NULL,
        entregas_recibidas DECIMAL(18,4) NULL DEFAULT 0,
        produccion_dia_siguiente DECIMAL(18,4) NULL DEFAULT 0,
        cantidad_sugerida_pedir DECIMAL(18,4) NULL DEFAULT 0,
        cantidad_editada_pedir DECIMAL(18,4) NULL,
        id_conteo INT NULL FOREIGN KEY REFERENCES dbo.conteo(id_conteo),
        id_pedido_generado INT NULL FOREIGN KEY REFERENCES dbo.pedido(id_pedido),
        semana_produccion_cargada DATE NULL,
        fecha_actualizacion DATETIME2 NULL DEFAULT SYSDATETIME(),
        id_usuario_actualizacion INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        CONSTRAINT PK_rundown_diario PRIMARY KEY (id_material, fecha)
    );
END;

-- 17. TABLA: etiqueta_qr
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'etiqueta_qr')
BEGIN
    CREATE TABLE dbo.etiqueta_qr (
        id_etiqueta BIGINT IDENTITY(1,1) PRIMARY KEY,
        codigo_qr VARCHAR(100) NOT NULL UNIQUE,
        id_pedido INT NOT NULL FOREIGN KEY REFERENCES dbo.pedido(id_pedido),
        id_material VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.material(id_material),
        numero_pallet INT NOT NULL,
        cantidad_bulto DECIMAL(18,4) NOT NULL DEFAULT 1,
        estado NVARCHAR(30) NOT NULL,
        id_usuario_emision INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        id_usuario_recepcion INT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        fecha_emision DATETIME2 NULL DEFAULT SYSDATETIME(),
        fecha_escaneo DATETIME2 NULL,
        observacion VARCHAR(255) NULL,
        CONSTRAINT CK_etiqueta_qr_estado CHECK (estado IN ('generado', 'en_transito', 'recepcionado', 'discrepancia', 'anulado'))
    );
END;

-- 18. TABLA: auditoria
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'auditoria')
BEGIN
    CREATE TABLE dbo.auditoria (
        id_evento BIGINT IDENTITY(1,1) PRIMARY KEY,
        entidad NVARCHAR(50) NOT NULL,
        id_entidad VARCHAR(50) NULL,
        tipo_evento NVARCHAR(50) NOT NULL,
        id_usuario INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id_usuario),
        fecha DATETIME2 NULL DEFAULT SYSDATETIME(),
        detalle VARCHAR(500) NULL,
        CONSTRAINT CK_auditoria_entidad CHECK (entidad IN (
            'pedido', 'remito', 'conteo', 'stock', 'material', 'proveedor',
            'producto', 'bom', 'produccion', 'importacion', 'etiqueta_qr', 'sistema'
        )),
        CONSTRAINT CK_auditoria_tipo_evento CHECK (tipo_evento IN (
            'login', 'solicitud', 'preparacion', 'despacho', 'entrega', 'aprobacion',
            'anulacion', 'modificacion', 'conteo', 'ajuste', 'ingreso_proveedor',
            'escaneo_qr', 'importacion'
        ))
    );
END;

-- 19. VISTA: vw_bom_activa
IF OBJECT_ID('dbo.vw_bom_activa', 'V') IS NOT NULL
    DROP VIEW dbo.vw_bom_activa;
GO

CREATE VIEW dbo.vw_bom_activa
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

-- 20. STORED PROCEDURE: usp_generar_explosion_bom_version
IF OBJECT_ID('dbo.usp_generar_explosion_bom_version', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_generar_explosion_bom_version;
GO

CREATE PROCEDURE dbo.usp_generar_explosion_bom_version
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

-- 15. TABLAS DE SINCRONIZACION Y EVENTOS (Nodo CL2)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SyncOutbox' AND schema_id = SCHEMA_ID('dbo'))
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
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ProcessedEvents' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ProcessedEvents (
        EventId NVARCHAR(100) PRIMARY KEY,
        EventType NVARCHAR(50) NOT NULL,
        ProcessedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- 16. CONFIGURACION Y USUARIO ADMINISTRADOR INICIAL
IF NOT EXISTS (SELECT 1 FROM dbo.configuracion_sistema WHERE clave = 'factor_consumo_siguiente')
BEGIN
    INSERT INTO dbo.configuracion_sistema (clave, valor, descripcion)
    VALUES ('factor_consumo_siguiente', '0.65', 'Factor multiplicador para el consumo del dia siguiente en la regla de pedido sugerido');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.usuario WHERE username = 'admin')
BEGIN
    INSERT INTO dbo.usuario (
        username, password_hash, nombre, apellido, rol, activo, sector, email, eliminado
    )
    VALUES (
        'admin',
        'pbkdf2:sha256:100000$1bb0bd8c5fc22632dd0bd84a22592b45$6be11acd451f56f83ef75f969c9655d8be37dbf579641925a0f25286ef199ffe',
        'Administrador',
        'Sistema',
        'administrador',
        1,
        'TODOS',
        'admin@gestiondeposito.com',
        0
    );
END;
GO

