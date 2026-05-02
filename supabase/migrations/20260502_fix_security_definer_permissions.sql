-- Fix SECURITY DEFINER function permissions and images bucket
-- The previous migration used REVOKE FROM anon,authenticated which does not
-- override the default PUBLIC grant. The correct pattern is:
--   1. REVOKE FROM PUBLIC  (removes default grant)
--   2. GRANT TO authenticated  (restore only where needed)

-- ============================================================
-- PART 1: Images bucket — make non-public to eliminate listing warning
-- The app is fully authenticated so direct URL access via auth token works.
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id = 'images';

-- Remove the old broad policy and replace with authenticated-only select
DROP POLICY IF EXISTS "images_select_policy" ON storage.objects;
CREATE POLICY "images_select_policy"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'images');

-- ============================================================
-- PART 2: Trigger / internal functions — revoke from PUBLIC entirely.
-- These are invoked only by triggers, never via /rpc.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.handle_delivery_note_delete()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_delivery_note_deletion()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_delivery_note_item_change()      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_movement_logic()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_purchase_item_change()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_purchase_job_change()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_inventory_anomaly()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_fictitious_price_timestamp()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_load_notes_updated_at()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_movement_stock()               FROM PUBLIC;

-- ============================================================
-- PART 3: App functions callable via /rpc — revoke PUBLIC,
-- then grant back to authenticated only.
-- ============================================================

-- auth_role
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auth_role() TO authenticated;

-- calculate_quantity_from_pieces
REVOKE EXECUTE ON FUNCTION public.calculate_quantity_from_pieces() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.calculate_quantity_from_pieces() TO authenticated;

-- check_inventory_integrity
REVOKE EXECUTE ON FUNCTION public.check_inventory_integrity() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_inventory_integrity() TO authenticated;

-- check_purchase_item_usage
REVOKE EXECUTE ON FUNCTION public.check_purchase_item_usage() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_purchase_item_usage() TO authenticated;

-- get_dashboard_stats
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- get_inventory_search
REVOKE EXECUTE ON FUNCTION public.get_inventory_search(text, text, integer, integer, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_inventory_search(text, text, integer, integer, text, text) TO authenticated;

-- get_items_with_untracked_lots
REVOKE EXECUTE ON FUNCTION public.get_items_with_untracked_lots() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_items_with_untracked_lots() TO authenticated;

-- get_job_total_cost
REVOKE EXECUTE ON FUNCTION public.get_job_total_cost(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_job_total_cost(uuid) TO authenticated;

-- get_my_role
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- get_next_article_code
REVOKE EXECUTE ON FUNCTION public.get_next_article_code() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_next_article_code() TO authenticated;

-- recalculate_all_inventory (admin utility, keep accessible to authenticated)
REVOKE EXECUTE ON FUNCTION public.recalculate_all_inventory() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recalculate_all_inventory() TO authenticated;

-- recalculate_all_job_inventory
REVOKE EXECUTE ON FUNCTION public.recalculate_all_job_inventory() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recalculate_all_job_inventory() TO authenticated;

-- recalculate_inventory_item
REVOKE EXECUTE ON FUNCTION public.recalculate_inventory_item(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recalculate_inventory_item(uuid) TO authenticated;

-- update_user_role (admin only in practice; role check is inside the function)
REVOKE EXECUTE ON FUNCTION public.update_user_role(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_user_role(uuid, text) TO authenticated;
