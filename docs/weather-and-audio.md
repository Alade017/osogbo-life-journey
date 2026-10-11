# Osogbo weather and audio

The shared strip requests Open-Meteo current model conditions at Osogbo (7.7827 N, 4.5418 E). The display includes temperature, conditions, day/night, source attribution and the provider update time. It refreshes every 15 minutes while mounted; requests time out after 10 seconds. An unavailable feed shows a retry action. A retained reading older than an hour is marked as delayed, rather than presented as current.

The HUD and phone display Osogbo time in WAT (UTC+1). `Africa/Lagos` remains the IANA timezone identifier for Nigerian civil time, including Osogbo. Provider timestamps are requested in UTC and converted for display. The separate personal simulation clock and authoritative world rules remain in their existing services.

Open-Meteo provides model estimates rather than a local weather-station observation. The live display does not change the deterministic weather used by travel, city events and NPC routines. The free API is intended for noncommercial use; review its current service terms and provision a suitable weather plan before commercial operation: https://open-meteo.com/en/terms and https://open-meteo.com/en/pricing.

The menu and audio settings link to the official Top 50 - Nigeria playlist in a new browser tab. Spotify login and playback happen in Spotify; no Spotify token, account credentials, iframe, SDK or audio stream is stored or loaded by the game. This does not connect a Spotify account to OSOGBO LIFE. Spotify's game-content restrictions require written approval for integrating its content into game functionality: https://developer.spotify.com/documentation/embeds/terms.

Original synthesized ambience and sound controls continue to work. Any additional music files must be licensed for use in the game before inclusion.
