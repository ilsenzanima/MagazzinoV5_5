-- Migration: Fix function search_path and RLS policies
-- Date: 2026-01-22
-- Description: Fixes security warnings for functions and overly permissive RLS policies

-- ============================================================
-- PART 1: Fix function search_path warnings
-- ============================================================

-- Fix get_inventory_search
ALTER FUNCTION public.get_inventory_search(text, text, int, int) SET search_path = public;

-- Fix get_exhausted_purchase_ids
ALTER FUNCTION public.get_exhausted_purchase_ids() SET search_path = public;

-- ============================================================
-- PART 2: Fix RLS policies with proper role checks
-- All INSERT/UPDATE/DELETE operations require admin/operativo role
-- ============================================================

-- Helper: Check if user has operativo or higher role
-- (admin, operativo can modify data - 'user' is read-only)

-- -------------------- ATTENDANCE --------------------
DROP POLICY IF EXISTS "Attendance deletable by authenticated users" ON attendance;
DROP POLICY IF EXISTS "Attendance insertable by authenticated users" ON attendance;
DROP POLICY IF EXISTS "Attendance updatable by authenticated users" ON attendance;
DROP POLICY IF EXISTS "Attendance insertable by operativo+" ON attendance;
DROP POLICY IF EXISTS "Attendance updatable by operativo+" ON attendance;
DROP POLICY IF EXISTS "Attendance deletable by admin" ON attendance;

CREATE POLICY "Attendance insertable by operativo+"
    ON attendance FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Attendance updatable by operativo+"
    ON attendance FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Attendance deletable by admin"
    ON attendance FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin')
        )
    );

-- -------------------- BRANDS --------------------
DROP POLICY IF EXISTS "Authenticated users can create brands." ON brands;
DROP POLICY IF EXISTS "Authenticated users can delete brands." ON brands;
DROP POLICY IF EXISTS "Brands insertable by operativo+" ON brands;
DROP POLICY IF EXISTS "Brands deletable by admin" ON brands;

CREATE POLICY "Brands insertable by operativo+"
    ON brands FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Brands deletable by admin"
    ON brands FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin')
        )
    );

-- -------------------- DELIVERY_NOTE_ITEMS --------------------
DROP POLICY IF EXISTS "Delivery note items insert by authenticated" ON delivery_note_items;
DROP POLICY IF EXISTS "Delivery note items insertable by operativo+" ON delivery_note_items;

CREATE POLICY "Delivery note items insertable by operativo+"
    ON delivery_note_items FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

-- -------------------- DELIVERY_NOTES --------------------
DROP POLICY IF EXISTS "Delivery notes insert by authenticated" ON delivery_notes;
DROP POLICY IF EXISTS "Delivery notes insertable by operativo+" ON delivery_notes;

CREATE POLICY "Delivery notes insertable by operativo+"
    ON delivery_notes FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

-- -------------------- ITEM_TYPES --------------------
DROP POLICY IF EXISTS "Authenticated users can create item_types." ON item_types;
DROP POLICY IF EXISTS "Authenticated users can delete item_types." ON item_types;
DROP POLICY IF EXISTS "Item types insertable by operativo+" ON item_types;
DROP POLICY IF EXISTS "Item types deletable by admin" ON item_types;

CREATE POLICY "Item types insertable by operativo+"
    ON item_types FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Item types deletable by admin"
    ON item_types FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin')
        )
    );

-- -------------------- PURCHASE_ITEMS --------------------
DROP POLICY IF EXISTS "Purchase items insert by authenticated" ON purchase_items;
DROP POLICY IF EXISTS "Purchase items insertable by operativo+" ON purchase_items;

CREATE POLICY "Purchase items insertable by operativo+"
    ON purchase_items FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

-- -------------------- PURCHASES --------------------
DROP POLICY IF EXISTS "Purchases insert by authenticated" ON purchases;
DROP POLICY IF EXISTS "Purchases insertable by operativo+" ON purchases;

CREATE POLICY "Purchases insertable by operativo+"
    ON purchases FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

-- -------------------- SITES --------------------
DROP POLICY IF EXISTS "Authenticated users can create sites." ON sites;
DROP POLICY IF EXISTS "Authenticated users can update sites." ON sites;
DROP POLICY IF EXISTS "Sites insertable by operativo+" ON sites;
DROP POLICY IF EXISTS "Sites updatable by operativo+" ON sites;

CREATE POLICY "Sites insertable by operativo+"
    ON sites FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Sites updatable by operativo+"
    ON sites FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

-- -------------------- UNITS --------------------
DROP POLICY IF EXISTS "Units are deletable by authenticated users." ON units;
DROP POLICY IF EXISTS "Units are insertable by authenticated users." ON units;
DROP POLICY IF EXISTS "Units insertable by operativo+" ON units;
DROP POLICY IF EXISTS "Units deletable by admin" ON units;

