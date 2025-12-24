-- 1. Fix Dangerous Cascade Delete on Jobs
-- Changing ON DELETE CASCADE to ON DELETE RESTRICT to prevent accidental mass deletion
ALTER TABLE public.jobs
DROP CONSTRAINT jobs_client_id_fkey,
ADD CONSTRAINT jobs_client_id_fkey
    FOREIGN KEY (client_id)
    REFERENCES public.clients(id)
    ON DELETE RESTRICT;

-- 2. Performance: Function to calculate Job Cost on server side
-- This avoids downloading thousands of movements to the browser
CREATE OR REPLACE FUNCTION get_job_total_cost(p_job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to ensure access to all necessary data
AS $$
DECLARE
    total_cost numeric;
BEGIN
    WITH job_movements AS (
        SELECT
            type,
            quantity,
            item_price,
            item_id,
            is_fictitious,
            date
        FROM stock_movements_view
        WHERE job_id = p_job_id
    ),
    item_prices AS (
        -- Find the last valid purchase price for each item within this job
        -- Logic mirrors the frontend: look for the most recent purchase of this item in this job
        SELECT DISTINCT ON (item_id)
            item_id,
            item_price as last_price
        FROM job_movements
        WHERE type = 'purchase' AND item_price > 0
        ORDER BY item_id, date DESC
    ),
    calc_movements AS (
        SELECT
            m.type,
            m.quantity,
            COALESCE(
                -- Use the explicit price if available and non-zero
                NULLIF(m.item_price, 0),
                -- If price is missing (common for fictitious items used from stock), use the last seen purchase price in this job
                ip.last_price,
                -- Fallback to 0
                0
            ) as effective_price
        FROM job_movements m
        LEFT JOIN item_prices ip ON m.item_id = ip.item_id
    )
    SELECT
        COALESCE(SUM(
            CASE 
                WHEN type = 'purchase' THEN quantity * effective_price
                -- For Exit/Entry/Unload/Load, the view uses negative quantities for 'Out of Warehouse'
                -- But for Job Cost, 'Out of Warehouse' (Exit) is a COST (+).
                -- 'In to Warehouse' (Entry) is a REFUND (-).
                -- View: Exit = -10. Job Cost = +10. So -(-10) = +10.
                -- View: Entry = +10. Job Cost = -10. So -(+10) = -10.
                ELSE -quantity * effective_price
            END
        ), 0)
    INTO total_cost
    FROM calc_movements;

    RETURN total_cost;
END;
$$;

GRANT EXECUTE ON FUNCTION get_job_total_cost(uuid) TO authenticated;
