-- SQL Migration: Fix outdated/non-existent Instagram handles in public.sources

-- 1. Flip Phone Minneapolis: Deactivate flipphonempls / flipphoneevents from active scraping
UPDATE public.sources
SET is_active = false
WHERE ig_handle IN ('flipphonempls', 'flipphoneevents')
   OR name ILIKE '%Flip Phone%';

-- 2. The 19 Bar: 'the19bar' does not exist on Instagram (The 19 Bar does not maintain an official Instagram account).
-- Deactivate it from Instagram scraping so Apify does not waste credits on a 404 handle:
UPDATE public.sources
SET is_active = false
WHERE ig_handle = 'the19bar'
   OR name ILIKE '%The 19 Bar%';

-- 3. Verify that the remaining active handles match their official Instagram accounts:
-- The Black Hart of Saint Paul -> 'blackhartstp' (valid handle, 21+ age-gated on unauthenticated Instagram web)
UPDATE public.sources
SET ig_handle = 'blackhartstp'
WHERE name ILIKE '%Black Hart%';

-- Jetset Underground -> 'jetsetbarmpls' (valid handle, 21+ age-gated on unauthenticated Instagram web)
UPDATE public.sources
SET ig_handle = 'jetsetbarmpls'
WHERE name ILIKE '%Jetset%';

-- LUSH Lounge & Theater -> 'lush.mpls' (valid handle, 21+ age-gated on unauthenticated Instagram web)
UPDATE public.sources
SET ig_handle = 'lush.mpls'
WHERE name ILIKE '%LUSH%';
