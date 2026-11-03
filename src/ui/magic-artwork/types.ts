import type { PencilIconPath } from "@inkra/react";

/** One continuous illustration, in the definition's 24-unit-per-cell source box. */
export interface MagicArtwork {
  paths: readonly PencilIconPath[];
  filledPaths: readonly PencilIconPath[];
}
export type MagicArtworkCatalog = Readonly<Record<string, MagicArtwork>>;
