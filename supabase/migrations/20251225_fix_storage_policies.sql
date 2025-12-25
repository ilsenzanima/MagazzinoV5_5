-- FIX STORAGE POLICIES CONFLICTS (2025-12-25)
-- Consolidate storage policies to prevent naming conflicts

-- 1. Drop potentially conflicting policies (generic names)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- 2. Images Bucket Policies
-- Allow public read access to images
CREATE POLICY "images_select_policy"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'images' );

-- Allow authenticated users to upload images
CREATE POLICY "images_insert_policy"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'images' );

-- Allow authenticated users to update images
CREATE POLICY "images_update_policy"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING ( bucket_id = 'images' );

-- Allow authenticated users to delete images
CREATE POLICY "images_delete_policy"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'images' );

-- 3. Documents Bucket Policies
-- Allow authenticated users to read documents (documents are usually private/internal)
CREATE POLICY "documents_select_policy"
  ON storage.objects FOR SELECT
  TO authenticated
  USING ( bucket_id = 'documents' );

-- Allow authenticated users to upload documents
CREATE POLICY "documents_insert_policy"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'documents' );

-- Allow authenticated users to update documents
CREATE POLICY "documents_update_policy"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING ( bucket_id = 'documents' );

-- Allow authenticated users to delete documents
CREATE POLICY "documents_delete_policy"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'documents' );

-- 4. Job Documents Bucket Policies (if separate)
-- If job documents use the 'documents' bucket, the above policies cover it.
-- If there's a specific 'job_documents' bucket, we would add policies here.
-- Assuming 'documents' is the shared bucket for now as per previous migrations.
