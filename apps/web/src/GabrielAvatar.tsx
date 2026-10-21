import { Avatar } from "./TeamEditor.js";

export type GabrielState = "idle" | "listening" | "thinking" | "speaking";

/** Keep the approved identity shared with the legal team presentation. */
export default function GabrielAvatar({
  state,
  level,
}: {
  state: GabrielState;
  level: number;
}) {
  return (
    <span
      className="gabriel-model"
      data-state={state}
      aria-hidden="true"
      style={{
        outlineWidth: state === "listening" ? 2 + Math.min(level * 40, 5) : 0,
      }}
    >
      <Avatar id="gabriel" size={36} />
    </span>
  );
}
