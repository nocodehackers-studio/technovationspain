-- Create enum for ticket priority
CREATE TYPE public.ticket_priority AS ENUM ('nice_to_have', 'mandatory');

-- Create enum for ticket status
CREATE TYPE public.ticket_status AS ENUM ('pending', 'in_progress', 'completed');

-- Create development tickets table
CREATE TABLE public.development_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority ticket_priority NOT NULL DEFAULT 'nice_to_have',
  status ticket_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_tickets ENABLE ROW LEVEL SECURITY;

-- Only admins can manage tickets
CREATE POLICY "Admins can manage development tickets"
ON public.development_tickets
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_development_tickets_updated_at
BEFORE UPDATE ON public.development_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();