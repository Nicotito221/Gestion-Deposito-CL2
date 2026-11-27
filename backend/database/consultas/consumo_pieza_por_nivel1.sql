DECLARE @pieza VARCHAR(30) = '67781-0K100-C0';
DECLARE @desde DATE = '2026-12-01';
DECLARE @hasta DATE = '2026-12-31';
DECLARE @clave VARCHAR(30) = REPLACE(REPLACE(@pieza, '-', ''), ' ', '');

WITH v AS (
    SELECT TOP 1 id_version
    FROM dbo.bom_version
    ORDER BY es_vigente DESC, id_version DESC
),
padres AS (
    SELECT
        e.id_producto_raiz AS padre,
        e.factor_consumo_total AS factor
    FROM dbo.bom_explosion_plana e
    JOIN v ON v.id_version = e.id_version
    WHERE REPLACE(REPLACE(e.id_material_insumo, '-', ''), ' ', '') = @clave
),
pedido AS (
    SELECT
        p.id_producto,
        SUM(p.cantidad_planificada) AS cantidad_pedida
    FROM dbo.produccion_planificada p
    WHERE p.fecha >= @desde
      AND p.fecha < @hasta
    GROUP BY p.id_producto
),
base AS (
    SELECT
        pa.padre,
        pa.factor,
        pe.cantidad_pedida,
        pe.cantidad_pedida * pa.factor AS consumo,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM dbo.bom_sd_set s
                WHERE s.id_set = pa.padre
            ) THEN 1
            ELSE 0
        END AS es_set
    FROM padres pa
    JOIN pedido pe ON pe.id_producto = pa.padre
    WHERE pe.cantidad_pedida > 0
),
nivel1 AS (
    SELECT
        b.padre AS nivel_1,
        b.padre AS pedido_como,
        'SET' AS tipo_pedido,
        b.cantidad_pedida,
        b.factor,
        b.consumo,
        1 AS sets_del_producto
    FROM base b
    WHERE b.es_set = 1

    UNION ALL

    SELECT
        COALESCE(sp.id_set, '(sin SET)'),
        b.padre,
        'Producto',
        b.cantidad_pedida,
        b.factor,
        b.consumo,
        COUNT(*) OVER (PARTITION BY b.padre)
    FROM base b
    LEFT JOIN dbo.bom_set_producto sp
        ON sp.id_producto = b.padre
    WHERE b.es_set = 0
)
SELECT
    n.nivel_1,
    COALESCE(m1.nombre, '') AS descripcion_nivel_1,
    sd.lista_sd AS sd,
    n.pedido_como,
    n.tipo_pedido,
    COALESCE(mp.nombre, '') AS descripcion_pedido,
    n.cantidad_pedida,
    n.factor,
    n.consumo,
    n.sets_del_producto
FROM nivel1 n
LEFT JOIN dbo.material m1
    ON m1.id_material = n.nivel_1
LEFT JOIN dbo.material mp
    ON mp.id_material = n.pedido_como
OUTER APPLY (
    SELECT STRING_AGG(s.codigo_sd, ', ') AS lista_sd
    FROM dbo.bom_sd_set s
    WHERE s.id_set = n.nivel_1
) sd
ORDER BY n.consumo DESC, n.nivel_1, n.pedido_como;

SELECT SUM(c.cantidad) AS consumo_calculado_por_el_sistema
FROM dbo.explosion_consumo_material c
WHERE REPLACE(REPLACE(c.id_material, '-', ''), ' ', '') = @clave
  AND c.fecha >= @desde
  AND c.fecha < @hasta;
