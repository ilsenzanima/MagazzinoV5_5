-- Create a new bucket for images if it doesn't exist
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- Set up security policies for the 'images' bucket

-- Drop existing policies to avoid conflicts
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Authenticated users can update images" on storage.objects;
drop policy if exists "Authenticated users can delete images" on storage.objects;

-- Allow public read access to images
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'images' );

-- Allow authenticated users to upload images
create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check ( bucket_id = 'images' and auth.role() = 'authenticated' );

-- Allow authenticated users to update their own images (or all images for simplicity in this MVP)
create policy "Authenticated users can update images"
  on storage.objects for update
  using ( bucket_id = 'images' and auth.role() = 'authenticated' );

-- Allow authenticated users to delete images
create policy "Authenticated users can delete images"
  on storage.objects for delete
  using ( bucket_id = 'images' and auth.role() = 'authenticated' );

-- Create a sequence for article codes
CREATE SEQUENCE IF NOT EXISTS article_code_seq START 1;

-- Function to generate the next article code
CREATE OR REPLACE FUNCTION get_next_article_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_val integer;
  formatted_code text;
BEGIN
  -- Get the next value from the sequence
  next_val := nextval('article_code_seq');
  
  -- Format the code as ART-XXXXX (e.g., ART-00001)
  formatted_code := 'ART-' || lpad(next_val::text, 5, '0');
  
  RETURN formatted_code;
END;
$$;
