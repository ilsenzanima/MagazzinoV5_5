-- Create delivery_notes table
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('entry', 'exit', 'sale')),
  number TEXT NOT NULL,
  date DATE NOT NULL,
  job_id UUID REFERENCES public.jobs(id),
  causal TEXT,
  pickup_location TEXT,
  delivery_location TEXT,
  transport_mean TEXT,
  appearance TEXT,
  packages_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create delivery_note_items table
CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE NOT NULL,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE RESTRICT NOT NULL,
  quantity NUMERIC(10, 5) NOT NULL CHECK (quantity > 0),
  price NUMERIC(10, 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;

-- Policies for delivery_notes
CREATE POLICY "Delivery notes are viewable by authenticated users."
  ON public.delivery_notes FOR SELECT
  TO authenticated
  USING ( true );

CREATE POLICY "Authenticated users can create delivery notes."
  ON public.delivery_notes FOR INSERT
  TO authenticated
  WITH CHECK ( true );

CREATE POLICY "Authenticated users can update delivery notes."
  ON public.delivery_notes FOR UPDATE
  TO authenticated
  USING ( true );

CREATE POLICY "Authenticated users can delete delivery notes."
  ON public.delivery_notes FOR DELETE
  TO authenticated
  USING ( true );

-- Policies for delivery_note_items
CREATE POLICY "Delivery note items are viewable by authenticated users."
  ON public.delivery_note_items FOR SELECT
  TO authenticated
  USING ( true );

CREATE POLICY "Authenticated users can create delivery note items."
  ON public.delivery_note_items FOR INSERT
  TO authenticated
  WITH CHECK ( true );

CREATE POLICY "Authenticated users can update delivery note items."
  ON public.delivery_note_items FOR UPDATE
  TO authenticated
  USING ( true );

CREATE POLICY "Authenticated users can delete delivery note items."
  ON public.delivery_note_items FOR DELETE
  TO authenticated
  USING ( true );

-- Function to update inventory quantity on movement
CREATE OR REPLACE FUNCTION public.handle_delivery_note_item_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_delivery_note_item_change();
