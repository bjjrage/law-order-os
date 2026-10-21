import { useState, useEffect, useRef, type ReactNode } from "react";
export function DataTable({ children }: { children: ReactNode }) {
  return (
    <>
      <p className="table-scroll-hint">
        Deslizá la tabla para ver todas las columnas →
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Tabla de registros"
        tabIndex={0}
      >
        <table>{children}</table>
      </div>
    </>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children ? (
        <select name={name} defaultValue={value} required={required}>
          {children}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
        />
      )}
    </label>
  );
}
export function Form({
  title,
  children,
  onSave,
  onClose,
  footerText = "Datos sintéticos · desarrollo local",
}: {
  title: string;
  children: ReactNode;
  onSave: (form: FormData) => Promise<void>;
  onClose: () => void;
  footerText?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current
      ?.querySelector<HTMLInputElement>("input,select,textarea")
      ?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <section ref={panel} className="form-panel" aria-labelledby="form-title">
      <div className="panel-heading">
        <h2 id="form-title">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar formulario">
          Cerrar
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await onSave(form);
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">{children}</div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-footer">
          <span className="muted">{footerText}</span>
          <button className="primary" disabled={busy} aria-busy={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </section>
  );
}
export function Empty({
  message = "No hay elementos para estos filtros.",
}: {
  message?: string;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true">—</span>
      <p>{message}</p>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const label = typeof children === "string" ? children : "";
  const tone = ["Aprobado", "Abierto", "Hecha"].includes(label)
    ? "success"
    : ["Pendiente", "En revisión", "Cambios solicitados"].includes(label)
      ? "attention"
      : "neutral";
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}
