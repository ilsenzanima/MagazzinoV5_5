-- Switch SECURITY DEFINER functions to SECURITY INVOKER to eliminate
-- authenticated_security_definer_function_executable warnings.
--
-- SECURITY INVOKER is safer: the function runs under the caller's privileges,
-- so RLS policies and role checks apply normally.
--
-- Special cases handled:
--   - calculate_quantity_from_pieces, check_purchase_item_usage: trigger-only,
--     revoke EXECUTE from authenticated so they aren't callable via /rpc
--   - recalculate_all_job_inventory: TRUNCATE replaced with DELETE so it works
--     under INVOKER (DELETE is controlled by RLS; TRUNCATE requires ownership)
--   - get_next_article_code: needs GRANT USAGE ON article_code_seq
--   - update_user_role: already has an internal admin check, works fine as INVOKER

-- ============================================================
-- PART 1: Read-only and admin-check functions → SECURITY INVOKER
-- ============================================================

ALTER FUNCTION public.auth_role()                                                      SECURITY INVOKER;
ALTER FUNCTION public.check_inventory_integrity()                                      SECURITY INVOKER;
ALTER FUNCTION public.get_dashboard_stats()                                            SECURITY INVOKER;
ALTER FUNCTION public.get_inventory_search(text, text, integer, integer, text, text)   SECURITY INVOKER;
ALTER FUNCTION public.get_items_with_untracked_lots()                                  SECURITY INVOKER;
ALTER FUNCTION public.get_job_total_cost(uuid)                                         SECURITY INVOKER;
ALTER FUNCTION public.get_my_role()                                                    SECURITY INVOKER;
ALTER FUNCTION public.recalculate_all_inventory()                                      SECURITY INVOKER;
ALTER FUNCTION public.recalculate_inventory_item(uuid)                                 SECURITY INVOKER;
ALTER FUNCTION public.update_user_role(uuid, text)                                     SECURITY INVOKER;

-- ============================================================
-- PART 2: Trigger-only functions → SECURITY INVOKER + revoke from authenticated
-- These are fired by triggers, never called directly via /rpc.
-- Revoking EXECUTE does NOT affect trigger execution.
-- ============================================================

ALTER FUNCTION public.calculate_quantity_from_pieces() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.calculate_quantity_from_pieces() FROM authenticated;

ALTER FUNCTION public.check_purchase_item_usage() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.check_purchase_item_usage() FROM authenticated;

-- ============================================================
-- PART 3: get_next_article_code → INVOKER + grant sequence access
-- ============================================================

ALTER FUNCTION public.get_next_article_code() SECURITY INVOKER;
GRANT USAGE ON SEQUENCE public.article_code_seq TO authenticated;

-- ============================================================
-- PART 4: recalculate_all_job_inventory → rewrite with DELETE instead of
-- TRUNCATE, then switch to INVOKER. DELETE respects RLS (admin/operativo
-- allowed per existing policy). TRUNCATE would require table ownership.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_all_job_inventory()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    -- Use DELETE instead of TRUNCATE: works under INVOKER with RLS DELETE policy
    DELETE FROM public.job_inventory;

    INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
    SELECT
        dn.job_id,
        dni.inventory_id,
        SUM(CASE
            WHEN dn.type = 'exit'  THEN COALESCE(dni.pieces, 0)
            WHEN dn.type = 'entry' THEN -COALESCE(dni.pieces, 0)
            ELSE 0
        END) AS pieces,
        SUM(CASE
            WHEN dn.type = 'exit'  THEN  dni.quantity
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0
        END) AS quantity
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dn.job_id IS NOT NULL
      AND dn.type IN ('entry', 'exit')
    GROUP BY dn.job_id, dni.inventory_id
    HAVING SUM(CASE
        WHEN dn.type = 'exit'  THEN  dni.quantity
        WHEN dn.type = 'entry' THEN -dni.quantity
        ELSE 0
    END) > 0;

    INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
    SELECT
        p.job_id,
        pi.item_id,
        SUM(COALESCE(pi.pieces, 0)) AS pieces,
        SUM(pi.quantity)            AS quantity
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE p.job_id IS NOT NULL
    GROUP BY p.job_id, pi.item_id
    ON CONFLICT (job_id, item_id)
    DO UPDATE SET
        pieces   = job_inventory.pieces   + EXCLUDED.pieces,
        quantity = job_inventory.quantity + EXCLUDED.quantity,
        updated_at = now();
END;
$$;
