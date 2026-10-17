export function moodLabel(happiness: number, stress: number) {
  if (stress >= 70) return "Stressed";
  if (happiness >= 75) return "Thriving";
  if (happiness >= 50) return "Content";
  if (happiness >= 30) return "Low";
  return "Needs care";
}
