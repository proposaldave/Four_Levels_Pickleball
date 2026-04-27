# Personality Quiz — Data Layer

This folder is the data plumbing for `https://4dpickleball.com/personality`.

## What's in here

| File | What it is |
|---|---|
| `apps_script_backend.gs` | Google Apps Script Web App. Receives quiz POSTs and appends rows to a Google Sheet. ~5min to deploy. |
| `player_personality_data.csv` | Schema reference + seed data. One row per player. The Sheet (above) writes the same shape. |

## Architecture

```
   Player on phone/desktop
   ↓ takes quiz
   4dpickleball.com/personality  (static HTML, served from this repo)
   ↓ POST JSON  (mode: no-cors)
   Google Apps Script Web App
   ↓ appendRow()
   Google Sheet "Pickleball Personality Quiz Responses"
   ↓ Download as .xlsx anytime
   GnT player DB join (on email)
```

**Why Google Sheets and not a real backend (yet):**
- Zero ongoing cost
- Zero infrastructure to maintain
- Krista/Dave can sort, filter, and add `operator_notes` directly in the Sheet
- xlsx export ships in one click
- When Steve is ready to wire the Laravel backend, the schema is already proven and the migration is one ETL job

## To deploy the live data feed (one-time, ~5 min)

See `apps_script_backend.gs` — full step-by-step is in the file header.

Short version:
1. New Google Sheet → tab named `responses` → file named `Pickleball Personality Quiz Responses`
2. Extensions → Apps Script → paste `apps_script_backend.gs` → Save
3. Deploy → New deployment → Web app → Anyone → Deploy → copy URL
4. In `personality/index.html`, find `SUBMIT_URL` constant → paste URL between the quotes → commit + push

Until step 4 is done, the quiz still works — submissions save to the user's localStorage and they can download their own results as CSV. No data is lost.

## The schema

39 columns. Each quiz completion = one row.

### Identity
- `timestamp` — ISO 8601, when the row was written
- `source` — `web_quiz` | `operator_tag` | `import`
- `data_source` — same as source for now (kept for future provenance work)
- `name`, `email` — from the capture form
- `member` — `rye` | `middleton` | `other` | `none`
- `self_rating` — float 2.0–5.5 from the slider

### Archetype + tier (player-facing label, operator-side tier)
- `archetype_code` — two-letter code from `ARCHETYPES` in the HTML (e.g. `AN` = The Anchor)
- `archetype_name` — human-readable
- `style_flavor` — `Power` | `Mixer` | `Touch`
- `tier_internal` — `energizer` | `amplifier` | `player` (NEVER show this to the player)

### 5-axis personality vector
Each is a float in roughly -2.0 to +2.0 (averaged across questions that touch the axis).

| Column | -2 | 0 | +2 |
|---|---|---|---|
| `vibes_score` | Watcher | Steady | Bringer |
| `style_score` | Pure power | Mixer | Pure touch |
| `mode_score` | Lethal competitor | Balanced | Festival-goer |
| `warmth_score` | Stone-faced | Light | Beaming |
| `dialdown_score` | No mercy vs lower-level | Adaptive | Reads room, dials in |

### Triggers (binary 0/1)
What ruins this player's fun on a court. Multi-select on the quiz.
- `trig_hard_hitters`, `trig_lobbers`, `trig_no_dial_down`, `trig_never_smiles`
- `trig_mid_game_coaches`, `trig_sandbaggers`, `trig_line_disputes`
- `trig_silent_partners`, `trig_hot_heads`, `trig_trash_talkers`, `trig_slow_players`

### Event-type enjoyment (-2..+2 or null)
Self-reported preference across the NEPC event taxonomy. `null` = "never tried."
- `event_pref_give_n_take` — Give 'n Take (invitation-based, mixed-skill social)
- `event_pref_adult_social` — Adult Social (big mixed-level events)
- `event_pref_blue_square` — Blue Square (intermediate-advanced competitive)
- `event_pref_green_circle` — Green Circle (beginner-intermediate)
- `event_pref_round_robin` — Round Robin
- `event_pref_doubles_open` — Doubles Open Play (scramble)
- `event_pref_clinic` — Adult Clinic
- `event_pref_pro_plus_3` — Pro + 3
- `event_pref_tournament` — Tournament / Ladder

### Free text + meta
- `why_text` — optional one-sentence "why do you play"
- `duration_sec` — how long they took
- `operator_notes` — for Krista/Dave to add observations after the fact (Sheet-edited)
- `raw_answers` — JSON dump of all question selections (debug/audit)
- `raw_events` — JSON dump of event preferences

## Operator-tagged rows

Some rows are written before the player has taken the quiz. Dave or Krista observe a player and tag them based on operator judgment. These rows have `data_source = "operator_tag"`. When the player later takes the quiz, the new row is added — the operator-tag row stays for diff/training data.

Sanjay Rustogi is the seed example. See `player_personality_data.csv`.

## Joining to the GnT player DB

`email` is the join key (matches the Players table). For pre-quiz operator-tag rows, you'll need to hand-confirm matches since name spelling can drift.

## What Steve will probably want next

1. Move the Sheet to a Postgres `player_personality` table in the GnT v2 schema, with a foreign key to `players.id`.
2. Write a nightly ETL that pulls the Sheet → upserts into `player_personality` (since the Sheet is the live form-of-truth until cutover).
3. Expose `personality_vector` and `event_preferences` on the Player API so the matchmaking engine can use them.
4. Add a "retake quiz" link in the player profile that pre-fills email so re-taking doesn't create dupes.

The data is already shaped to land cleanly into a relational schema — every column is a primitive. No nested JSON except the two `raw_*` audit columns.
