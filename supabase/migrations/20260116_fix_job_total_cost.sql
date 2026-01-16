-- Migration: Fix get_job_total_cost to calculate net stock value
-- Date: 2026-01-16
-- Issue: "Costo Materiali" showed €50.524 while "Valore Totale Cantiere" showed €49.720
-- Fix: Calculate exactly like the frontend does in JobStock.tsx

CREATE OR REPLACE FUNCTION public.get_job_total_cost(p_job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_cost numeric;
BEGIN
    -- Simple calculation matching frontend logic exactly:
    -- purchase/unload/exit = INTO job (use ABS of quantity)
    -- entry/load = OUT of job (subtract ABS of quantity)
    -- Sum all movements and multiply by price
    
    SELECT COALESCE(SUM(value), 0)
    INTO total_cost
    FROM (
        SELECT
            CASE 
                WHEN type IN ('purchase', 'unload', 'exit') THEN ABS(quantity) * COALESCE(item_price, 0)
                WHEN type IN ('entry', 'load') THEN -ABS(quantity) * COALESCE(item_price, 0)
                ELSE 0
            END as value
        FROM stock_movements_view
        WHERE job_id = p_job_id 
          AND is_fictitious = false
    ) t;

    RETURN total_cost;
END;
$$;

-- Ensure permissions are set
GRANT EXECUTE ON FUNCTION public.get_job_total_cost(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_total_cost(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_job_total_cost(uuid) TO service_role;
ALTER FUNCTION public.get_job_total_cost(uuid) OWNER TO postgres;
