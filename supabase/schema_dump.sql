


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_quantity_from_pieces"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."calculate_quantity_from_pieces"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_purchase_deletion_safety"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if any item from this purchase has been used in a delivery note
  IF EXISTS (
    SELECT 1 
    FROM public.delivery_note_items dni
    JOIN public.purchase_items pi ON dni.purchase_item_id = pi.id
    WHERE pi.purchase_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Impossibile eliminare l''acquisto: alcuni articoli sono già stati movimentati in bolle di uscita/vendita. Eliminare prima le bolle collegate.';
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."check_purchase_deletion_safety"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result json;
  total_val numeric;
  low_stock bigint;
  total_items bigint;
BEGIN
  -- Calcolo Valore Totale (da purchase_batch_availability per precisione)
  SELECT COALESCE(SUM(remaining_pieces * coefficient * unit_price), 0)
  INTO total_val
  FROM purchase_batch_availability
  WHERE remaining_pieces > 0;

  -- Conteggi Inventario
  SELECT 
    COUNT(*) FILTER (WHERE quantity <= min_stock),
    COUNT(*)
  INTO low_stock, total_items
  FROM inventory;

  result := json_build_object(
    'totalValue', total_val,
    'lowStockCount', low_stock,
    'totalItems', total_items
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_job_total_cost"("p_job_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_job_total_cost"("p_job_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "category" "text",
    "quantity" numeric(10,2) DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 0,
    "description" "text",
    "image_url" "text",
    "price" numeric(10,2),
    "location" "text",
    "unit" "text" DEFAULT 'PZ'::"text",
    "coefficient" numeric(10,2) DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "supplier_code" "text",
    "pieces" numeric(10,2) DEFAULT 0 NOT NULL,
    "model" "text",
    CONSTRAINT "inventory_quantity_non_negative" CHECK (("quantity" >= '-0.01'::numeric)),
    CONSTRAINT "inventory_unit_check" CHECK (("unit" = ANY (ARRAY['PZ'::"text", 'ML'::"text", 'MQ'::"text", 'KG'::"text", 'L'::"text"])))
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_low_stock_inventory"() RETURNS SETOF "public"."inventory"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT * FROM inventory 
  WHERE quantity <= min_stock
  ORDER BY name;
$$;


ALTER FUNCTION "public"."get_low_stock_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user');
END;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_article_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_next_article_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_delivery_note_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_delivery_note_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_delivery_note_item_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  note_type TEXT;
BEGIN
  -- Get the type from the parent delivery note
  SELECT type INTO note_type
  FROM public.delivery_notes
  WHERE id = COALESCE(NEW.delivery_note_id, OLD.delivery_note_id);

  IF TG_OP = 'INSERT' THEN
    IF note_type = 'entry' THEN
      UPDATE public.inventory
      SET quantity = quantity + NEW.quantity
      WHERE id = NEW.inventory_id;
    ELSIF note_type IN ('exit', 'sale') THEN
      UPDATE public.inventory
      SET quantity = quantity - NEW.quantity
      WHERE id = NEW.inventory_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse the operation
    IF note_type = 'entry' THEN
      UPDATE public.inventory
      SET quantity = quantity - OLD.quantity
      WHERE id = OLD.inventory_id;
    ELSIF note_type IN ('exit', 'sale') THEN
      UPDATE public.inventory
      SET quantity = quantity + OLD.quantity
      WHERE id = OLD.inventory_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_delivery_note_item_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_movement_logic"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
  current_qty NUMERIC;
BEGIN
  new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
  END IF;

  -- INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;

      IF note_type IN ('exit', 'sale') THEN
          -- Validazione Disponibilità
          IF NOT new_is_fictitious THEN
              SELECT quantity INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
              IF current_qty < NEW.quantity THEN
                  RAISE EXCEPTION 'Quantità insufficiente in magazzino. Richiesto: %, Disponibile: %', NEW.quantity, current_qty;
              END IF;
          END IF;

          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, quantity) VALUES (note_job_id, NEW.inventory_id, NEW.quantity)
              ON CONFLICT (job_id, item_id) DO UPDATE SET quantity = job_inventory.quantity + EXCLUDED.quantity, updated_at = now();
          END IF;

          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity - NEW.quantity WHERE id = NEW.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - NEW.quantity, updated_at = now() WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity + NEW.quantity WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  -- DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity + OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
      ELSIF note_type = 'entry' THEN
          IF NOT old_is_fictitious THEN
              SELECT quantity INTO current_qty FROM public.inventory WHERE id = OLD.inventory_id;
              IF current_qty < OLD.quantity THEN
                  RAISE EXCEPTION 'Impossibile eliminare entrata: giacenza diverrebbe negativa.';
              END IF;
          END IF;
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity + OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff := NEW.quantity - OLD.quantity;
      
      IF NOT new_is_fictitious AND NOT old_is_fictitious THEN
          IF diff <> 0 THEN
              IF note_type IN ('exit', 'sale') THEN
                  IF diff > 0 THEN
                      SELECT quantity INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
                      IF current_qty < diff THEN RAISE EXCEPTION 'Quantità insufficiente per modifica.'; END IF;
                  END IF;
                  IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                      INSERT INTO public.job_inventory (job_id, item_id, quantity) VALUES (note_job_id, NEW.inventory_id, diff)
                      ON CONFLICT (job_id, item_id) DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
                  END IF;
                  UPDATE public.inventory SET quantity = quantity - diff WHERE id = NEW.inventory_id;
              ELSIF note_type = 'entry' THEN
                  IF diff < 0 THEN
                      SELECT quantity INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
                      IF current_qty < ABS(diff) THEN RAISE EXCEPTION 'Impossibile ridurre entrata: giacenza insufficiente.'; END IF;
                  END IF;
                  IF note_job_id IS NOT NULL THEN
                      UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now() WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
                  END IF;
                  UPDATE public.inventory SET quantity = quantity + diff WHERE id = NEW.inventory_id;
              END IF;
          END IF;
      -- Gestione cambi stato fittizio/reale omessa per brevità ma inclusa nella logica originale se necessaria
      END IF;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_movement_logic"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_purchase_item_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    item_coeff NUMERIC;
    v_job_id UUID;
BEGIN
    -- Get coefficient
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.item_id, OLD.item_id);
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    -- Get job_id from parent purchase
    IF TG_OP = 'DELETE' THEN
        SELECT job_id INTO v_job_id FROM public.purchases WHERE id = OLD.purchase_id;
    ELSE
        SELECT job_id INTO v_job_id FROM public.purchases WHERE id = NEW.purchase_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_job_id IS NOT NULL THEN
            -- Direct to Job Site -> Update Job Inventory
            INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
            VALUES (v_job_id, NEW.item_id, NEW.pieces, NEW.quantity)
            ON CONFLICT (job_id, item_id) 
            DO UPDATE SET 
                pieces = job_inventory.pieces + EXCLUDED.pieces,
                quantity = job_inventory.quantity + EXCLUDED.quantity,
                updated_at = now();
        ELSE
            -- To Warehouse -> Update Main Inventory
            UPDATE public.inventory
            SET pieces = pieces + NEW.pieces,
                quantity = quantity + NEW.quantity
            WHERE id = NEW.item_id;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        IF v_job_id IS NOT NULL THEN
            -- Remove from Job Site
            UPDATE public.job_inventory
            SET pieces = pieces - OLD.pieces,
                quantity = quantity - OLD.quantity,
                updated_at = now()
            WHERE job_id = v_job_id AND item_id = OLD.item_id;
        ELSE
            -- Remove from Warehouse
            UPDATE public.inventory
            SET pieces = pieces - OLD.pieces,
                quantity = quantity - OLD.quantity
            WHERE id = OLD.item_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle potential change in quantities/pieces
        -- (Assuming purchase doesn't move between jobs for simplicity, though theoretically possible)
        IF v_job_id IS NOT NULL THEN
             UPDATE public.job_inventory
             SET pieces = pieces - OLD.pieces + NEW.pieces,
                 quantity = quantity - OLD.quantity + NEW.quantity,
                 updated_at = now()
             WHERE job_id = v_job_id AND item_id = NEW.item_id;
        ELSE
             UPDATE public.inventory
             SET pieces = pieces - OLD.pieces + NEW.pieces,
                 quantity = quantity - OLD.quantity + NEW.quantity
             WHERE id = NEW.item_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_purchase_item_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_inventory_item"("target_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    total_purchased NUMERIC(10,2) := 0;
    total_delivered NUMERIC(10,2) := 0;
    total_legacy NUMERIC(10,2) := 0;
    final_quantity NUMERIC(10,2) := 0;
BEGIN
    -- Sum Purchases (ONLY those NOT linked to a job)
    SELECT COALESCE(SUM(pi.quantity), 0) INTO total_purchased
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE pi.item_id = target_item_id
    AND p.job_id IS NULL; -- KEY CHANGE: Exclude direct-to-site purchases

    -- Sum Delivery Notes
    -- Entry = + (Back to warehouse)
    -- Exit/Sale = - (Out of warehouse)
    -- EXCLUDE Fictitious items
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.quantity
            WHEN dn.type IN ('exit', 'sale') THEN -dni.quantity
            ELSE 0
        END
    ), 0) INTO total_delivered
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id
    AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL);

    -- Sum Legacy Movements
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity
            WHEN type = 'unload' THEN -quantity
            ELSE 0
        END
    ), 0) INTO total_legacy
    FROM public.movements
    WHERE item_id = target_item_id;

    -- Final
    final_quantity := total_purchased + total_delivered + total_legacy;

    -- Update Inventory
    UPDATE public.inventory
    SET quantity = final_quantity
    WHERE id = target_item_id;
