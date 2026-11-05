import { PencilIcon, type PencilIconPath } from "@inkra/react";

const stroke = (d: string): PencilIconPath => ({ d, mode: "stroke" });
const skull = stroke("M5 11a7 7 0 0 1 14 0c0 3-2 4-4 5v4H9v-4c-2-1-4-2-4-5ZM8 11h2m4 0h2m-4 3v1m-2 3v2m4-2v2");
const definitions: Record<string, { label: string; color: string; paths: PencilIconPath[] }> = {
  "skeleton-guard": { label: "骷髅兵", color: "#b7accc", paths: [skull, stroke("M4 14 2 20l4 2 2-5")] },
  "skeleton-archer": { label: "骷髅射手", color: "#baa8d1", paths: [skull, stroke("M19 4q9 8 0 17V4")] },
  "skeleton-mage": { label: "骷髅法师", color: "#a47bc1", paths: [skull, stroke("M3 21V8L1 6l2-3 2 3-2 2")] },
  "bone-legion": { label: "列阵骷髅", color: "#c5b7d6", paths: [skull, stroke("M2 20V6l2-3 1 3m17 14V6l-2-3-1 3")] },
  reanimate: { label: "复生骷髅", color: "#a993c5", paths: [skull, stroke("M2 20V9m-2 3 2-3 2 3")] },
  "flame-elemental": { label: "烈焰元素", color: "#e37b4f", paths: [stroke("M12 2c0 4-4 5-4 9-1-1-2-2-2-4-4 6-4 11 0 14 3 3 9 3 12 0 4-4 1-9-2-12 0 2-1 3-2 4 0-4 0-7-2-11ZM9 15h2m3 0h2m-5 3h3")] },
  "iron-guardian": { label: "钢铁卫士", color: "#aeb8bf", paths: [stroke("M7 5 10 2h4l3 3 2 4-1 9-4 4h-4l-4-4-1-9 2-4ZM6 10h12M8 12l2 1m6-1-2 1m-4 4h4M8 21l-2 2m10-2 2 2")] },
  "ember-familiar": { label: "烬火灵", color: "#d66b42", paths: [stroke("M5 20c-2-3-1-6 1-8 0 2 2 2 2 2-1-4 2-8 5-11 0 4 2 5 4 8 3 3 3 7 1 9-3 3-10 3-13 0ZM9 14h2m3 0h2m-5 3h3"), stroke("M11 19c-1-3 1-5 2-7 2 2 3 4 2 7")] },
  "frost-wisp": { label: "霜缕灵", color: "#73bdd4", paths: [stroke("M12 3c4 3 6 6 6 10 0 3-2 4-1 7l-3-2-2 3-2-3-3 2c1-3-1-4-1-7 0-4 2-7 6-10ZM9 12h2m3 0h2m-5 3h3"), stroke("M12 5v5m-2-3h4") ] },
  "thorn-guardian": { label: "荆棘卫士", color: "#69945b", paths: [stroke("M7 20 6 14l-3-2 3-1-1-4 4 1 3-5 3 5 4-1-1 4 3 1-3 2-1 6ZM9 12h2m3 0h2m-5 3h3M9 20l-2 2m8-2 2 2"), stroke("M12 4v5m-3-3 3 3 3-3") ] },
  "ember-turret": { label: "烬火炮台", color: "#c95f40", paths: [stroke("M6 21h12M8 20 9 10h6l1 10M7 10h10l-1-4H8ZM12 6c-2-2 0-4 1-5 0 2 2 2 2 4M10 15h4"), stroke("M6 21 5 23m13-2 1 2") ] },
  "frost-pylon": { label: "霜纹塔", color: "#70b7d3", paths: [stroke("M6 21h12M9 20l1-9h4l1 9M12 2l5 5-5 5-5-5ZM8 7h8m-4-4v8"), stroke("M7 21l-1 2m11-2 1 2") ] },
  "restorative-totem": { label: "复苏图腾", color: "#79a86a", paths: [stroke("M7 21h10M8 20V9l-2-3 6-4 6 4-2 3v11ZM9 11h6m-4 3h2m-3 4h4"), stroke("M12 3v6M9 6h6") ] },
};

export function ConstructPresentationIcon({ definitionId, entityId, size = 36 }: { definitionId: string; entityId: string; size?: number }) {
  const icon = definitions[definitionId];
  if (!icon) return null;
  return <PencilIcon paths={icon.paths} filledPaths={icon.paths} variant="filled" fillColor={icon.color} sourceSize={24} size={size} strokeWidth={0.9} seed={`construct-${entityId}`} style={{ color: icon.color }} role="img" aria-label={icon.label} />;
}
export function hasConstructPresentationIcon(definitionId: string) { return Object.hasOwn(definitions, definitionId); }
