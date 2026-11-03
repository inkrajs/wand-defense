import type { AssetRef, CombatEntity } from "../contracts";
import { demoContent } from "../content/demo";

type Presentation = { label?: string; icon?: string; imageUrl?: string };
/** Replace entries by asset key to change presentation without changing game rules. */
export const assetPresentations: Record<string, Presentation> = {
  "summon.wolf": { icon: "♞" },
  "summon.fire-spirit": { icon: "✹" },
  "summon.wood-spirit": { icon: "❋" },
  "summon.metal-spirit": { icon: "✦" },
  "building.arrow-tower": { icon: "▥" },
};
const kindIcon: Record<CombatEntity["kind"], string> = {
  enemy: "☠", summon: "✦", building: "▥", projectile: "•",
};

export function resolveAsset(asset: AssetRef | undefined, fallback: { label: string; icon: string }): Required<Pick<Presentation, "label" | "icon">> & Pick<Presentation, "imageUrl"> {
  const mapped = asset && assetPresentations[asset.key];
  return { label: mapped?.label ?? asset?.label ?? fallback.label, icon: mapped?.icon ?? asset?.icon ?? fallback.icon, imageUrl: mapped?.imageUrl };
}
export function resolveEntityAsset(entity: CombatEntity) {
  const definition = demoContent.spells[entity.definitionId];
  return resolveAsset(definition?.asset, { label: entity.definitionId, icon: kindIcon[entity.kind] });
}
export function AssetImage({ asset }: { asset: ReturnType<typeof resolveAsset> }) {
  return asset.imageUrl ? <img src={asset.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <>{asset.icon}</>;
}
