import { useEffect, useState } from "react";
import { localMode, saveBlob } from "./api.js";
import { deliberationSteps } from "./junta-presentation.js";
type Setup = {
  providers: Array<{
    stage: string;
    key_variable: string;
    key_present: boolean;
    key_source: string;
    model_id: string;
    model_matches: boolean;
    last_metadata_pass?: boolean;
  }>;
  missing_keys: string[];
};
type Demo = {
  run_id: string;
  mode: "OFFLINE_SIMULATION";
  status: string;
  legal_analysis_untrusted_draft: string | null;
  cost: { actual_total_usd: number };
  references: Array<{ label: string }>;
};
async function request<T>(path: string, demo = false): Promise<T> {
  const response = await fetch("/local/junta/" + path, {
    method: demo ? "POST" : "GET",
    headers: demo ? { "X-Junta-Offline": "1" } : {},
    credentials: "omit",
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      result.error ?? "No se pudo acceder al puente local de la Junta.",
    );
  return result;
}
export default function JuntaPanel() {
  const [setup, setSetup] = useState<Setup | null>(null),
    [demo, setDemo] = useState<Demo | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    try {
      setError("");
      setSetup(await request<Setup>("status"));
    } catch {
      setError(
        "El chequeo requiere npm.cmd run os:local. También podés usar npm.cmd run junta:estado desde la terminal.",
      );
    }
  }
  useEffect(() => {
    if (!localMode) return;
    const abort = new AbortController();
    fetch("/local/junta/status", { signal: abort.signal, credentials: "omit" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = (await r.json()) as Setup;
        if (!abort.signal.aborted) setSetup(data);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "El chequeo requiere npm.cmd run os:local. También podés usar npm.cmd run junta:estado desde la terminal.",
          );
      });
    return () => abort.abort();
  }, []);
  return (
    <section className="junta-panel" aria-labelledby="junta-title">
      <div className="panel-heading">
        <h2 id="junta-title">Junta Jurídica</h2>
        <span className="badge">IA real bloqueada · sin gasto</span>
      </div>
      <p>Documentación → contexto → análisis jurídico → revisión adversarial → control de citas → revisión humana.</p>
      <p className="muted">
        Esta vista muestra la disponibilidad de cada función. La configuración
        técnica y las credenciales se administran fuera de la interfaz jurídica.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Estado local</th>
            </tr>
          </thead>
          <tbody>
            {setup ? (
              setup.providers.map((p) => (
                <tr key={p.stage}>
                  <td>{deliberationSteps.find((role) => role.id === p.stage)?.name ?? "Servicio de la Junta"}</td>
                  <td>
                    {p.last_metadata_pass
                      ? "Metadatos accesibles · generación pendiente"
                      : p.key_present
                        ? "Clave presente · sin verificar"
                        : "Falta clave"}
                    {!p.model_matches && " · revisar configuración técnica"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2}>
                  Configuración disponible con{" "}
                  <code>npm.cmd run junta:estado</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">
        No cargues claves en esta pantalla ni en el chat. Guardar una clave no
        habilita llamadas. Para IA real faltan validar acceso, evidencia y
        tarifas, además de autorización expresa de gasto.
      </p>
      <div className="actions">
        <button disabled={!localMode || busy} onClick={refresh}>
          Revisar configuración
        </button>
        <button
          className="primary"
          disabled={!localMode || busy}
          onClick={async () => {
            try {
              setBusy(true);
              setError("");
              setDemo(null);
              const result = await request<Demo>("demo", true);
              if (
                result.mode !== "OFFLINE_SIMULATION" ||
                result.cost.actual_total_usd !== 0
              )
                throw Error("La respuesta no corresponde a una demo offline.");
              setDemo(result);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Ejecutando demo…" : "Ejecutar demo offline"}
        </button>
        {demo && (
          <button
            onClick={() =>
              saveBlob(
                new Blob([JSON.stringify(demo, null, 2)], {
                  type: "application/json",
                }),
                "junta-demo-offline.json",
              )
            }
          >
            Descargar resultado
          </button>
        )}
      </div>
      <p className="muted">
        La demo ejecuta el motor con proveedores y expediente sintéticos,
        independientes de tus asuntos. No responde una consulta real ni verifica
        jurisprudencia oficial. No utiliza claves ni red.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {demo && (
        <div role="status" className="junta-result">
          <h3>Demo finalizada · revisión humana pendiente</h3>
          <p>
            <code>{demo.run_id}</code> · Gasto real: USD{" "}
            {demo.cost.actual_total_usd}
          </p>
          <p>{demo.legal_analysis_untrusted_draft}</p>
          <p className="muted">
            Referencias simuladas:{" "}
            {demo.references.map((r) => r.label).join(", ") ||
              "Sin referencias"}
            . Resultado de prueba; no es un dictamen.
          </p>
        </div>
      )}
    </section>
  );
}
