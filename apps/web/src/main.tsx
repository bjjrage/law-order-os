import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import WorkspaceBoundary from "./WorkspaceBoundary.js";
import PlatformGate from "./PlatformGate.js";
import "./styles.css";
import "./os-theme.css";
import "./buttons.css";
const SharedWorkspace = lazy(() => import("./SharedWorkspace.js"));
const ClientPortal = lazy(() => import("./ClientPortal.js"));
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkspaceBoundary>
      {location.hash.startsWith("#portal=") ? <Suspense fallback={<p role="status">Abriendo entrega…</p>}><ClientPortal/></Suspense> : <PlatformGate>
        {new URLSearchParams(location.search).has("workspace") ? (
          <Suspense fallback={<p role="status">Abriendo workspace…</p>}>
            <SharedWorkspace />
          </Suspense>
        ) : (
          <App />
        )}
      </PlatformGate>}
    </WorkspaceBoundary>
  </StrictMode>,
);
