-- Add indexes for clients search
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients USING btree (name);
CREATE INDEX IF NOT EXISTS idx_clients_vat_number ON public.clients USING btree (vat_number);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients USING btree (email);
CREATE INDEX IF NOT EXISTS idx_clients_address ON public.clients USING btree (address);

-- Add indexes for suppliers search
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers USING btree (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_vat_number ON public.suppliers USING btree (vat_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON public.suppliers USING btree (email);

-- Add indexes for jobs search (often joined or filtered)
CREATE INDEX IF NOT EXISTS idx_jobs_code ON public.jobs USING btree (code);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_description ON public.jobs USING btree (description);

-- Add indexes for delivery notes search
CREATE INDEX IF NOT EXISTS idx_delivery_notes_number ON public.delivery_notes USING btree (number);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_causal ON public.delivery_notes USING btree (causal);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_job_id ON public.delivery_notes USING btree (job_id);

-- Add indexes for purchases search
CREATE INDEX IF NOT EXISTS idx_purchases_delivery_note_number ON public.purchases USING btree (delivery_note_number);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases USING btree (supplier_id);

-- Add indexes for Inventory search and sort
CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory USING btree (name);
CREATE INDEX IF NOT EXISTS idx_inventory_code ON public.inventory USING btree (code);
CREATE INDEX IF NOT EXISTS idx_inventory_brand ON public.inventory USING btree (brand);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory USING btree (category);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_code ON public.inventory USING btree (supplier_code);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON public.inventory USING btree (created_at DESC);

-- Add indexes for Movements (often filtered by date, type, item)
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.movements USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON public.movements USING btree (type);
CREATE INDEX IF NOT EXISTS idx_movements_item_id ON public.movements USING btree (item_id);
CREATE INDEX IF NOT EXISTS idx_movements_job_id ON public.movements USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_movements_user_id ON public.movements USING btree (user_id);

-- Add indexes for Delivery Note Items (FKs)
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON public.delivery_note_items USING btree (delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_inventory_id ON public.delivery_note_items USING btree (inventory_id);

-- Add indexes for Purchase Items (FKs)
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items USING btree (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON public.purchase_items USING btree (item_id);
