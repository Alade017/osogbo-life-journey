/** Display a catalogue identifier without inventing a separate item name or gameplay state. */
export function homeFurnitureLabel(itemId: string): string {
  return itemId
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
