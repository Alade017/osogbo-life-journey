/**
 * The one place a phone app asks to open a direct conversation with a player.
 * Apps call openPlayerMessages instead of dispatching the event themselves, so the
 * destination can change (a chat sheet, a new thread screen) without touching each app.
 */
export const OPEN_MESSAGES_EVENT = "osogbo-open-messages";

export function openPlayerMessages(characterId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_MESSAGES_EVENT, { detail: { playerId: characterId } }));
}
