export const gabrielSize = { width: 170, height: 46, margin: 12 };
export type GabrielPosition = { x: number; y: number };

/** Keep the entire launcher reachable after dragging or resizing the window. */
export function clampGabrielPosition(
  position: GabrielPosition,
  viewport: { width: number; height: number },
): GabrielPosition {
  const { width, height, margin } = gabrielSize;
  return {
    x: Math.max(margin, Math.min(viewport.width - width - margin, position.x)),
    y: Math.max(margin, Math.min(viewport.height - height - margin, position.y)),
  };
}

export function defaultGabrielPosition(viewport: { width: number; height: number }) {
  return clampGabrielPosition({
    x: viewport.width - gabrielSize.width - 16,
    y: viewport.height - gabrielSize.height - gabrielSize.margin,
  }, viewport);
}
