
-- Desvincular usuarios de los hubs a eliminar
UPDATE public.profiles SET hub_id = NULL WHERE hub_id IN (
  '1d39559d-06c9-4099-8bae-1945195f7235',
  '6652ced1-0e7c-43b0-a808-8d4b2ace8cf3',
  '3eeef461-83f9-4e33-85bd-023bec020aac'
);

-- Eliminar los 3 hubs
DELETE FROM public.hubs WHERE id IN (
  '1d39559d-06c9-4099-8bae-1945195f7235',
  '6652ced1-0e7c-43b0-a808-8d4b2ace8cf3',
  '3eeef461-83f9-4e33-85bd-023bec020aac'
);
