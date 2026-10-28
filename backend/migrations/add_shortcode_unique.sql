-- Migration: Add shortcode column with UNIQUE constraint to public.events
-- Note: public.events already has a `post_url` (TEXT UNIQUE) column.
-- Run this in the Supabase SQL Editor if you also want a dedicated `shortcode` column:

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS shortcode TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'events_shortcode_key'
          AND conrelid = 'public.events'::regclass
    ) THEN
        ALTER TABLE public.events
        ADD CONSTRAINT events_shortcode_key UNIQUE (shortcode);
    END IF;
END
$$;

-- Backfill shortcode from existing post_url values where present
UPDATE public.events
SET shortcode = substring(post_url FROM 'instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)')
WHERE shortcode IS NULL
  AND post_url IS NOT NULL;
