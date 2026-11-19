-- Ejecutar en el SQL Editor de Supabase (PostgreSQL). Es idempotente.

CREATE OR REPLACE FUNCTION public.confirmar_preparacion_cl2(
    p_id_pedido INT,
    p_accion TEXT,
    p_items JSONB,
    p_comentario TEXT DEFAULT NULL,
    p_preparador TEXT DEFAULT 'Operario CL2'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_pedido public.pedidos_cl2%ROWTYPE;
    v_mat public.pedidos_cl2_detalle%ROWTYPE;
    v_inp JSONB;
    v_c_ped NUMERIC;
    v_c_prev NUMERIC;
    v_c_pend NUMERIC;
    v_c_input NUMERIC;
    v_delta NUMERIC;
    v_nueva NUMERIC;
    v_lote NUMERIC;
    v_pal_ent NUMERIC;
    v_pal_pend NUMERIC;
    v_todo_completo BOOLEAN := TRUE;
    v_total_delta NUMERIC := 0;
    v_seq INT;
    v_id_remito TEXT;
    v_estado TEXT;
    v_ahora TIMESTAMPTZ := NOW();
BEGIN
    IF p_accion NOT IN ('confirmar_completo', 'confirmar_parcial') THEN
        RAISE EXCEPTION 'Acción no válida: %', p_accion;
    END IF;

    SELECT * INTO v_pedido FROM public.pedidos_cl2 WHERE id_pedido = p_id_pedido FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido % no encontrado', p_id_pedido;
    END IF;
    IF v_pedido.estado IN ('completo', 'cancelado') THEN
        RAISE EXCEPTION 'El pedido % ya está %', p_id_pedido, v_pedido.estado;
    END IF;

    SELECT COUNT(*) + 1 INTO v_seq FROM public.remitos_cl2 WHERE id_pedido = p_id_pedido;
    v_id_remito := 'RI-' || LPAD(p_id_pedido::TEXT, 6, '0') || '-' || LPAD(v_seq::TEXT, 2, '0');

    INSERT INTO public.remitos_cl2 (id_remito, id_pedido, fecha_emision, fecha_entrega, estado, operador_nombre, observacion)
    VALUES (
        v_id_remito,
        p_id_pedido,
        v_ahora,
        v_ahora,
        'emitido',
        p_preparador,
        COALESCE(NULLIF(p_comentario, ''), 'Remito de entrega #' || v_seq || ' por pedido #' || p_id_pedido || ' para sector ' || v_pedido.sector)
    );

    FOR v_mat IN
        SELECT * FROM public.pedidos_cl2_detalle WHERE id_pedido = p_id_pedido ORDER BY id_material FOR UPDATE
    LOOP
        v_c_ped := COALESCE(v_mat.cantidad_pedida, 0);
        v_c_prev := COALESCE(v_mat.cantidad_entregada, 0);
        v_c_pend := GREATEST(0, ROUND(v_c_ped - v_c_prev, 2));
        SELECT e INTO v_inp FROM jsonb_array_elements(p_items) e WHERE e->>'id_material' = v_mat.id_material LIMIT 1;
        v_delta := 0;

        IF v_c_pend > 0 THEN
            IF v_inp IS NOT NULL THEN
                v_c_input := COALESCE((v_inp->>'cantidad_preparada')::NUMERIC, 0);
                IF v_c_input > v_c_pend THEN
                    v_delta := GREATEST(0, LEAST(v_c_input - v_c_prev, v_c_pend));
                ELSE
                    v_delta := GREATEST(0, LEAST(v_c_input, v_c_pend));
                END IF;
            ELSIF p_accion = 'confirmar_completo' THEN
                v_delta := v_c_pend;
            END IF;
            IF p_accion = 'confirmar_completo' AND v_delta = 0
               AND (v_inp IS NULL OR COALESCE((v_inp->>'cantidad_preparada')::NUMERIC, 0) = 0) THEN
                v_delta := v_c_pend;
            END IF;
        END IF;

        v_delta := ROUND(v_delta, 2);
        v_nueva := ROUND(v_c_prev + v_delta, 2);
        IF v_nueva < v_c_ped THEN
            v_todo_completo := FALSE;
        END IF;

        v_lote := CASE WHEN COALESCE(v_mat.tamanio_lote, 1) > 1 THEN v_mat.tamanio_lote ELSE 1 END;
        v_pal_ent := CASE WHEN v_mat.tipo_empaque IN ('pallet', 'rollo') OR v_lote > 1 THEN ROUND(v_nueva / v_lote) ELSE 0 END;
        v_pal_pend := CASE WHEN v_mat.cantidad_pallets IS NOT NULL THEN GREATEST(0, v_mat.cantidad_pallets - v_pal_ent) ELSE NULL END;

        UPDATE public.pedidos_cl2_detalle
        SET cantidad_preparada = v_nueva,
            cantidad_entregada = v_nueva,
            cantidad_pallets_preparada = v_pal_ent,
            cantidad_pallets_entregada = v_pal_ent,
            cantidad_pallets_pendiente = v_pal_pend,
            estado = CASE WHEN v_nueva >= v_c_ped AND v_c_ped > 0 THEN 'completo' WHEN v_nueva > 0 THEN 'parcial' ELSE 'pendiente' END,
            comentario = COALESCE(NULLIF(v_inp->>'comentario', ''), comentario)
        WHERE id_pedido = p_id_pedido AND id_material = v_mat.id_material;

        IF v_delta > 0 THEN
            INSERT INTO public.remitos_cl2_detalle (
                id_remito, id_material, nombre_material, unidad, cantidad, cantidad_facturada, cantidad_recibida, conforme
            )
            VALUES (
                v_id_remito, v_mat.id_material, COALESCE(v_mat.nombre_material, v_mat.id_material),
                COALESCE(v_mat.unidad, 'UN'), v_delta, v_delta, v_delta, TRUE
            );
            v_total_delta := v_total_delta + v_delta;
        END IF;
    END LOOP;

    IF v_total_delta <= 0 THEN
        RAISE EXCEPTION 'No se especificaron cantidades pendientes a despachar mayores a 0';
    END IF;

    v_estado := CASE WHEN v_todo_completo THEN 'completo' ELSE 'parcial' END;
    UPDATE public.pedidos_cl2
    SET estado = v_estado,
        preparado_por_nombre = p_preparador,
        fecha_despacho = v_ahora,
        fecha_entrega = CASE WHEN v_estado = 'completo' THEN v_ahora ELSE fecha_entrega END,
        comentario = COALESCE(NULLIF(p_comentario, ''), comentario)
    WHERE id_pedido = p_id_pedido;

    RETURN jsonb_build_object('id_remito', v_id_remito, 'estado', v_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_preparacion_cl2(INT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_preparacion_cl2(INT, TEXT, JSONB, TEXT, TEXT) TO authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;