END;
$$;


ALTER FUNCTION "public"."recalculate_inventory_item"("target_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  ) then
    raise exception 'Access denied: Only admins can update roles.';
  end if;

  -- Update the target user's role
  update public.profiles
  set role = new_role, updated_at = now()
  where id = target_user_id;
end;
$$;


ALTER FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "text") OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."article_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."article_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "vat_number" "text",
    "address" "text",
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "street" "text",
    "street_number" "text",
    "postal_code" "text",
    "city" "text",
    "province" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_note_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_note_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "quantity" numeric(10,5) NOT NULL,
    "price" numeric(10,5),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pieces" numeric(10,2),
    "coefficient" numeric(10,2) DEFAULT 1.0,
    "purchase_item_id" "uuid",
    "is_fictitious" boolean DEFAULT false,
    CONSTRAINT "delivery_note_items_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."delivery_note_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "number" "text" NOT NULL,
    "date" "date" NOT NULL,
    "job_id" "uuid",
    "causal" "text",
    "pickup_location" "text",
    "delivery_location" "text",
    "transport_mean" "text",
    "appearance" "text",
    "packages_count" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "transport_time" time without time zone,
    "created_by" "uuid",
    CONSTRAINT "delivery_notes_type_check" CHECK (("type" = ANY (ARRAY['entry'::"text", 'exit'::"text", 'sale'::"text"])))
);


