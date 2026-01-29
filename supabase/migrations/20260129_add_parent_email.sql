-- Add parent_email column for minor users (under 14 at registration)
-- This email is used to route consent emails to parents/guardians

ALTER TABLE profiles
ADD COLUMN parent_email VARCHAR(255);

-- Add email format check constraint
ALTER TABLE profiles
ADD CONSTRAINT parent_email_format
CHECK (parent_email IS NULL OR parent_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add index for potential queries by parent email
CREATE INDEX idx_profiles_parent_email ON profiles(parent_email) WHERE parent_email IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN profiles.parent_email IS 'Email of parent/guardian for users who were under 14 at registration. Used for consent email routing.';
