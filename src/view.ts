// Camera state kept outside the store so per-frame updates never trigger React renders.
// `heading` is the world bearing shown at the top of the screen (compass degrees).
export const view = {
  heading: 0,
  steering: false,
  dragging: false,
  // True once the player has moved the camera; auto-recentring stays off until they ask for it.
  free: false,
  offAxis: 0,
};

export const RECENTER_BUTTON_DELAY_MS = 700;
const MIN_OFFSET_DEGREES = 8;

let canRecenter = false;
const listeners = new Set<() => void>();
const setCanRecenter = (value: boolean) => {
  if (canRecenter === value) return;
  canRecenter = value;
  listeners.forEach((listener) => listener());
};

export const subscribeRecenter = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getCanRecenter = () => canRecenter;

let timer: number | undefined;

export function beginLook() {
  window.clearTimeout(timer);
  view.dragging = true;
  view.free = true;
  setCanRecenter(false);
}

export function endLook() {
  view.dragging = false;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (view.free && !view.dragging && Math.abs(view.offAxis) > MIN_OFFSET_DEGREES) setCanRecenter(true);
  }, RECENTER_BUTTON_DELAY_MS);
}

export function recenterView() {
  window.clearTimeout(timer);
  view.free = false;
  setCanRecenter(false);
}
