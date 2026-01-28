-- Update profile verification status to pending
UPDATE profiles SET verification_status = 'pending' WHERE id = 'ad9e1232-f346-460c-a091-7000a0b8404b';

-- Clear matched_profile_id so the trigger can work on re-registration
UPDATE authorized_users SET matched_profile_id = NULL WHERE email = 'rocpg@yahoo.es';