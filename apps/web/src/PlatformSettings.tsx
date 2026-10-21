import { useEffect, useState, type FormEvent } from "react";
import {
  centralEnabled,
  legacySnapshot,
  platformRequest,
  signOut,
} from "./platform-client.js";
type Backup = {
  id: string;
  created_at: string;
  restoration?: { status: string };
};
type Settings = {
  owner: boolean;
  director_firms?: string[];
  accounts?: { id: string; display_name: string }[];
  backups?: Backup[];
  backup_error?: string;
  deadline_error?: string;
  backup_progress?:{stage:string;updated_at:string};
  operations?:{enabled:boolean;origin:string|null;addresses:string[];ca_fingerprint:string|null;external_backup:string|null;port:number};
};
export default function PlatformSettings({ firm }: { firm: string }) {
  const [data, setData] = useState<Settings | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(false),
    [link, setLink] = useState("");
  const active = centralEnabled();
  async function refresh() {
    if (active) setData(await platformRequest("administration"));
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [active]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function activate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      if (f.get("password") !== f.get("confirm"))
        throw Error("Las contraseñas no coinciden.");
      await platformRequest("activate", {
        name: f.get("name"),
        email: f.get("email"),
        password: f.get("password"),
        snapshot: await legacySnapshot(),
      });
      location.reload();
    });
  }
  return (
    <section className="settings-section platform-settings">
      <div>
        <span className="eyebrow">CUENTAS, DATOS Y RESPALDOS</span>
        <h3>
          {active ? "Servidor local del estudio" : "Activar cuentas personales"}
        </h3>
        {!active ? (
          <>
            <p>
              Trasladá los clientes, asuntos, originales e historial de este
              navegador a PostgreSQL local. Conservamos una copia anterior y los
              autores históricos. El editor compartido mantiene su contenido.
            </p>
            {!setup ? (
              <button onClick={() => setSetup(true)}>
                Configurar mi cuenta y centralizar
              </button>
            ) : (
              <form className="platform-form" onSubmit={activate}>
                <label>
                  Tu nombre
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Correo de acceso
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Contraseña · mínimo 12 caracteres
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Repetir contraseña
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <p>
                  Esta cuenta será titular de la instalación y administrará los
                  estudios existentes. Luego ingresarás con tu correo y
                  contraseña.
                </p>
                <button disabled={busy}>Activar y conservar mis datos</button>
              </form>
            )}
          </>
        ) : (
          <>
            <p>
              Cuentas personales y datos centralizados en esta computadora. Los
              accesos a los asuntos se conceden desde Personas y permisos.
            </p>
            {data?.deadline_error && <p role="alert">{data.deadline_error}</p>}
            {(data?.owner || data?.director_firms?.includes(firm)) && (
              <>
                <details>
                  <summary>
                    Personas e invitaciones · {data.accounts?.length ?? 0}{" "}
                    cuentas
                  </summary>
                  <ul>
                    {data.accounts?.map((a) => (
                      <li key={a.id}>{a.display_name} <button disabled={busy||!firm} onClick={()=>void run(async()=>{const r=await platformRequest("recovery-link",{firm_id:firm,user_id:a.id});setLink(r.link);setNotice("Recuperación: enlace de un solo uso válido por 30 minutos.")})}>Recuperar acceso</button></li>
                    ))}
                  </ul>
                  <form
                    className="platform-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        const r = await platformRequest("invite", {
                          email: f.get("email"),
                          firm_id: firm,
                          role: f.get("role"),
                        });
                        setLink(r.link);
                      });
                    }}
                  >
                    <label>
                      Correo de la persona
                      <input name="email" type="email" required />
                    </label>
                    <label>
                      Rol
                      <select name="role">
                        <option value="LAWYER">Abogado/a</option>
                        <option value="ADMINISTRATOR">Director del despacho</option>
                      </select>
                    </label>
                    <button disabled={busy || !firm}>
                      Crear invitación local
                    </button>
                  </form>
                  <p className="muted">
                    Válida por 48 horas, un solo uso. Abrir en otro navegador de
                    esta computadora. Cada asunto requiere su permiso.
                  </p>
                  {link && (
                    <label>
                      Enlace para copiar
                      <input
                        readOnly
                        value={link}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </label>
                  )}
                </details>
                {data.owner && <details>
                  <summary>
                    Respaldos y recuperación · diario con el servidor encendido
                  </summary>
                  <p>
                    Incluye PostgreSQL, originales del editor, Biblioteca, SQLite, sesiones y configuración.
                    La prueba restaura una base temporal y compara el contenido
                    sin reemplazar la base activa.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await platformRequest("backup", {});
                        setNotice("Respaldo creado y hashes verificados.");
                      })
                    }
                  >
                    Respaldar ahora
                  </button>
                  {data.backup_error && <p role="alert">{data.backup_error}</p>}
                  {data.backup_progress&&data.backup_progress.stage!=="VERIFIED"&&<p role="status">Respaldo en preparación: {({POSTGRESQL_SNAPSHOT:"base central",SQLITE_SNAPSHOT:"copia consistente de Biblioteca",SQLITE_STRUCTURE_AND_SEARCH:"comprobación del catálogo y búsqueda",COPYING_DURABLE_FILES:"originales, extracciones e históricos",HASHING_CAPTURED_FILES:"verificación de archivos"} as Record<string,string>)[data.backup_progress.stage]??"verificación"}.</p>}
                  <ul>
                    {data.backups?.slice(0, 5).map((b) => (
                      <li key={b.id}>
                        {new Date(b.created_at).toLocaleString()} ·{" "}
                        {b.restoration?.status === "VERIFIED"
                          ? "Restauración comprobada"
                          : "Sin prueba de restauración"}{" "}
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await platformRequest("restore-check", {
                                id: b.id,
                              });
                              setNotice(
                                "Restauración comprobada en una base temporal.",
                              );
                            })
                          }
                        >
                          Comprobar
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="muted">
                    Carpeta .local-dev/backups. Para cubrir la pérdida del
                    disco, copiá la carpeta completa a otro dispositivo.
                  </p>
                  <form className="platform-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{await platformRequest("operations",{action:"external-backup",destination:f.get("destination")});setNotice("Destino guardado. Los próximos respaldos se copiarán y verificarán allí.")})}}><label>Carpeta externa existente (vacío desactiva la copia)<input name="destination" defaultValue={data.operations?.external_backup??""}/></label><button disabled={busy}>Guardar destino</button></form>
                  {data.operations?.external_backup&&data.backups?.[0]&&<button disabled={busy} onClick={()=>void run(async()=>{await platformRequest("operations",{action:"copy-backup",id:data.backups![0]!.id});setNotice("Copia externa verificada.")})}>Copiar último respaldo al destino</button>}
                </details>}
                {data.owner&&<details><summary>Conexión HTTPS en la red del estudio</summary><p>La conexión local actual sigue disponible. Para otra computadora, instalá el certificado del estudio y usá la dirección HTTPS.</p><form className="platform-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{await platformRequest("operations",{action:"network",enabled:f.get("enabled")==="on",bind:f.get("bind"),port:Number(f.get("port"))});setNotice("Configuración de red aplicada.")})}}><label><input name="enabled" type="checkbox" defaultChecked={data.operations?.enabled}/>Habilitar HTTPS local</label><label>Interfaz privada<select name="bind">{data.operations?.addresses.map(ip=><option key={ip}>{ip}</option>)}</select></label><label>Puerto<input name="port" type="number" min="1024" max="65535" defaultValue={data.operations?.port??4314}/></label><button disabled={busy}>Aplicar conexión</button></form>{data.operations?.origin&&<p>Dirección: <a href={data.operations.origin}>{data.operations.origin}</a></p>}{data.operations?.ca_fingerprint&&<><a href="/local/platform/ca-certificate">Descargar certificado del estudio</a><p className="muted">Huella SHA-256: {data.operations.ca_fingerprint}</p></>}<p className="muted">La prueba con otra computadora y la configuración de confianza del certificado quedan para la prueba operativa del estudio.</p></details>}
              </>
            )}
            <details>
              <summary>Mi contraseña</summary>
              <form
                className="platform-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  void run(async () => {
                    const r = await fetch("/local/auth/change-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        currentPassword: f.get("current"),
                        newPassword: f.get("new"),
                        revokeOtherSessions: true,
                      }),
                    });
                    if (!r.ok)
                      throw Error(
                        "No se pudo cambiar la contraseña. Revisá la contraseña actual.",
                      );
                    form.reset();
                    setNotice(
                      "Contraseña actualizada; otras sesiones cerradas.",
                    );
                  });
                }}
              >
                <label>
                  Actual
                  <input
                    name="current"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  Nueva
                  <input
                    name="new"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                  />
                </label>
                <button disabled={busy}>Cambiar contraseña</button>
              </form>
            </details>
            <button
              onClick={() => void signOut().catch((e) => setError(e.message))}
            >
              Cerrar mi sesión
            </button>
          </>
        )}
        {busy && <p role="status">Procesando en el servidor local…</p>}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
    </section>
  );
}
