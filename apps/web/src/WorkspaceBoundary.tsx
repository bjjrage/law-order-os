import { Component, type ReactNode } from "react";

export const moduleLoadFailure = (message: string) =>
  /dynamically imported module|importing a module script failed|loading (?:css )?chunk|unable to preload css|failed to load module script/i.test(
    message,
  );

/** Keep recovery explicit: never reload automatically over an open document. */
export default class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: "" };
  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  componentDidCatch(error: Error) {
    console.error("[OS_SCREEN_ERROR]", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="recovery-screen">
        <section>
          <span className="brand-mark" aria-hidden="true">
            L
          </span>
          <span className="eyebrow">LAW & ORDER OS</span>
          <h1>No pudimos abrir esta pantalla</h1>
          <p>
            {moduleLoadFailure(this.state.message)
              ? "No se pudo cargar un componente de esta pantalla. Podés recargar para volver a abrir el OS."
              : "Se produjo un error al mostrar esta pantalla. Podés recargar para volver a abrir el OS."}
          </p>
          <p>
            La recarga conserva los documentos y el trabajo que ya guardaste.
            Los cambios sin guardar necesitan volver a ingresarse.
          </p>
          <button className="primary" onClick={() => window.location.reload()}>
            Recargar el OS
          </button>
          <details className="recovery-diagnostic">
            <summary>Detalle para diagnóstico</summary>
            <code>
              {moduleLoadFailure(this.state.message)
                ? "SCREEN_MODULE_UNAVAILABLE"
                : "SCREEN_RENDER_FAILED"}
            </code>
            <p>{this.state.message.slice(0, 1600)}</p>
          </details>
        </section>
      </main>
    );
  }
}
