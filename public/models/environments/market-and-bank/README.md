# Market and bank environments (restyled for OSUN LIFE)

Source: 3dassets.dev models supplied by the project owner. The catalogue lists these as CC0 1.0 Universal (`licenses/CC0-1.0.txt`), so no attribution is required. Confirm each file's licence on its source page before publishing.

Each file is one whole environment or unit, in metres, Y-up, with materials recoloured to the OSUN LIFE palette in `src/components/3d/world-theme.ts`. All files are meshopt-compressed; load them with `MeshoptDecoder`.

- `bank-vault-hall.glb`: bank hall with vault and tunnel, 10 × 5.65 × 16.5 m.
- `fish-market-bay.glb`: fish market bay with roller shutter. Contains `open` and `close` animations on the shutter.
- `seafood-market-stall.glb`: seafood market stall, 6.54 × 3.36 × 5.1 m.
- `street-food-market-yard.glb`: street food market yard, 24.3 × 3.97 × 28 m. Has one WebP texture.
- `atm-kiosk.glb`: ATM kiosk, 0.85 × 1.7 × 0.85 m. Its root node is named `atm`, which the bank lobby uses as a clickable target.
- `fish-market-harbour-quay.glb`: fish market and trawler quay, 49.8 × 9 × 39 m. About 1.1 MB, so load it only when a visitor enters the quay.
