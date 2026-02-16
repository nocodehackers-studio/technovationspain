-- ============================================================
-- 006: Storage Policies (consolidated)
-- Bucket creation + 4 policies on storage.objects for 'Assets'
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('Assets', 'Assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update event images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete event images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Anyone can view assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'Assets');
