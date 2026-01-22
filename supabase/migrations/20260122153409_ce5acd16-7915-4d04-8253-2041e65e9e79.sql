-- Asignar rol de admin a los usuarios creados
INSERT INTO public.user_roles (user_id, role) VALUES 
('45a2b12b-9263-4d28-93fa-c1e0ebc6c8f2', 'admin'),
('79c5f7b9-799c-4066-bd7e-90213a7c049c', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;