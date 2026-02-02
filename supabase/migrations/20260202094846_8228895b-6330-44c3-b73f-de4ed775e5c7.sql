-- Mark ticket as completed
UPDATE public.development_tickets
SET status = 'completed'
WHERE title = 'Vinculación a equipos incorrecta';