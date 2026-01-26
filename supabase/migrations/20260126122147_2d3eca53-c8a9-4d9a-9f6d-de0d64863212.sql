-- Tabla para plantillas de email personalizables por evento
CREATE TABLE public.event_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('confirmation', 'reminder')),
  subject text NOT NULL DEFAULT '',
  body_content text NOT NULL DEFAULT '',
  reply_to_email text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(event_id, template_type)
);

-- Tabla para historial y programación de envíos
CREATE TABLE public.event_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  template_type text NOT NULL,
  subject text NOT NULL,
  body_content text,
  recipients_count integer DEFAULT 0,
  target_audience text DEFAULT 'all_confirmed' CHECK (target_audience IN ('all_confirmed', 'ticket_type', 'custom')),
  target_ticket_type_id uuid REFERENCES public.event_ticket_types(id) ON DELETE SET NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamp with time zone,
  sent_at timestamp with time zone,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.event_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_email_sends ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Solo administradores
CREATE POLICY "Admins can manage email templates"
ON public.event_email_templates FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage email sends"
ON public.event_email_sends FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger para actualizar updated_at en templates
CREATE TRIGGER update_event_email_templates_updated_at
BEFORE UPDATE ON public.event_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejorar rendimiento
CREATE INDEX idx_event_email_templates_event_id ON public.event_email_templates(event_id);
CREATE INDEX idx_event_email_sends_event_id ON public.event_email_sends(event_id);
CREATE INDEX idx_event_email_sends_status ON public.event_email_sends(status);
CREATE INDEX idx_event_email_sends_scheduled_for ON public.event_email_sends(scheduled_for) WHERE status = 'scheduled';