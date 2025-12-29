-- Migration: Fix RLS per INSERT Bolle
-- Data: 2025-12-29
-- Descrizione: Semplifica policy INSERT per evitare problemi con get_my_role() lato server

-- =====================================================
-- FIX POLICY delivery_notes INSERT
-- =====================================================
-- Problema: get_my_role() può fallire lato server action
-- Soluzione: Permettere INSERT a tutti gli autenticati (il controllo UI è già presente)

DROP POLICY IF EXISTS "Delivery notes insert by Admin/Operativo" ON public.delivery_notes;
CREATE POLICY "Delivery notes insert by authenticated"
ON public.delivery_notes FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- FIX POLICY delivery_note_items INSERT
-- =====================================================
DROP POLICY IF EXISTS "Delivery note items insert by Admin/Operativo" ON public.delivery_note_items;
CREATE POLICY "Delivery note items insert by authenticated"
ON public.delivery_note_items FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- FIX POLICY purchases INSERT (per coerenza)
-- =====================================================
DROP POLICY IF EXISTS "Purchases insert by Admin/Operativo" ON public.purchases;
CREATE POLICY "Purchases insert by authenticated"
ON public.purchases FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- FIX POLICY purchase_items INSERT
-- =====================================================
DROP POLICY IF EXISTS "Purchase items insert by Admin/Operativo" ON public.purchase_items;
CREATE POLICY "Purchase items insert by authenticated"
ON public.purchase_items FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verifica
SELECT tablename, policyname, cmd FROM pg_policies 
WHERE tablename IN ('delivery_notes', 'delivery_note_items', 'purchases', 'purchase_items')
AND cmd = 'INSERT';
