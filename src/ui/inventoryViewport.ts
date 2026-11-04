import { useSyncExternalStore } from "react";
import { INVENTORY_PAGE_ROWS } from "./inventoryAdapter";

// A narrow phone or a short touch viewport leaves less room above the bag.
const compactQuery = "(max-width: 600px), (max-height: 500px) and (pointer: coarse)";
const media = () => typeof window === "undefined" ? undefined : window.matchMedia(compactQuery);
function subscribe(listener: () => void) {
  const query = media();
  query?.addEventListener("change", listener);
  return () => query?.removeEventListener("change", listener);
}
export function useInventoryPageRows(): number {
  return useSyncExternalStore(subscribe, () => media()?.matches ? 3 : INVENTORY_PAGE_ROWS, () => INVENTORY_PAGE_ROWS);
}
