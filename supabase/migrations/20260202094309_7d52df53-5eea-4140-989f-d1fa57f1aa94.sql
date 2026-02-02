-- Insert all development tickets
INSERT INTO public.development_tickets (title, description, priority, status) VALUES
-- Dashboard
('Links de progreso de registro no funcionan', 'Faltaría el link de equipos en los indicadores de progreso del dashboard', 'mandatory', 'pending'),
('Gráficas no responsivas', 'Al cambiar el tamaño de la pantalla, los gráficos no quedan bien. Lo mismo ocurre en la sección de reportes', 'mandatory', 'pending'),
('Distribución por rol y verificación poco informativa', 'La gráfica de distribución por rol y estado de verificación no aporta mucha información útil', 'nice_to_have', 'pending'),
('Eventos próximos con enlaces', 'Los eventos próximos deberían ser links que lleven a cada uno de los eventos', 'nice_to_have', 'pending'),

-- Usuarios
('Funcionalidad de crear usuario', '¿Cuál es la funcionalidad asociada a crear usuario? ¿Se puede pinchar en un usuario y enviar un magic link?', 'nice_to_have', 'pending'),
('Sistema de roles incompleto', 'No debería haber usuarios verificados sin rol. El rol de admin no debería estar al nivel de participante/mentor/juez porque alguien podría ser mentor + admin. ¿Falta el rol de Chapter Ambassador?', 'mandatory', 'pending'),
('Vinculación a equipos incorrecta', 'No debería poder vincular manualmente a equipo, debería salir el equipo de la tabla importada. Sí debería poder vincular a hub.', 'mandatory', 'pending'),
('Restricción de eliminación de usuarios', 'Eliminar sólo debería poder eliminar usuarios sin verificar. No se deben eliminar usuarios que estén en la tabla de autorizados.', 'mandatory', 'pending'),
('Vista de usuarios sin registrar', 'Crear una vista nueva para ver todos los importados en el CSV que no están vinculados a la plataforma (matched_profile_id = null)', 'mandatory', 'pending'),

-- Equipos
('Bloquear creación de equipos', 'No se deberían poder crear equipos manualmente, solo importar desde CSV', 'mandatory', 'pending'),
('Proteger campos importados de equipos', 'Los equipos deberían ser los importados desde el CSV. No debería poder modificar los campos importados, aunque sí puede que no se visualicen todos', 'mandatory', 'pending'),
('Filtrado avanzado en equipos', 'Añadir filtrado por campos como Ciudad o % completado. También añadir un campo de comentarios', 'mandatory', 'pending'),

-- Hubs
('Modificar campos de Hubs', 'Eliminar el campo Organización. Añadir un campo de Notas', 'mandatory', 'pending'),

-- Eventos
('Conteo de entradas con acompañantes', 'Clarificar cuánto suman las entradas con acompañante en el aforo total', 'mandatory', 'pending'),
('Journey del voluntario', 'Definir el journey completo del voluntario: lista de rol voluntario que se asocian a eventos y que tiene la visión de validador de QR. No necesario para este evento pero importante para versión final.', 'nice_to_have', 'pending'),
('Sistema de confirmación y lista de espera', '¿Cómo se confirma la entrada? ¿Cómo funciona la lista de espera?', 'nice_to_have', 'pending');