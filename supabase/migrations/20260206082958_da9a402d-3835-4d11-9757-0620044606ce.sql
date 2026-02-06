UPDATE event_email_templates 
SET body_content = 'Hola {nombre},

¡Tu inscripción al evento "{evento}" ha sido confirmada!

📅 Fecha: {fecha}
🕐 Horario: {hora}
📍 Lugar: {ubicacion}
   {direccion}, {ciudad}

Tu número de registro es: {numero_registro}

A continuación encontrarás tu entrada con el código QR que deberás presentar en la entrada del evento.

También puedes acceder a tu entrada en cualquier momento desde: {enlace_entrada}

¡Te esperamos!

Equipo de Technovation Girls España',
    updated_at = now()
WHERE id = '62ea69ea-f733-4092-8684-39cb8b630866'