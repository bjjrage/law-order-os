import {
  Fragment,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { localMode } from "./local-api.js";
import {
  platformRequest,
  refreshCentral,
  centralUser,
} from "./platform-client.js";
import "./platform.css";
export default function PlatformGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "login" | "error">(
    "loading",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const token = new URLSearchParams(location.hash.slice(1)).get("invitation");
  const recovery = new URLSearchParams(location.hash.slice(1)).get("recovery");
  const [accountKey, setAccountKey] = useState("");
  async function load() {
    try {
      if (
        !localMode ||
        !document.querySelector('meta[name="law-order-platform"]')
      ) {
        setState("ready");
        return;
      }
      const response = await fetch("/local/platform/status", {
        credentials: "same-origin",
      });
      if (
        !response.ok ||
        response.headers.get("Content-Type")?.startsWith("text/html")
      )
        throw Error("No se pudo consultar el servidor local.");
      const status = await response.json();
      if (!status.enabled && !token) {
        setState("ready");
        return;
      }
      if (token || recovery) {
        setState("login");
        return;
      }
      try {
        await refreshCentral();
        setAccountKey(centralUser()?.id ?? "");
        setState("ready");
      } catch (e) {
        if ((e as { status?: number }).status === 401) setState("login");
        else throw e;
      }
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }
  useEffect(() => {
    void load();
    const expired = () => setState("login");
    const focus = () => {
      void load();
    };
    window.addEventListener("platform-session-expired", expired);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("platform-session-expired", expired);
      window.removeEventListener("focus", focus);
    };
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if(recovery){await platformRequest("recover-account",{token:recovery,password:data.get("password")});history.replaceState(null,"",location.pathname+location.search);location.reload();return;}
      if (token) {
        await platformRequest("accept-invitation", {
          token,
          name: data.get("name"),
          password: data.get("password"),
        });
        history.replaceState(null, "", location.pathname + location.search);
        location.reload();
        return;
      }
      const response = await fetch("/local/auth/sign-in/email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      if (!response.ok)
        throw Error(
          "Correo o contraseña incorrectos, o demasiados intentos. Volvé a intentar.",
        );
      location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (state === "ready")
    return <Fragment key={accountKey}>{children}</Fragment>;
  return (
    <main className="platform-entry">
      <section className="platform-card">
        <span className="eyebrow">LAW & ORDER OS · LOCAL</span>
        <h1>
          {state === "loading"
            ? "Abriendo tu estudio…"
            : recovery ? "Recuperar mi cuenta" : token
              ? "Aceptar invitación"
              : "Ingresar al estudio"}
        </h1>
        {state === "loading" ? (
          <p role="status">Conectando con los datos locales.</p>
        ) : state === "error" ? (
          <button
            onClick={() => {
              setState("loading");
              void load();
            }}
          >
            Reintentar conexión
          </button>
        ) : (
          <form onSubmit={login}>
            {recovery ? <p>Elegí una nueva contraseña. Se cerrarán las sesiones anteriores.</p> : token ? (
              <>
                <label>
                  Tu nombre
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </label>
                <p>
                  Ingresarás luego con el correo al que te invitaron. Si ya
                  tenés cuenta, usá tu contraseña actual para aceptar.
                </p>
              </>
            ) : (
              <label>
                Correo
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
            )}
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete={token || recovery ? "new-password" : "current-password"}
                required
                minLength={token || recovery ? 12 : 1}
                maxLength={128}
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? "Procesando…" : recovery ? "Guardar nueva contraseña" : token ? "Crear mi cuenta" : "Ingresar"}
            </button>
            <p className="muted">
              Datos y cuentas guardados en esta computadora.
            </p>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