ALTER TABLE "public"."delivery_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_supplier_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "supplier_id" "uuid",
    "supplier_name" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."inventory_supplier_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "image_url" "text"
);


ALTER TABLE "public"."item_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "job_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pieces" numeric(10,2),
    "coefficient" numeric(10,2) DEFAULT 1.0,
    CONSTRAINT "purchase_items_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "purchase_items_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."purchase_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "delivery_note_number" "text" NOT NULL,
    "delivery_note_date" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "job_id" "uuid",
    "document_url" "text",
    CONSTRAINT "purchases_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."job_batch_availability" WITH ("security_invoker"='true') AS
 WITH "warehouse_movements" AS (
         SELECT "dn"."job_id",
            "dni"."inventory_id" AS "item_id",
            "dni"."purchase_item_id",
                CASE
                    WHEN ("dn"."type" = 'exit'::"text") THEN "dni"."quantity"
                    WHEN ("dn"."type" = 'entry'::"text") THEN (- "dni"."quantity")
                    ELSE (0)::numeric
                END AS "quantity",
                CASE
                    WHEN ("dn"."type" = 'exit'::"text") THEN "dni"."pieces"
                    WHEN ("dn"."type" = 'entry'::"text") THEN (- "dni"."pieces")
                    ELSE (0)::numeric
                END AS "pieces",
            "dni"."coefficient"
           FROM ("public"."delivery_note_items" "dni"
             JOIN "public"."delivery_notes" "dn" ON (("dni"."delivery_note_id" = "dn"."id")))
          WHERE (("dn"."job_id" IS NOT NULL) AND ("dn"."type" = ANY (ARRAY['exit'::"text", 'entry'::"text"])) AND (("dni"."is_fictitious" IS FALSE) OR ("dni"."is_fictitious" IS NULL)))
        ), "direct_purchases" AS (
         SELECT "p_1"."job_id",
            "pi_1"."item_id",
            "pi_1"."id" AS "purchase_item_id",
            "pi_1"."quantity",
            "pi_1"."pieces",
            "pi_1"."coefficient"
           FROM ("public"."purchase_items" "pi_1"
             JOIN "public"."purchases" "p_1" ON (("pi_1"."purchase_id" = "p_1"."id")))
          WHERE ("p_1"."job_id" IS NOT NULL)
        )
 SELECT "combined"."job_id",
    "combined"."item_id",
    "combined"."purchase_item_id",
    COALESCE("p"."delivery_note_number", 'N/A'::"text") AS "purchase_ref",
    "i"."name" AS "item_name",
    "i"."model" AS "item_model",
    "i"."code" AS "item_code",
    "i"."unit" AS "item_unit",
    "i"."brand" AS "item_brand",
    "i"."category" AS "item_category",
    "sum"("combined"."quantity") AS "quantity",
    "sum"("combined"."pieces") AS "pieces",
    "combined"."coefficient"
   FROM (((( SELECT "warehouse_movements"."job_id",
            "warehouse_movements"."item_id",
            "warehouse_movements"."purchase_item_id",
            "warehouse_movements"."quantity",
            "warehouse_movements"."pieces",
            "warehouse_movements"."coefficient"
           FROM "warehouse_movements"
        UNION ALL
         SELECT "direct_purchases"."job_id",
            "direct_purchases"."item_id",
            "direct_purchases"."purchase_item_id",
            "direct_purchases"."quantity",
            "direct_purchases"."pieces",
            "direct_purchases"."coefficient"
           FROM "direct_purchases") "combined"
     JOIN "public"."inventory" "i" ON (("combined"."item_id" = "i"."id")))
     LEFT JOIN "public"."purchase_items" "pi" ON (("combined"."purchase_item_id" = "pi"."id")))
     LEFT JOIN "public"."purchases" "p" ON (("pi"."purchase_id" = "p"."id")))
  GROUP BY "combined"."job_id", "combined"."item_id", "combined"."purchase_item_id", "p"."delivery_note_number", "i"."name", "i"."model", "i"."code", "i"."unit", "i"."brand", "i"."category", "combined"."coefficient"
 HAVING ("sum"("combined"."quantity") > 0.001);


