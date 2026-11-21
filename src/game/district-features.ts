/**
 * The planned features of each district that has no hand-made or town-map street. Each feature is
 * shown on that district's street as a labelled block. The text matches the database's
 * planned_features column; keep the two in step when a district's features change.
 */
export const DISTRICT_FEATURES: Readonly<Record<string, readonly string[]>> = {
  "cultural-district": ["Art gallery", "Festival", "Museum"],
  "osogbo-bank-district": ["banking", "finance careers"],
  "osogbo-high-court": ["court services", "legal careers"],
  "bola-ige-secretariat": ["public services", "civil service"],
  "business-district": ["Offices", "Co-working", "Interviews"],
  "state-hospital": ["healthcare", "recovery"],
  atiku: ["housing", "community"],
  "rural-outskirts": ["Farming", "Fishing", "Village life"],
  "mandela-freedom-park": ["walks", "community events"],
  "oke-fia": ["Eateries", "Small shops", "Gym"],
  residential: ["Housing", "Rent", "Neighbours"],
  "adire-cloth-market": ["textiles", "clothing shops", "market work"],
  "aiyegbaju-market": ["market stalls", "trader work", "social visits"],
  "old-garage": ["Motor park", "Workshops", "Spare parts"],
  "osogbo-central-mosque": ["worship", "community"],
  "osogbo-grand-mosque": ["worship", "community"],
  "oke-fia-community-church": ["worship", "community"],
  "airport-terminal": ["regional travel"],
  "isale-osun": ["retail", "services"],
  "industrial-area": ["manufacturing", "skilled trades"],
};

/** "textile workshop" → "Textile Workshop". */
export function featureLabel(feature: string) {
  return feature.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
