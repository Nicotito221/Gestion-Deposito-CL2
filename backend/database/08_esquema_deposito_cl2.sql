-- Esquema de tablas y politicas de seguridad para nodo CL2

-- 1. TABLA: materiales_cl2 (Catalogo operativo acotado a sector CL2)

CREATE TABLE IF NOT EXISTS public.materiales_cl2 (
    id_material VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    unidad_medida VARCHAR(20) NOT NULL DEFAULT 'UN',
    sector VARCHAR(50) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_sincronizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLA: stock_cl2 (Inventario y disponibilidad en deposito CL2)
CREATE TABLE IF NOT EXISTS public.stock_cl2 (
    id_material VARCHAR(50) PRIMARY KEY REFERENCES public.materiales_cl2(id_material) ON DELETE CASCADE,
    stock_actual NUMERIC(18,4) NOT NULL DEFAULT 0,
    stock_reservado NUMERIC(18,4) NOT NULL DEFAULT 0,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA: pedidos_cl2 (Pedidos enviados por Planta para preparacion)
CREATE TABLE IF NOT EXISTS public.pedidos_cl2 (
    id_pedido INT PRIMARY KEY,
    sector VARCHAR(50) NOT NULL,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
    origen VARCHAR(30) NOT NULL DEFAULT 'manual',
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_requerida DATE NULL,
    turno VARCHAR(20) NULL,
    comentario TEXT NULL,
    preparado_por_nombre VARCHAR(100) NULL,
    fecha_despacho TIMESTAMPTZ NULL,
    fecha_entrega TIMESTAMPTZ NULL,
    CONSTRAINT ck_pedidos_cl2_estado CHECK (estado IN ('pendiente', 'en_preparacion', 'en_transito', 'parcial', 'completo', 'cancelado'))
);

-- 4. TABLA: pedidos_cl2_detalle (Lineas de pedido)
CREATE TABLE IF NOT EXISTS public.pedidos_cl2_detalle (
    id_pedido INT NOT NULL REFERENCES public.pedidos_cl2(id_pedido) ON DELETE CASCADE,
    id_material VARCHAR(50) NOT NULL REFERENCES public.materiales_cl2(id_material),
    cantidad_pedida NUMERIC(18,4) NOT NULL,
    cantidad_preparada NUMERIC(18,4) NOT NULL DEFAULT 0,
    cantidad_entregada NUMERIC(18,4) NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    comentario TEXT NULL,
    PRIMARY KEY (id_pedido, id_material),
    CONSTRAINT ck_pedidos_cl2_detalle_estado CHECK (estado IN ('pendiente', 'en_preparacion', 'en_transito', 'parcial', 'completo', 'cancelado'))
);

-- 5. TABLA: remitos_cl2 (Despachos y remitos internos generados)
CREATE TABLE IF NOT EXISTS public.remitos_cl2 (
    id_remito VARCHAR(50) PRIMARY KEY,
    id_pedido INT NOT NULL REFERENCES public.pedidos_cl2(id_pedido),
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_entrega TIMESTAMPTZ NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'emitido',
    operador_nombre VARCHAR(100) NOT NULL,
    observacion TEXT NULL,
    CONSTRAINT ck_remitos_cl2_estado CHECK (estado IN ('emitido', 'entregado', 'anulado'))
);

-- 6. TABLA: remitos_cl2_detalle (Detalle de remitos)
CREATE TABLE IF NOT EXISTS public.remitos_cl2_detalle (
    id_remito VARCHAR(50) NOT NULL REFERENCES public.remitos_cl2(id_remito) ON DELETE CASCADE,
    id_material VARCHAR(50) NOT NULL REFERENCES public.materiales_cl2(id_material),
    cantidad NUMERIC(18,4) NOT NULL,
    PRIMARY KEY (id_remito, id_material)
);

-- 7. TABLA DE CONTROL DE IDEMPOTENCIA (Evita duplicados ante webhooks/sync)
CREATE TABLE IF NOT EXISTS public.processed_events (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURIDAD: HABILITACION DE RLS (ROW LEVEL SECURITY)
-- ==============================================================================

ALTER TABLE public.materiales_cl2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_cl2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_cl2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_cl2_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remitos_cl2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remitos_cl2_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

-- Politica 1: Operarios autenticados pueden ver catalogo y stock
CREATE POLICY "Operarios pueden consultar catalogo y stock"
ON public.materiales_cl2 FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Operarios pueden ver stock CL2"
ON public.stock_cl2 FOR SELECT
TO authenticated
USING (true);

-- Politica 2: Operarios autenticados pueden consultar y preparar pedidos
CREATE POLICY "Operarios pueden ver pedidos CL2"
ON public.pedidos_cl2 FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Operarios pueden actualizar estado de preparacion"
ON public.pedidos_cl2 FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Operarios pueden ver detalle pedidos"
ON public.pedidos_cl2_detalle FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Operarios pueden actualizar cantidades preparadas"
ON public.pedidos_cl2_detalle FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Politica 3: Operarios autenticados pueden generar y ver remitos
CREATE POLICY "Operarios pueden ver remitos"
ON public.remitos_cl2 FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Operarios pueden insertar remitos"
ON public.remitos_cl2 FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Operarios pueden ver detalle remitos"
ON public.remitos_cl2_detalle FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Operarios pueden insertar detalle remitos"
ON public.remitos_cl2_detalle FOR INSERT
TO authenticated
WITH CHECK (true);
