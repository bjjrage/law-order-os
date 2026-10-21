import { useState } from "react";
import type { Task } from "../../../os-core/src/contracts.js";
import { api } from "./api.js";
import { workChanged, errorText } from "./work-management-client.js";
export function TaskProgress({
  task,
  actorId,
  director,
  onChanged,
}: {
  task: Task;
  actorId: string;
  director: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false),
    [note, setNote] = useState(""),
    [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (task.direction_request) return null;
  return (
    <details className="work-progress">
      <summary>
        Avances{" "}
        {task.progress?.length ? `· ${task.progress.length}` : "y bloqueos"}
      </summary>
      {task.progress?.map((entry) => (
        <p key={entry.id}>
          <strong>{entry.state === "BLOCKED" ? "Bloqueo" : "Avance"}</strong> ·{" "}
          {new Date(entry.at).toLocaleString("es-PY", {
            timeZone: "America/Asuncion",
          })}
          <br />
          {entry.note}
        </p>
      ))}
      {task.status === "PENDING" &&
        (director || task.responsible_identity_id === actorId) && (
          <>
            <button onClick={() => setOpen(!open)}>
              Registrar avance / bloqueo
            </button>
            {open && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await api(
                      `/firms/${task.law_firm_id}/matters/${task.matter_id}/tasks/${task.id}/progress`,
                      { note, state: blocked ? "BLOCKED" : "UPDATE" },
                    );
                    setNote("");
                    setOpen(false);
                    onChanged();
                    workChanged();
                  } catch (cause) {
                    setError(errorText(cause));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Avance o impedimento
                  <textarea
                    required
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={4000}
                  />
                </label>
                <label className="deadline-check">
                  <input
                    type="checkbox"
                    checked={blocked}
                    onChange={(e) => setBlocked(e.target.checked)}
                  />{" "}
                  Necesito resolver un bloqueo
                </label>
                <button disabled={busy}>Guardar avance</button>
              </form>
            )}
          </>
        )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
