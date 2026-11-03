import type { ContentCatalog, RuntimePort } from "../contracts";

/** Explicit local preview requests only; normal starts and the remote protocol never unlock cheats. */
export function grantPreviewMagic(runtime: RuntimePort, content: ContentCatalog, requestId: string, onlyMissing = false) {
  const before = runtime.getState();
  const runId = before.id;
  const prefix = `preview:${requestId}`;
  runtime.dispatch({id:`${prefix}:unlock`,type:"unlockCheats"});
  runtime.dispatch({id:`${prefix}:enable`,type:"setCheats",enabled:true});
  const owned = new Set(Object.values(before.items).map(item => item.definitionId));
  const definitions = [...Object.keys(content.spells),...Object.keys(content.arcana)]
    .filter(id => !onlyMissing || !owned.has(id));
  definitions.forEach(definitionId => runtime.dispatch({
    id:`${prefix}:${definitionId}`,type:"cheat",action:"grantItem",definitionId,
  }));
  runtime.dispatch({id:`${prefix}:backpack`,type:"setBackpack",open:true});
  const after = runtime.getState();
  return {requestId,runId,unchangedRun:after.id === runId,
    granted:Object.keys(after.items).filter(id => !before.items[id]).length,
    definitions:definitions.length,backpackItems:after.backpack.length};
}
