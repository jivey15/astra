# Astra (`project-loring`) — Autonomous Engineering Guide (`AGENTS.md`)

You are the lead autonomous engineer for **Astra**, a Minneapolis nightlife telemetry platform combining an automated Instagram flyer scraping + AI extraction backend with an Expo / React Native mobile & web client.

---

## 1. System Architecture

### Backend Scraper Pipeline (`backend/sync_events.py` & `.github/workflows/sync_events.yml`)
- **Schedule & Trigger**: Runs daily at `09:30 UTC` (`04:30 AM CT`) via GitHub Actions (`.github/workflows/sync_events.yml`) or manually via `workflow_dispatch` / local CLI (`python backend/sync_events.py`).
- **Source Discovery**: Queries `public.sources?is_active=eq.true` in Supabase for active Minneapolis venue Instagram handles. Inactive or retired handles (`the19bar`, `flipphonempls`, `flipphoneevents`) are kept `is_active = false` and excluded from scraping.
- **Scraping & Pin Filtering**: Calls Apify (`apify~instagram-profile-scraper`) to fetch recent posts per venue. Evaluates `is_older_pinned_post()` **before** any database check or Gemini API call so pinned posts from the past never trigger premature watermark exits.
- **21+ Age-Gate Bypass (Web Calendar Fallback + Optional `IG_SESSION_ID`)**:
  - **Authenticated Cookie Support**: Checks for an optional `IG_SESSION_ID` environment variable (configured in `.github/workflows/sync_events.yml` via `secrets.IG_SESSION_ID`) and passes it via `loginCookies` to `apify~instagram-profile-scraper` so age-gated 21+ profiles (including `@jetsetbarmpls`, `@lush.mpls`, and `@blackhartstp`) return full post lists when provided.
  - **Web Calendar Fallback (`scrape_venue_website_fallback`)**: Whenever **LUSH Lounge & Theater** (`lush.mpls`, `https://lushmpls.com/events`) or **Black Hart of Saint Paul** (`blackhartstp`, `https://www.blackhartstp.com/events`) returns `0` Instagram posts due to 21+ age-gating, the pipeline automatically fetches their public events webpage, extracts upcoming events via Gemini 3.8 Flash (`WebCalendarExtractionSchema`), computes a deterministic watermark `shortcode` (`web_<10-char md5>`), and inserts into `public.events` with `is_approved = false`.
- **Pre-Gemini Watermark Check**: Checks `post_exists_in_supabase(shortcode, post_url)` before downloading images or calling Gemini. When an unpinned post already exists in `public.events`, the scraper breaks out of that venue's loop immediately to conserve Gemini API credits.
- **Gemini Structured Extraction**: Uses `google-genai` (`gemini-3.8-flash`) with `FlyerExtractionSchema` to extract normalized `YYYY-MM-DD` dates, 24-hour `HH:MM:SS` start times, performers, vibe tags, and punchy 2–3 sentence nightlife-native descriptions.
- **Storage & Database Sync**: Uploads flyer images to the public Supabase Storage `flyers` bucket and inserts events one-by-one into `public.events`.

### Frontend Mobile & Web App (`app/src/app/index.tsx`, `app/app.js`, & `app/src/components/`)
- **Entry Points & Core Modules**:
  - `app/src/app/index.tsx`: Primary Expo Router screen driving the Live Feed, Constellation Map View (`app/src/components/map-view-placeholder.tsx`), and Saved Bookmarks tabs.
  - `app/app.js`: Root JavaScript mirror of the feed logic. **Always keep `app/src/app/index.tsx` and `app/app.js` synchronized** when updating event fetching, partitioning, category filtering, or feed layout.
  - `app/src/components/event-card.tsx`: Reusable HUD `EventCard` supporting `'carousel'`, `'grid'`, and `'full'` variants plus the full-flyer detail modal, native `Orbit` sharing (`Share.share()`), and `"View Source / Tickets ↗"` external linking (`Linking.openURL()`).
  - `app/src/utils/bookmarks-and-notifications.ts`: Local bookmark storage (`@react-native-async-storage/async-storage` + web `localStorage` fallback) and 4-hour prior local push notification scheduling (`expo-notifications`).
  - `app/src/components/constellation-header.tsx` & `app/src/constants/constellations.ts`: Interactive zodiac constellation header with dynamic astrological sign/Bayer star calculation, `{N} SIGNALS LOCKED` readout, and the pressable **`FULL ORBIT`** / **`TONIGHT'S ORBIT`** feed filter toggle.
  - `app/src/components/map-view-placeholder.tsx`: Interactive **Minneapolis–St. Paul Constellation Map** plotting Twin Cities venues (`The Saloon`, `The Eagle`, `LUSH`, `Jetset`, `Black Hart`, `The 19 Bar`, `Stonewall Sports`) with real lat/lng coordinates, glowing SVG/vector constellation lines, star badges with upcoming event counts, and an interactive venue bottom-sheet drawer.

