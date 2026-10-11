# Local sound effects

The user supplied `mixkit-level-increased-2062.wav` (Mixkit item 2062).
Its duration is 3.098 seconds. The individual creator is not identified by the
source listing; Mixkit is recorded as publisher, without inventing an author.

License: https://mixkit.co/license/modal/sfxFree/ (checked 2026-10-11).
Use is permitted within games, but not standalone redistribution or distribution
with source files. Mixkit binaries are excluded from Git; provide this file
locally before building the end product. Do not publish them as an asset library.

Add other user-supplied sounds only with complete source and license records in
`src/lib/sound-effects.ts`, then regenerate `public/audio/CREDITS.md`.
UI, interaction, player and message effects retain synthesized fallbacks until
licensed replacements are supplied. Files are cached when first used.
