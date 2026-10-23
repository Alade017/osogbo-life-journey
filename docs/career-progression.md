# Career progression

Career progression extends the existing Jobs page. Regular jobs and their existing pay logic remain unchanged. Persistent career tracks are Banking & Finance (Cedar Bank and Meridian Bank) and Retail & Mall Operations (Osun Mall).

## Ranks and pay

| Track | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Banking | Banking Assistant · ₦3,500 | Customer Service Officer · ₦5,000 | Branch Supervisor · ₦7,000 |
| Retail | Sales Assistant · ₦3,000 | Senior Sales Associate · ₦4,500 | Store Supervisor · ₦6,500 |

These are fictional in-game amounts per completed shift. Promotion thresholds are five completed shifts for level 2 and fifteen for level 3. Thresholds are absolute completed-shift counts.

## Flow

1. Travel to an approved venue and apply to one active career.
2. Start a shift at a venue approved for the selected track.
3. Complete three server-validated steps in order.
4. The final step atomically marks the session complete, credits the wallet through the existing _credit function, adds XP, updates performance and mood, and recalculates missions.
5. Promote only when both completed-shift and performance thresholds are met.

## Server guarantees

Career mutations are authenticated PostgreSQL RPCs. Requests are idempotent by character/request UUID. The server checks character ownership, active application, venue, session state, ordered step number and promotion requirements. Money is never credited by client code. Career mood reuses the party-life apply_party_mood function, whose score is clamped to 0–100.

## Integration

The /career screen complements /jobs; it does not replace jobs, character_jobs, perform_job, or their existing shift rewards. Cedar Bank, Meridian Bank and Osun Mall reuse existing map locations.
