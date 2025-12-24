-- DEFINITIVE SECURITY FIX (2025-12-24) - REVISION 2
-- This script fixes ALL "Function Search Path Mutable" warnings by setting search_path in the function HEADER.
-- Run this entire script in the Supabase SQL Editor.

-- 1. handle_delivery_note_deletion
CREATE OR REPLACE FUNCTION public.handle_delivery_note_deletion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item RECORD;
    is_fictitious_val BOOLEAN;
BEGIN
    FOR item IN SELECT * FROM public.delivery_note_items WHERE delivery_note_id = OLD.id LOOP
        is_fictitious_val := COALESCE(item.is_fictitious, FALSE);

        IF OLD.type IN ('exit', 'sale') THEN
            IF OLD.type = 'exit' AND OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity - item.quantity,
                    pieces = pieces - item.pieces,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity + item.quantity,
                    pieces = pieces + item.pieces
                WHERE id = item.inventory_id;
            END IF;
            
        ELSIF OLD.type = 'entry' THEN
            IF OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity + item.quantity,
                    pieces = pieces + item.pieces,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity - item.quantity,
                    pieces = pieces - item.pieces
                WHERE id = item.inventory_id;
            END IF;
        END IF;
    END LOOP;
    RETURN OLD;
END;
$$;

-- 2. handle_purchase_item_change
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_coeff NUMERIC;
BEGIN
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.item_id, OLD.item_id);
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    IF TG_OP = 'INSERT' THEN
        UPDATE public.inventory
        SET pieces = pieces + NEW.pieces,
            quantity = (pieces + NEW.pieces) * item_coeff
        WHERE id = NEW.item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.inventory
        SET pieces = pieces - OLD.pieces,
            quantity = (pieces - OLD.pieces) * item_coeff
        WHERE id = OLD.item_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.pieces <> NEW.pieces THEN
            UPDATE public.inventory
            SET pieces = pieces - OLD.pieces + NEW.pieces,
            quantity = (pieces - OLD.pieces + NEW.pieces) * item_coeff
            WHERE id = NEW.item_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- 3. recalculate_inventory_item
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_coeff NUMERIC(10,4);
    total_pieces NUMERIC(10,2) := 0;
BEGIN
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = target_item_id;
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    -- Purchases
    SELECT COALESCE(SUM(pieces), 0) INTO total_pieces FROM public.purchase_items WHERE item_id = target_item_id;

    -- Delivery Notes (Excluding Fictitious)
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.pieces
            WHEN dn.type IN ('exit', 'sale') THEN -dni.pieces
            ELSE 0
        END
    ), 0) + total_pieces INTO total_pieces
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id
    AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL);

    -- Movements
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity / item_coeff
            WHEN type = 'unload' THEN -quantity / item_coeff
            ELSE 0
        END
    ), 0) + total_pieces INTO total_pieces
    FROM public.movements
    WHERE item_id = target_item_id;

    UPDATE public.inventory
    SET pieces = total_pieces,
        quantity = total_pieces * item_coeff
    WHERE id = target_item_id;
END;
$$;

-- 4. handle_movement_logic
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff_pieces NUMERIC;
  item_coeff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
BEGIN
  SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);
  IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;
  
  new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
  END IF;

  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.pieces, NEW.pieces * item_coeff)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET pieces = job_inventory.pieces + EXCLUDED.pieces, quantity = (job_inventory.pieces + EXCLUDED.pieces) * item_coeff, updated_at = now();
          END IF;
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces - NEW.pieces, quantity = (pieces - NEW.pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - NEW.pieces, quantity = (pieces - NEW.pieces) * item_coeff, updated_at = now() WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces + NEW.pieces, quantity = (pieces + NEW.pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - OLD.pieces, quantity = (pieces - OLD.pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces + OLD.pieces, quantity = (pieces + OLD.pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces + OLD.pieces, quantity = (pieces + OLD.pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces - OLD.pieces, quantity = (pieces - OLD.pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  ELSIF TG_OP = 'UPDATE' THEN
      PERFORM public.recalculate_inventory_item(NEW.inventory_id);
      IF OLD.inventory_id <> NEW.inventory_id THEN
          PERFORM public.recalculate_inventory_item(OLD.inventory_id);
      END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 5. get_my_role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user');
END;
$$;

-- 6. get_next_article_code
CREATE OR REPLACE FUNCTION public.get_next_article_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
  formatted_code text;
BEGIN
  next_val := nextval('article_code_seq');
  formatted_code := 'ART-' || lpad(next_val::text, 5, '0');
  RETURN formatted_code;
END;
$$;

-- 7. get_job_total_cost
CREATE OR REPLACE FUNCTION public.get_job_total_cost(p_job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
                NULLIF(m.item_price, 0),
                ip.last_price,
                0
            ) as effective_price
        FROM job_movements m
        LEFT JOIN item_prices ip ON m.item_id = ip.item_id
    )
    SELECT
        COALESCE(SUM(
            CASE 
                WHEN type = 'purchase' THEN quantity * effective_price
                ELSE -quantity * effective_price
            END
        ), 0)
    INTO total_cost
    FROM calc_movements;

    RETURN total_cost;
END;
$$;

-- 8. calculate_quantity_from_pieces
CREATE OR REPLACE FUNCTION public.calculate_quantity_from_pieces()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.pieces IS NOT NULL THEN
        NEW.quantity := NEW.pieces * NEW.coefficient;
    ELSIF NEW.quantity IS NOT NULL AND NEW.pieces IS NULL THEN
        IF NEW.coefficient <> 0 THEN
            NEW.pieces := ROUND(NEW.quantity / NEW.coefficient, 2);
            NEW.quantity := NEW.pieces * NEW.coefficient;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 9. Fix Views Security
ALTER VIEW public.purchase_batch_availability SET (security_invoker = true);
ALTER VIEW public.job_batch_availability SET (security_invoker = true);
ALTER VIEW public.stock_movements_view SET (security_invoker = true);