---

## 2. Supabase Schema & Query Rules

- **`public.sources`**:
  - Columns: `id`, `name`, `ig_handle`, `city_code`, `is_active`.
  - Only `is_active = true` rows are scraped. `the19bar` and `flipphonempls` / `flipphoneevents` must stay `is_active = false`.
- **`public.events`**:
  - Core columns: `id`, `city_code` (`'MSP'`), `venue_name`, `title`, `event_date` (`YYYY-MM-DD`), `start_time` (`HH:MM:SS`), `cover_info`, `age_limit`, `vibe_tags` (`text[]`), `talent_names` (`text[]`), `short_summary`, `flyer_image_url`, `post_url` (`UNIQUE`), `shortcode` (`UNIQUE`), `is_approved` (`boolean`, defaults to `false`), `status`, `confidence_score`.
  - **Moderation Safety**: Backend inserts must omit `is_approved` from the payload so Postgres defaults new rows to `false` without resetting previously approved rows.
  - **14-Day Rolling Window Query**: Frontend fetches must filter `.eq('is_approved', true).gte('event_date', fourteenDaysAgo)` (where `fourteenDaysAgo` is the ISO date string `YYYY-MM-DD` for 14 days prior) so events older than two weeks automatically drop off the app.
  - **Data Partitioning & Smart Category Pills**:
    - Split fetched events into `upcomingEvents` (`event_date >= today`, sorted ascending by date) and `pastEvents` (`event_date < today`, sorted descending by date below `'Recent Signals'`).
    - Curated category pillars: `All Signals`, `DJs` (mapping `Circuit/DJ`, `DJ`, and `Dance`), `Drag/Show`, `Watch Party`, `Leather/Gear`, and `Community`.
    - Dynamically sort categories with `>= 1` event in the next 7 days (`today` through `today + 7 days`) immediately after `+ All Signals` at full brightness, and sort `0`-event categories to the right dimmed (`opacity: 0.38`).

---

## 3. Dark Telemetry UI Theme ("Astra / Loring Orbit")

- **Palette (`app/src/constants/theme.ts`)**:
  - Deep Cosmic Navy backgrounds: `#050B18` (top) -> `#0A1528` (bottom)
  - HUD Glass surfaces: `rgba(14, 30, 56, 0.78)` and `rgba(15, 23, 42, 0.95)`
  - Borders & Accents: `#1D4ED8` (default border), `#38BDF8` (glowing cyan active border), `#00F0FF` (neon cyan Tonight's Orbit active border), `#0EA5E9` (electric cyan primary fill), `#7DD3FC` (ice blue), `#93C5FD` (muted ice blue), `#FFFFFF` (star white)
- **Card & Modal Visual Standards (`app/src/components/event-card.tsx`)**:
  - **Flyer Hero Containers**: 35px taller heights (`381px` full, `267px` carousel, `245px` grid) with edge-to-edge flyer imagery.
  - **Bottom Linear Gradient Scrim**: Smooth two-stop linear gradient (`transparent` to `rgba(15, 23, 42, 0.95)`) behind overlay text with no harsh middle stop lines, blending seamlessly into the card body (`rgba(15, 23, 42, 0.95)`).
  - **Detail Modal Flyer & Source Link**: Full width (`width: '100%'`) adjusting dynamically to the flyer image's natural aspect ratio (`Image.getSize` / `onLoad`), accompanied by the `"View Source / Tickets ↗"` button (`Linking.openURL`).
  - **Recent Signals Styling**: Past event cards (`pastEvents`) render below the `'Recent Signals'` divider with `opacity: 0.55` and a subtle grayscale filter (`filter: 'grayscale(40%)'`) so they visually recede behind active upcoming events.

---

## 4. Standing Autonomous Engineering Instructions

1. **Always Verify Syntax & Types**:
   - Python backend: Run `python -m py_compile backend/sync_events.py` after any backend edit.
   - Expo / TypeScript frontend: Run `npx tsc --noEmit` (and `npx expo lint` where applicable) in `app/` before declaring any frontend task done.
2. **Always Test Scripts Locally**:
   - Execute verification one-liners or dry-run tests locally using `.env` credentials to confirm database state, API payloads, and date/partitioning logic.
3. **Automatically Commit & Push Backend Fixes**:
   - Whenever backend scripts, migrations, workflows, or repository configurations are created or updated, automatically stage, commit with a clear message, and push to `origin/main`.
4. **Expo & React Native Best Practices**:
   - Read the major `expo` version in `app/package.json` before touching Expo APIs and consult `https://docs.expo.dev/llms.txt` when needed.
   - Use `npx expo install <package>` when adding Expo dependencies.
   - Keep route files in `app/src/app/` and shared components in `app/src/components/`.
