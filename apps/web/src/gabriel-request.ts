const key = (matter: string, actor: string) =>
  `law-order.gabriel.pending.${actor}.${matter}`;
const pending = new Map<string, string>();
export function queueGabrielRequest(
  matter: string,
  actor: string,
  instruction: string,
) {
  pending.set(key(matter, actor), instruction);
  try { sessionStorage.setItem(key(matter, actor), instruction); } catch { /* In-memory handoff remains available. */ }
  window.dispatchEvent(new Event("law-order-gabriel-request"));
}
export function takeGabrielRequest(matter: string, actor: string) {
  let instruction = pending.get(key(matter, actor)) ?? null;
  pending.delete(key(matter, actor));
  try {
    instruction ??= sessionStorage.getItem(key(matter, actor));
    sessionStorage.removeItem(key(matter, actor));
  } catch { /* Read the in-memory copy if storage is unavailable. */ }
  return instruction;
}
