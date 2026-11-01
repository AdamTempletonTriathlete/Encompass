// Camera azimuth in compass degrees (the world bearing shown at the top of the screen).
// Kept outside the store so per-frame updates never trigger React renders.
export const view = { heading: 0, steering: false };
