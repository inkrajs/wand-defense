import { PencilIcon, type PencilIconPath } from "@inkra/react";

const stroke = (d: string): PencilIconPath => ({ d, mode: "stroke" });
const definitions: Record<string, { label: string; color: string; paths: PencilIconPath[] }> = {
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