ALTER VIEW "public"."job_batch_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "category" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."job_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pieces" numeric(10,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."job_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "content" "text" NOT NULL,
    "weather_info" "jsonb",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."job_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "code" "text",
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "site_address" "text",
    "site_manager" "text",
    "cig" "text",
    "cup" "text",
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "reference" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "job_id" "uuid",
    CONSTRAINT "movements_type_check" CHECK (("type" = ANY (ARRAY['load'::"text", 'unload'::"text"])))
);


ALTER TABLE "public"."movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "text" DEFAULT 'user'::"text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text", 'operativo'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."purchase_batch_availability" WITH ("security_invoker"='true') AS
 SELECT "pi"."id" AS "purchase_item_id",
    "pi"."item_id",
    "p"."delivery_note_number" AS "purchase_ref",
    "p"."created_at" AS "purchase_date",
    "pi"."price" AS "unit_price",
    "pi"."coefficient",
    "pi"."quantity" AS "original_quantity",
    ("pi"."quantity" - COALESCE(( SELECT "sum"("dni"."quantity") AS "sum"
           FROM ("public"."delivery_note_items" "dni"
             JOIN "public"."delivery_notes" "dn" ON (("dni"."delivery_note_id" = "dn"."id")))
          WHERE (("dni"."purchase_item_id" = "pi"."id") AND ("dn"."type" = ANY (ARRAY['exit'::"text", 'sale'::"text"])) AND (("dni"."is_fictitious" IS FALSE) OR ("dni"."is_fictitious" IS NULL)))), (0)::numeric)) AS "remaining_quantity",
    "pi"."pieces" AS "original_pieces",
    ("pi"."pieces" - COALESCE(( SELECT "sum"("dni"."pieces") AS "sum"
           FROM ("public"."delivery_note_items" "dni"
             JOIN "public"."delivery_notes" "dn" ON (("dni"."delivery_note_id" = "dn"."id")))
          WHERE (("dni"."purchase_item_id" = "pi"."id") AND ("dn"."type" = ANY (ARRAY['exit'::"text", 'sale'::"text"])) AND (("dni"."is_fictitious" IS FALSE) OR ("dni"."is_fictitious" IS NULL)))), (0)::numeric)) AS "remaining_pieces"
   FROM ("public"."purchase_items" "pi"
     JOIN "public"."purchases" "p" ON (("pi"."purchase_id" = "p"."id")))
  WHERE (("p"."job_id" IS NULL) AND (("pi"."pieces" - COALESCE(( SELECT "sum"("dni"."pieces") AS "sum"
           FROM ("public"."delivery_note_items" "dni"
             JOIN "public"."delivery_notes" "dn" ON (("dni"."delivery_note_id" = "dn"."id")))
          WHERE (("dni"."purchase_item_id" = "pi"."id") AND ("dn"."type" = ANY (ARRAY['exit'::"text", 'sale'::"text"])) AND (("dni"."is_fictitious" IS FALSE) OR ("dni"."is_fictitious" IS NULL)))), (0)::numeric)) > 0.001));


ALTER VIEW "public"."purchase_batch_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "manager" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "sites_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "vat_number" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."stock_movements_view" WITH ("security_invoker"='true') AS
 SELECT "pi"."id",
    "pi"."created_at" AS "date",
    'purchase'::"text" AS "type",
    "pi"."quantity",
    "p"."delivery_note_number" AS "reference",
    "pi"."item_id",
    "p"."created_by" AS "user_id",
    "pr"."full_name" AS "user_name",
    "i"."code" AS "item_code",
    "i"."name" AS "item_name",
    "i"."model" AS "item_model",
    "i"."unit" AS "item_unit",
    "pi"."price" AS "item_price",
    "pi"."pieces",
    "pi"."coefficient",
    "p"."notes",
    COALESCE("pi"."job_id", "p"."job_id") AS "job_id",
    "j"."code" AS "job_code",
    "j"."description" AS "job_description",
    false AS "is_fictitious",
    "s"."name" AS "supplier_name",
    "p"."delivery_note_date" AS "purchase_date",
    "p"."delivery_note_number" AS "purchase_number",
    "p"."id" AS "purchase_id",
    NULL::"uuid" AS "delivery_note_id"
   FROM ((((("public"."purchase_items" "pi"
     JOIN "public"."purchases" "p" ON (("pi"."purchase_id" = "p"."id")))
     LEFT JOIN "public"."profiles" "pr" ON (("p"."created_by" = "pr"."id")))
     LEFT JOIN "public"."inventory" "i" ON (("pi"."item_id" = "i"."id")))
     LEFT JOIN "public"."suppliers" "s" ON (("p"."supplier_id" = "s"."id")))
     LEFT JOIN "public"."jobs" "j" ON ((COALESCE("pi"."job_id", "p"."job_id") = "j"."id")))
