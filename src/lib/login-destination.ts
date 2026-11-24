// Carry only a venue slug through login. The normal location route still checks arrival.
export function loginDestination(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : undefined;
}

export function afterLogin(destination?: string) {
  const slug = loginDestination(destination);
  return slug ? { to: "/location/$slug" as const, params: { slug } } : { to: "/enter" as const };
}
