-- Visibility flags for shared-billing supplier groups:
-- - visible_in_purchases: when false (default), the billing supplier is only
--   meant to be used when registering invoices, and should be hidden from
--   the supplier dropdown in orders/purchases forms.
-- - show_members_in_invoices: when false, selecting the billing supplier on
--   an invoice only shows its own purchases (no aggregation across members).
ALTER TABLE supplier_groups ADD COLUMN IF NOT EXISTS visible_in_purchases BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE supplier_groups ADD COLUMN IF NOT EXISTS show_members_in_invoices BOOLEAN NOT NULL DEFAULT true;
