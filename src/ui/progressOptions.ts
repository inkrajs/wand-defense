/** Optional public Progress features available in the locally linked Inkra build.
 * Spreading these options keeps registry 0.15's public types compatible. */
export const localProgress = typeof import.meta.env !== "undefined" && import.meta.env.INKRA_LOCAL === true;
export function strokeOptions(color: string) {
  return localProgress ? { appearance: "stroke", showTrack: false, fillOrigin: "center", thickness: 8, color, inkDensity: 1.05, fillOpacity: 0.88, trackOpacity: 0.2 } as const : {};
}
export function ringOptions(color: string) {
  return localProgress ? { color, inkDensity: 1.35, fillOpacity: 1, trackOpacity: 0.2 } : {};
}
