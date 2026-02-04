-- Añadir columna DNI a la tabla profiles
ALTER TABLE profiles ADD COLUMN dni text;

COMMENT ON COLUMN profiles.dni IS 
  'DNI o NIE del usuario. Formato: 8 dígitos + letra (DNI) o X/Y/Z + 7 dígitos + letra (NIE)';