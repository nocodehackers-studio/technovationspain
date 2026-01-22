-- Add custom_fields JSONB column to profiles for storing dynamic user data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Create table for storing custom column definitions
CREATE TABLE public.table_custom_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  column_key TEXT NOT NULL,
  column_label TEXT NOT NULL,
  column_type TEXT DEFAULT 'text',
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_name, column_key)
);

-- Enable RLS
ALTER TABLE public.table_custom_columns ENABLE ROW LEVEL SECURITY;

-- Only admins can manage custom columns
CREATE POLICY "Admins can manage custom columns"
ON public.table_custom_columns
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for admin table preferences (column visibility, order, filters)
CREATE TABLE public.admin_table_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  table_name TEXT NOT NULL,
  hidden_columns TEXT[] DEFAULT '{}',
  column_order TEXT[] DEFAULT '{}',
  saved_filters JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, table_name)
);

-- Enable RLS
ALTER TABLE public.admin_table_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own preferences
CREATE POLICY "Users can manage own table preferences"
ON public.admin_table_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_custom_columns_table_name ON public.table_custom_columns(table_name);
CREATE INDEX idx_table_preferences_user_table ON public.admin_table_preferences(user_id, table_name);