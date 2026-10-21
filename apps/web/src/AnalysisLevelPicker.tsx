import { useEffect, useState } from "react";
import {
  analysisLevels,
  defaultAnalysisLevel,
  isAnalysisLevel,
  type AnalysisLevel,
} from "../../../packages/workspace/src/analysis-levels.js";
import "./analysis-levels.css";

const preferenceKey = "law-order.analysis-level.v1";
const changed = "law-order-analysis-level-changed";
let sessionLevel = defaultAnalysisLevel;
export function selectedAnalysisLevel(): AnalysisLevel {
  try {
    const saved = localStorage.getItem(preferenceKey);
    sessionLevel = isAnalysisLevel(saved) ? saved : defaultAnalysisLevel;
  } catch {
    /* In-memory preference keeps text and voice consistent. */
  }
  return sessionLevel;
}
export function useAnalysisLevel() {
  const [level, update] = useState(selectedAnalysisLevel);
  useEffect(() => {
    const sync = () => update(selectedAnalysisLevel());
    window.addEventListener(changed, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(changed, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const setLevel = (next: AnalysisLevel) => {
    sessionLevel = next;
    try {
      localStorage.setItem(preferenceKey, next);
    } catch {
      /* Preference only. */
    }
    update(next);
    window.dispatchEvent(new CustomEvent(changed));
  };
  return [level, setLevel] as const;
}
export default function AnalysisLevelPicker({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [level, setLevel] = useAnalysisLevel();
  return (
    <div className="analysis-level-picker">
      <div role="group" aria-label="Nivel de análisis">
        {(Object.keys(analysisLevels) as AnalysisLevel[]).map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={level === id}
            title={`${analysisLevels[id].model} · ${analysisLevels[id].effort}. Mismos controles jurídicos.`}
            onClick={() => setLevel(id)}
          >
            {analysisLevels[id].label}
          </button>
        ))}
      </div>
      <small>
        {level === "PROFUNDO"
          ? "Mayor costo y espera · mismo límite de USD 0,60 por mensaje."
          : "Gabriel elige especialistas · mismos controles en los tres niveles."}
      </small>
    </div>
  );
}
