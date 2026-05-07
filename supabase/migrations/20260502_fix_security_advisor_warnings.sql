-- Fix remaining Supabase Security Advisor warnings
-- 1. function_search_path_mutable: update_attendance_corrections_updated_at
-- 2. rls_policy_always_true: leave_requests, load_notes, load_note_items
-- 3. public_bucket_allows_listing: images, documents
-- 4. anon/authenticated can execute SECURITY DEFINER functions

-- ============================================================
-- PART 1: Fix function search_path mutable
-- ============================================================

-- update_attendance_corrections_updated_at is a simple trigger, no SECURITY DEFINER needed
CREATE OR REPLACE FUNCTION public.update_attendance_corrections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================
-- PART 2: Fix RLS policies with USING/WITH CHECK (true)
-- ============================================================

-- -------------------- LEAVE_REQUESTS --------------------
DROP POLICY IF EXISTS "Allow delete access to all authenticated users" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow insert access to all authenticated users" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow update access to all authenticated users" ON public.leave_requests;

CREATE POLICY "Leave requests insertable by operativo+"
    ON public.leave_requests FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'responsabile', 'operativo')
        )
    );

CREATE POLICY "Leave requests updatable by operativo+"
    ON public.leave_requests FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'responsabile', 'operativo')
        )
    );

CREATE POLICY "Leave requests deletable by responsabile+"
    ON public.leave_requests FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'responsabile')
        )
    );

-- -------------------- LOAD_NOTES --------------------
DROP POLICY IF EXISTS "Load notes insertable by authenticated" ON public.load_notes;
DROP POLICY IF EXISTS "Load notes updatable by authenticated" ON public.load_notes;

CREATE POLICY "Load notes insertable by authenticated"
    ON public.load_notes FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Load notes updatable by authenticated"
    ON public.load_notes FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
        )
    );

-- -------------------- LOAD_NOTE_ITEMS --------------------
DROP POLICY IF EXISTS "Load note items insertable by authenticated" ON public.load_note_items;
DROP POLICY IF EXISTS "Load note items updatable by authenticated" ON public.load_note_items;

CREATE POLICY "Load note items insertable by authenticated"
    ON public.load_note_items FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Load note items updatable by authenticated"
    ON public.load_note_items FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
        )
    );

-- ============================================================
-- PART 3: Fix storage bucket broad SELECT policies
-- Restrict listing to authenticated users only.
-- Public bucket URLs remain accessible (public=true is not changed for images).
-- Documents bucket is made non-public since documents use authenticated access.
-- ============================================================

-- Images: restrict SELECT (listing) to authenticated only
DROP POLICY IF EXISTS "images_select_policy" ON storage.objects;
CREATE POLICY "images_select_policy"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'images');

-- Documents: restrict SELECT to authenticated (was already TO authenticated,
-- but bucket is public — make it private so URLs also require auth)
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- ============================================================
-- PART 4: Revoke EXECUTE from anon/authenticated on SECURITY DEFINER
-- functions that should never be called directly via /rpc (trigger functions
-- and internal utilities not meant for the public API).
-- ============================================================

-- Trigger functions: revoke from both anon and authenticated
REVOKE EXECUTE ON FUNCTION public.handle_delivery_note_delete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_delivery_note_deletion() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_delivery_note_item_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_movement_logic() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_purchase_item_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_purchase_job_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_fictitious_price_timestamp() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_load_notes_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_movement_stock() FROM anon, authenticated;

-- log_inventory_anomaly: internal utility, not for direct API calls
REVOKE EXECUTE ON FUNCTION public.log_inventory_anomaly() FROM anon, authenticated;

-- Callable functions: keep for authenticated, revoke from anon only
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_quantity_from_pieces() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_inventory_integrity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_purchase_item_usage() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_inventory_search(text, text, integer, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_items_with_untracked_lots() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_job_total_cost(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_article_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_inventory() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_job_inventory() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_inventory_item(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_user_role(uuid, text) FROM anon;
