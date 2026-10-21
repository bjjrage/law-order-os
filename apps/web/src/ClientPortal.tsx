import { useEffect, useState } from "react";
import { saveBlob } from "./api.js";
import "./practice.css";
async function request(token: string, body: unknown) {
  const response = await fetch("/local/portal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Platform": "1",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      "El acceso no está disponible o venció. Solicitá un nuevo enlace al estudio.",
    );
  return result.data;
}
export default function ClientPortal() {
  const token = location.hash.slice("#portal=".length),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    let active = true;
    request(token, { action: "VIEW" })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="client-portal">
      <span className="eyebrow">PORTAL PRIVADO DEL CLIENTE</span>
      <h1>{data?.firm ?? "Entrega del estudio"}</h1>
      {error && <p role="alert">{error}</p>}
      {data ? (
        <>
          <h2>{data.matter}</h2>
          <p>
            Para {data.recipient} · Acceso hasta{" "}
            {new Date(data.expires_at).toLocaleDateString("es-PY")}
          </p>
          <p>Documentos y comunicaciones publicados por el estudio.</p>
          {data.publications.map((p: any) => (
            <article className="practice-card" key={p.id}>
              <h3>{p.title}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{p.message}</p>
              <small>{new Date(p.published_at).toLocaleString("es-PY")}</small>
              {p.has_document && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const d = await request(token, {
                        action: "DOWNLOAD",
                        publication_id: p.id,
                      });
                      const bytes = Uint8Array.from(
                        atob(d.base64),
                        (c: string) => c.charCodeAt(0),
                      );
                      saveBlob(new Blob([bytes], { type: d.mime }), d.title);
                    })
                  }
                >
                  Descargar versión entregada
                </button>
              )}
            </article>
          ))}
          {!data.publications.length && (
            <p>Todavía no hay entregas publicadas.</p>
          )}
          {data.allow_messages && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  await request(token, {
                    action: "MESSAGE",
                    message_id: crypto.randomUUID(),
                    text,
                  });
                  setText("");
                  setSent(true);
                  setData(await request(token, { action: "VIEW" }));
                });
              }}
            >
              <label>
                <strong>Mensaje al estudio</strong>
                <textarea
                  required
                  maxLength={12000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <button disabled={busy}>Enviar mensaje</button>
              {sent && <p role="status">Mensaje registrado en el asunto.</p>}
            </form>
          )}
          <details>
            <summary>Mis mensajes enviados</summary>
            {data.messages.map((m: any) => (
              <p key={m.id}>{m.text}</p>
            ))}
          </details>
        </>
      ) : (
        !error && <p role="status">Abriendo entrega…</p>
      )}
    </main>
  );
}