CREATE POLICY "Units insertable by operativo+"
    ON units FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Units deletable by admin"
    ON units FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin')
        )
    );

-- -------------------- WAREHOUSES --------------------
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON warehouses;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON warehouses;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON warehouses;
DROP POLICY IF EXISTS "Warehouses insertable by operativo+" ON warehouses;
DROP POLICY IF EXISTS "Warehouses updatable by operativo+" ON warehouses;
DROP POLICY IF EXISTS "Warehouses deletable by admin" ON warehouses;

CREATE POLICY "Warehouses insertable by operativo+"
    ON warehouses FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Warehouses updatable by operativo+"
    ON warehouses FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Warehouses deletable by admin"
    ON warehouses FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin')
        )
    );

-- -------------------- WORKER_COURSES --------------------
DROP POLICY IF EXISTS "Allow authenticated delete" ON worker_courses;
DROP POLICY IF EXISTS "Allow authenticated insert" ON worker_courses;
DROP POLICY IF EXISTS "Allow authenticated update" ON worker_courses;
DROP POLICY IF EXISTS "Worker courses insertable by operativo+" ON worker_courses;
DROP POLICY IF EXISTS "Worker courses updatable by operativo+" ON worker_courses;
DROP POLICY IF EXISTS "Worker courses deletable by admin" ON worker_courses;

CREATE POLICY "Worker courses insertable by operativo+"
    ON worker_courses FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Worker courses updatable by operativo+"
    ON worker_courses FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Worker courses deletable by admin"
    ON worker_courses FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin')
        )
    );

-- -------------------- WORKER_MEDICAL_EXAMS --------------------
DROP POLICY IF EXISTS "Allow authenticated delete" ON worker_medical_exams;
DROP POLICY IF EXISTS "Allow authenticated insert" ON worker_medical_exams;
DROP POLICY IF EXISTS "Allow authenticated update" ON worker_medical_exams;
DROP POLICY IF EXISTS "Worker medical exams insertable by operativo+" ON worker_medical_exams;
DROP POLICY IF EXISTS "Worker medical exams updatable by operativo+" ON worker_medical_exams;
DROP POLICY IF EXISTS "Worker medical exams deletable by admin" ON worker_medical_exams;

CREATE POLICY "Worker medical exams insertable by operativo+"
    ON worker_medical_exams FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Worker medical exams updatable by operativo+"
    ON worker_medical_exams FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Worker medical exams deletable by admin"
    ON worker_medical_exams FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin')
        )
    );

-- -------------------- LOAD_NOTES --------------------
-- All authenticated users can read, create, and update load notes
-- Only admin can delete
DROP POLICY IF EXISTS "Operativo and above can create load_notes" ON load_notes;
DROP POLICY IF EXISTS "Operativo and above can update load_notes" ON load_notes;
DROP POLICY IF EXISTS "Admin and responsabile can delete load_notes" ON load_notes;
DROP POLICY IF EXISTS "Load notes insertable by operativo+" ON load_notes;
DROP POLICY IF EXISTS "Load notes updatable by operativo+" ON load_notes;
DROP POLICY IF EXISTS "Load notes deletable by admin" ON load_notes;
DROP POLICY IF EXISTS "Load notes insertable by authenticated" ON load_notes;
DROP POLICY IF EXISTS "Load notes updatable by authenticated" ON load_notes;

CREATE POLICY "Load notes insertable by authenticated"
    ON load_notes FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Load notes updatable by authenticated"
    ON load_notes FOR UPDATE TO authenticated
    USING (true);

CREATE POLICY "Load notes deletable by admin"
    ON load_notes FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role = 'admin'
        )
    );

-- -------------------- LOAD_NOTE_ITEMS --------------------
DROP POLICY IF EXISTS "Operativo and above can create load_note_items" ON load_note_items;
DROP POLICY IF EXISTS "Operativo and above can update load_note_items" ON load_note_items;
DROP POLICY IF EXISTS "Admin and responsabile can delete load_note_items" ON load_note_items;
DROP POLICY IF EXISTS "Load note items insertable by operativo+" ON load_note_items;
DROP POLICY IF EXISTS "Load note items updatable by operativo+" ON load_note_items;
DROP POLICY IF EXISTS "Load note items deletable by admin" ON load_note_items;
DROP POLICY IF EXISTS "Load note items insertable by authenticated" ON load_note_items;
DROP POLICY IF EXISTS "Load note items updatable by authenticated" ON load_note_items;

CREATE POLICY "Load note items insertable by authenticated"
    ON load_note_items FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Load note items updatable by authenticated"
    ON load_note_items FOR UPDATE TO authenticated
    USING (true);

CREATE POLICY "Load note items deletable by admin"
    ON load_note_items FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role = 'admin'
        )
    );