UNION ALL
 SELECT "dni"."id",
    "dni"."created_at" AS "date",
    "dn"."type",
        CASE
            WHEN ("dn"."type" = 'entry'::"text") THEN "dni"."quantity"
            ELSE (- "dni"."quantity")
        END AS "quantity",
    "dn"."number" AS "reference",
    "dni"."inventory_id" AS "item_id",
    "dn"."created_by" AS "user_id",
    "pr"."full_name" AS "user_name",
    "i"."code" AS "item_code",
    "i"."name" AS "item_name",
    "i"."model" AS "item_model",
    "i"."unit" AS "item_unit",
    COALESCE("pi"."price", "i"."price") AS "item_price",
    "dni"."pieces",
    "dni"."coefficient",
    "dn"."notes",
    "dn"."job_id",
    "j"."code" AS "job_code",
    "j"."description" AS "job_description",
    "dni"."is_fictitious",
    "s"."name" AS "supplier_name",
    "p"."delivery_note_date" AS "purchase_date",
    "p"."delivery_note_number" AS "purchase_number",
    "p"."id" AS "purchase_id",
    "dn"."id" AS "delivery_note_id"
   FROM ((((((("public"."delivery_note_items" "dni"
     JOIN "public"."delivery_notes" "dn" ON (("dni"."delivery_note_id" = "dn"."id")))
     LEFT JOIN "public"."profiles" "pr" ON (("dn"."created_by" = "pr"."id")))
     LEFT JOIN "public"."inventory" "i" ON (("dni"."inventory_id" = "i"."id")))
     LEFT JOIN "public"."purchase_items" "pi" ON (("dni"."purchase_item_id" = "pi"."id")))
     LEFT JOIN "public"."purchases" "p" ON (("pi"."purchase_id" = "p"."id")))
     LEFT JOIN "public"."suppliers" "s" ON (("p"."supplier_id" = "s"."id")))
     LEFT JOIN "public"."jobs" "j" ON (("dn"."job_id" = "j"."id")))
UNION ALL
 SELECT "m"."id",
    "m"."created_at" AS "date",
        CASE
            WHEN ("m"."type" = 'load'::"text") THEN 'entry'::"text"
            WHEN ("m"."type" = 'unload'::"text") THEN 'exit'::"text"
            ELSE "m"."type"
        END AS "type",
        CASE
            WHEN ("m"."type" = 'load'::"text") THEN "m"."quantity"
            ELSE (- "m"."quantity")
        END AS "quantity",
    "m"."reference",
    "m"."item_id",
    "m"."user_id",
    "pr"."full_name" AS "user_name",
    "i"."code" AS "item_code",
    "i"."name" AS "item_name",
    "i"."model" AS "item_model",
    "i"."unit" AS "item_unit",
    "i"."price" AS "item_price",
    NULL::numeric AS "pieces",
    NULL::numeric AS "coefficient",
    "m"."notes",
    "m"."job_id",
    "j"."code" AS "job_code",
    "j"."description" AS "job_description",
    false AS "is_fictitious",
    NULL::"text" AS "supplier_name",
    NULL::"date" AS "purchase_date",
    NULL::"text" AS "purchase_number",
    NULL::"uuid" AS "purchase_id",
    NULL::"uuid" AS "delivery_note_id"
   FROM ((("public"."movements" "m"
     LEFT JOIN "public"."profiles" "pr" ON (("m"."user_id" = "pr"."id")))
     LEFT JOIN "public"."inventory" "i" ON (("m"."item_id" = "i"."id")))
     LEFT JOIN "public"."jobs" "j" ON (("m"."job_id" = "j"."id")));


ALTER VIEW "public"."stock_movements_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."workers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_note_items"
    ADD CONSTRAINT "delivery_note_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_notes"
    ADD CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_supplier_codes"
    ADD CONSTRAINT "inventory_supplier_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_types"
    ADD CONSTRAINT "item_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."item_types"
    ADD CONSTRAINT "item_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_inventory"
    ADD CONSTRAINT "job_inventory_job_id_item_id_key" UNIQUE ("job_id", "item_id");



ALTER TABLE ONLY "public"."job_inventory"
    ADD CONSTRAINT "job_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movements"
    ADD CONSTRAINT "movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "workers_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_clients_address" ON "public"."clients" USING "btree" ("address");



CREATE INDEX "idx_clients_email" ON "public"."clients" USING "btree" ("email");



