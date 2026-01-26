-- Políticas de storage para el bucket Assets
-- Permitir a admins subir imágenes de eventos
CREATE POLICY "Admins can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir a admins actualizar/reemplazar imágenes
CREATE POLICY "Admins can update event images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir a admins eliminar imágenes
CREATE POLICY "Admins can delete event images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- El bucket ya es público, pero aseguramos lectura pública
CREATE POLICY "Anyone can view assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'Assets');