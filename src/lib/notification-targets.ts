/**
 * Phone app that each notification kind opens. Kinds without a page return null,
 * so the notification stays as information only.
 */
const NOTIFICATION_APPS: Readonly<Record<string, string>> = {
  friend_request: "People",
  mission: "Missions",
  job: "Career Life",
  career: "Career Life",
  explore: "Map",
  welcome: "Find homes",
  level: "Profile",
};

export function notificationAppFor(kind: string): string | null {
  return NOTIFICATION_APPS[kind] ?? null;
}

/** Ask the phone shell to open an app. The launcher listens for this event. */
export function openPhoneAppFromNotification(app: string): void {
  window.dispatchEvent(new CustomEvent("osogbo-open-phone-app", { detail: { app } }));
}
