-- Create RPC to get purchase IDs with zero remaining quantity
-- This is used to show "exhausted" indicator on purchase cards

CREATE OR REPLACE FUNCTION public.get_exhausted_purchase_ids()
RETURNS TABLE (purchase_id uuid) 
LANGUAGE sql
SECURITY INVOKER
AS $$
  -- Get purchases where ALL items have 0 remaining quantity
  SELECT DISTINCT pi.purchase_id
  FROM purchase_items pi
  WHERE NOT EXISTS (
    -- Check if there's any batch with remaining > 0 for this purchase
    SELECT 1 FROM purchase_batch_availability pba
    WHERE pba.purchase_item_id = pi.id
    AND pba.remaining_quantity > 0.001
  )
  -- Only consider purchases that have items (avoid empty purchases)
  AND EXISTS (SELECT 1 FROM purchase_items pi2 WHERE pi2.purchase_id = pi.purchase_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_exhausted_purchase_ids() TO authenticated;