CREATE INDEX "idx_clients_email_trgm" ON "public"."clients" USING "gin" ("email" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_clients_name" ON "public"."clients" USING "btree" ("name");



CREATE INDEX "idx_clients_name_sort" ON "public"."clients" USING "btree" ("name");



CREATE INDEX "idx_clients_name_trgm" ON "public"."clients" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_clients_vat_number" ON "public"."clients" USING "btree" ("vat_number");



CREATE INDEX "idx_clients_vat_trgm" ON "public"."clients" USING "gin" ("vat_number" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_delivery_note_items_delivery_note_id" ON "public"."delivery_note_items" USING "btree" ("delivery_note_id");



CREATE INDEX "idx_delivery_note_items_dn_id" ON "public"."delivery_note_items" USING "btree" ("delivery_note_id");



CREATE INDEX "idx_delivery_note_items_inv_id" ON "public"."delivery_note_items" USING "btree" ("inventory_id");



CREATE INDEX "idx_delivery_note_items_inventory_id" ON "public"."delivery_note_items" USING "btree" ("inventory_id");



CREATE INDEX "idx_delivery_note_items_purchase_item_id" ON "public"."delivery_note_items" USING "btree" ("purchase_item_id");



CREATE INDEX "idx_delivery_notes_causal" ON "public"."delivery_notes" USING "btree" ("causal");



CREATE INDEX "idx_delivery_notes_causal_trgm" ON "public"."delivery_notes" USING "gin" ("causal" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_delivery_notes_created_by" ON "public"."delivery_notes" USING "btree" ("created_by");



CREATE INDEX "idx_delivery_notes_date" ON "public"."delivery_notes" USING "btree" ("date" DESC);



CREATE INDEX "idx_delivery_notes_job_id" ON "public"."delivery_notes" USING "btree" ("job_id");



CREATE INDEX "idx_delivery_notes_number" ON "public"."delivery_notes" USING "btree" ("number");



CREATE INDEX "idx_delivery_notes_number_trgm" ON "public"."delivery_notes" USING "gin" ("number" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_inventory_brand" ON "public"."inventory" USING "btree" ("brand");



CREATE INDEX "idx_inventory_brand_trgm" ON "public"."inventory" USING "gin" ("brand" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_inventory_category" ON "public"."inventory" USING "btree" ("category");



CREATE INDEX "idx_inventory_category_trgm" ON "public"."inventory" USING "gin" ("category" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_inventory_code" ON "public"."inventory" USING "btree" ("code");



CREATE INDEX "idx_inventory_code_trgm" ON "public"."inventory" USING "gin" ("code" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_inventory_created_at" ON "public"."inventory" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_inventory_low_stock_composite" ON "public"."inventory" USING "btree" ("quantity", "min_stock");



CREATE INDEX "idx_inventory_min_stock" ON "public"."inventory" USING "btree" ("quantity", "min_stock");



CREATE INDEX "idx_inventory_name" ON "public"."inventory" USING "btree" ("name");



CREATE INDEX "idx_inventory_name_trgm" ON "public"."inventory" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_inventory_quantity" ON "public"."inventory" USING "btree" ("quantity");



CREATE INDEX "idx_inventory_supplier_code" ON "public"."inventory" USING "btree" ("supplier_code");



CREATE INDEX "idx_inventory_supplier_code_trgm" ON "public"."inventory" USING "gin" ("supplier_code" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_inventory_supplier_codes_inventory_id" ON "public"."inventory_supplier_codes" USING "btree" ("inventory_id");



CREATE INDEX "idx_inventory_supplier_codes_supplier_id" ON "public"."inventory_supplier_codes" USING "btree" ("supplier_id");



CREATE INDEX "idx_job_documents_job_id" ON "public"."job_documents" USING "btree" ("job_id");



CREATE INDEX "idx_job_documents_uploaded_by" ON "public"."job_documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_job_inventory_item_id" ON "public"."job_inventory" USING "btree" ("item_id");



CREATE INDEX "idx_job_logs_date" ON "public"."job_logs" USING "btree" ("date");



CREATE INDEX "idx_job_logs_job_id" ON "public"."job_logs" USING "btree" ("job_id");



CREATE INDEX "idx_job_logs_user_id" ON "public"."job_logs" USING "btree" ("user_id");



CREATE INDEX "idx_jobs_client_id" ON "public"."jobs" USING "btree" ("client_id");



CREATE INDEX "idx_jobs_code" ON "public"."jobs" USING "btree" ("code");



CREATE INDEX "idx_jobs_code_trgm" ON "public"."jobs" USING "gin" ("code" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_jobs_description" ON "public"."jobs" USING "btree" ("description");



CREATE INDEX "idx_jobs_description_trgm" ON "public"."jobs" USING "gin" ("description" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "idx_movements_created_at" ON "public"."movements" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_movements_item_id" ON "public"."movements" USING "btree" ("item_id");



CREATE INDEX "idx_movements_job_id" ON "public"."movements" USING "btree" ("job_id");



CREATE INDEX "idx_movements_type" ON "public"."movements" USING "btree" ("type");



CREATE INDEX "idx_movements_user_id" ON "public"."movements" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_id_role" ON "public"."profiles" USING "btree" ("id", "role");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_user_role" ON "public"."profiles" USING "btree" ("id", "role");



CREATE INDEX "idx_purchase_items_item_id" ON "public"."purchase_items" USING "btree" ("item_id");



CREATE INDEX "idx_purchase_items_job_id" ON "public"."purchase_items" USING "btree" ("job_id");



CREATE INDEX "idx_purchase_items_purchase_id" ON "public"."purchase_items" USING "btree" ("purchase_id");



CREATE INDEX "idx_purchases_created_at" ON "public"."purchases" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_purchases_created_by" ON "public"."purchases" USING "btree" ("created_by");



CREATE INDEX "idx_purchases_delivery_note_number" ON "public"."purchases" USING "btree" ("delivery_note_number");



CREATE INDEX "idx_purchases_dn_number_trgm" ON "public"."purchases" USING "gin" ("delivery_note_number" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_purchases_job_id" ON "public"."purchases" USING "btree" ("job_id");



CREATE INDEX "idx_purchases_notes_trgm" ON "public"."purchases" USING "gin" ("notes" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_purchases_supplier_id" ON "public"."purchases" USING "btree" ("supplier_id");



CREATE INDEX "idx_sites_job_id" ON "public"."sites" USING "btree" ("job_id");



CREATE INDEX "idx_suppliers_email" ON "public"."suppliers" USING "btree" ("email");



CREATE INDEX "idx_suppliers_name" ON "public"."suppliers" USING "btree" ("name");



CREATE INDEX "idx_suppliers_name_trgm" ON "public"."suppliers" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_suppliers_vat_number" ON "public"."suppliers" USING "btree" ("vat_number");



CREATE OR REPLACE TRIGGER "check_purchase_deletion_safety_trigger" BEFORE DELETE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."check_purchase_deletion_safety"();



CREATE OR REPLACE TRIGGER "ensure_delivery_quantity" BEFORE INSERT OR UPDATE ON "public"."delivery_note_items" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_quantity_from_pieces"();



CREATE OR REPLACE TRIGGER "ensure_purchase_quantity" BEFORE INSERT OR UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_quantity_from_pieces"();



CREATE OR REPLACE TRIGGER "on_delivery_note_delete" BEFORE DELETE ON "public"."delivery_notes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_delivery_note_deletion"();



CREATE OR REPLACE TRIGGER "on_delivery_note_item_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."delivery_note_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_movement_logic"();



CREATE OR REPLACE TRIGGER "on_purchase_item_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_purchase_item_change"();



CREATE OR REPLACE TRIGGER "on_worker_updated" BEFORE UPDATE ON "public"."workers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."delivery_note_items"
    ADD CONSTRAINT "delivery_note_items_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "public"."delivery_notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_note_items"
    ADD CONSTRAINT "delivery_note_items_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."delivery_note_items"
    ADD CONSTRAINT "delivery_note_items_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "public"."purchase_items"("id");



ALTER TABLE ONLY "public"."delivery_notes"
    ADD CONSTRAINT "delivery_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."delivery_notes"
    ADD CONSTRAINT "delivery_notes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."inventory_supplier_codes"
    ADD CONSTRAINT "inventory_supplier_codes_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_supplier_codes"
    ADD CONSTRAINT "inventory_supplier_codes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_inventory"
    ADD CONSTRAINT "job_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_inventory"
    ADD CONSTRAINT "job_inventory_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."movements"
    ADD CONSTRAINT "movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movements"
    ADD CONSTRAINT "movements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movements"
    ADD CONSTRAINT "movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete any profile" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "Authenticated users can create brands." ON "public"."brands" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create item_types." ON "public"."item_types" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create logs" ON "public"."job_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can create sites." ON "public"."sites" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can delete brands." ON "public"."brands" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete item_types." ON "public"."item_types" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update sites." ON "public"."sites" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can upload documents" ON "public"."job_documents" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "uploaded_by"));



CREATE POLICY "Brands are viewable by authenticated users." ON "public"."brands" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Clients delete by Admin only" ON "public"."clients" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = 'admin'::"text"));



CREATE POLICY "Clients insert by Admin/Operativo" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Clients update by Admin/Operativo" ON "public"."clients" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Clients viewable by all" ON "public"."clients" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Delivery note items delete by Admin only" ON "public"."delivery_note_items" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "Delivery note items insert by Admin/Operativo" ON "public"."delivery_note_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Delivery note items update by Admin/Operativo" ON "public"."delivery_note_items" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Delivery note items viewable by all" ON "public"."delivery_note_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Delivery notes delete by Admin only" ON "public"."delivery_notes" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "Delivery notes insert by Admin/Operativo" ON "public"."delivery_notes" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Delivery notes update by Admin/Operativo" ON "public"."delivery_notes" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Delivery notes viewable by all" ON "public"."delivery_notes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Documents are viewable by authenticated users." ON "public"."job_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Inventory delete by Admin only" ON "public"."inventory" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = 'admin'::"text"));



CREATE POLICY "Inventory insert by Admin/Operativo" ON "public"."inventory" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Inventory update by Admin/Operativo" ON "public"."inventory" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Inventory viewable by all" ON "public"."inventory" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Item Types are viewable by authenticated users." ON "public"."item_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Job Inventory delete by Admin/Operativo" ON "public"."job_inventory" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Job Inventory insert by Admin/Operativo" ON "public"."job_inventory" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Job Inventory update by Admin/Operativo" ON "public"."job_inventory" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Job Inventory viewable by all" ON "public"."job_inventory" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Jobs delete by Admin only" ON "public"."jobs" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = 'admin'::"text"));



CREATE POLICY "Jobs insert by Admin/Operativo" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Jobs update by Admin/Operativo" ON "public"."jobs" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Jobs viewable by all" ON "public"."jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Logs are viewable by authenticated users." ON "public"."job_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Movements insert by Admin/Operativo" ON "public"."movements" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Movements viewable by all" ON "public"."movements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Only Admins can delete workers." ON "public"."workers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Operativo and Admin can create workers." ON "public"."workers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'operativo'::"text"]))))));



CREATE POLICY "Operativo and Admin can update workers." ON "public"."workers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'operativo'::"text"]))))));



CREATE POLICY "Profiles viewable by all" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Purchase items delete by Admin only" ON "public"."purchase_items" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "Purchase items insert by Admin/Operativo" ON "public"."purchase_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Purchase items update by Admin/Operativo" ON "public"."purchase_items" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Purchase items viewable by all" ON "public"."purchase_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Purchases delete by Admin only" ON "public"."purchases" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "Purchases insert by Admin/Operativo" ON "public"."purchases" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Purchases update by Admin/Operativo" ON "public"."purchases" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Purchases viewable by all" ON "public"."purchases" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Sites are viewable by authenticated users." ON "public"."sites" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Supplier codes delete by Admin/Operativo" ON "public"."inventory_supplier_codes" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Supplier codes insert by Admin/Operativo" ON "public"."inventory_supplier_codes" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Supplier codes update by Admin/Operativo" ON "public"."inventory_supplier_codes" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Supplier codes viewable by all" ON "public"."inventory_supplier_codes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Suppliers delete by Admin only" ON "public"."suppliers" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = 'admin'::"text"));



CREATE POLICY "Suppliers insert by Admin/Operativo" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Suppliers update by Admin/Operativo" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"text", 'operativo'::"text"])));



CREATE POLICY "Suppliers viewable by all" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Units are deletable by authenticated users." ON "public"."units" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Units are insertable by authenticated users." ON "public"."units" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Units are viewable by authenticated users." ON "public"."units" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users and Admins can update profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR ("public"."get_my_role"() = 'admin'::"text")));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Workers are viewable by authenticated users." ON "public"."workers" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_note_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_supplier_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


























































































































































































































































































GRANT ALL ON FUNCTION "public"."calculate_quantity_from_pieces"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_quantity_from_pieces"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_quantity_from_pieces"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_purchase_deletion_safety"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_purchase_deletion_safety"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_purchase_deletion_safety"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_job_total_cost"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_job_total_cost"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_job_total_cost"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_low_stock_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_low_stock_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_low_stock_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_article_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_article_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_article_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_delivery_note_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_delivery_note_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_delivery_note_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_delivery_note_item_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_delivery_note_item_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_delivery_note_item_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_movement_logic"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_movement_logic"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_movement_logic"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_purchase_item_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_purchase_item_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_purchase_item_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_inventory_item"("target_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_inventory_item"("target_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_inventory_item"("target_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "text") TO "service_role";
























GRANT ALL ON SEQUENCE "public"."article_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."article_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."article_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_note_items" TO "anon";
GRANT ALL ON TABLE "public"."delivery_note_items" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_note_items" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_notes" TO "anon";
GRANT ALL ON TABLE "public"."delivery_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_notes" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_supplier_codes" TO "anon";
GRANT ALL ON TABLE "public"."inventory_supplier_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_supplier_codes" TO "service_role";



GRANT ALL ON TABLE "public"."item_types" TO "anon";
GRANT ALL ON TABLE "public"."item_types" TO "authenticated";
GRANT ALL ON TABLE "public"."item_types" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON TABLE "public"."job_batch_availability" TO "anon";
GRANT ALL ON TABLE "public"."job_batch_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."job_batch_availability" TO "service_role";



GRANT ALL ON TABLE "public"."job_documents" TO "anon";
GRANT ALL ON TABLE "public"."job_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."job_documents" TO "service_role";



GRANT ALL ON TABLE "public"."job_inventory" TO "anon";
GRANT ALL ON TABLE "public"."job_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."job_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."job_logs" TO "anon";
GRANT ALL ON TABLE "public"."job_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_logs" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."movements" TO "anon";
GRANT ALL ON TABLE "public"."movements" TO "authenticated";
GRANT ALL ON TABLE "public"."movements" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_batch_availability" TO "anon";
GRANT ALL ON TABLE "public"."purchase_batch_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_batch_availability" TO "service_role";



GRANT ALL ON TABLE "public"."sites" TO "anon";
GRANT ALL ON TABLE "public"."sites" TO "authenticated";
GRANT ALL ON TABLE "public"."sites" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements_view" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements_view" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements_view" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."workers" TO "anon";
GRANT ALL ON TABLE "public"."workers" TO "authenticated";
GRANT ALL ON TABLE "public"."workers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































