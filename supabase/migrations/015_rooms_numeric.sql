-- rooms supports half-rooms (e.g. 4.5) — the UI uses step="0.5".
-- Widening integer→numeric is non-destructive. After applying (supabase db push),
-- change Onboarding.tsx to parseFloat(rooms) so half-rooms persist.
ALTER TABLE properties ALTER COLUMN rooms TYPE numeric USING rooms::numeric;
