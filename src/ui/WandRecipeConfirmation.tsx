import { useLayoutEffect, useRef, useState } from 'react';
import { Button, PencilText } from '@inkra/react';
import type { Command, CommandResult, GameState, WandInstance } from '../contracts';
import { demoContent } from '../content/demo';
import { gradeDefinitions } from '../content/grades';
import { getWandRecipeOptions, type WandRecipeOption } from '../loadout/recipe-options';
import { MagicPresentationIcon, getMagicPresentationIcon } from './magicPresentationIcons';
import { PanelBackdrop } from './PanelBackdrop';
import './MagicDetails.css';
import './WandRecipeConfirmation.css';

type RecipeChoice = WandRecipeOption & { wandId: string };

export function getWandRecipeChoices(state: GameState, itemId: string): RecipeChoice[] {
  const wand = state.wands.find(entry => entry.placements.some(placement => placement.itemId === itemId));
  if (!wand) return [];
  return getWandRecipeOptions(state, wand.id, demoContent, itemId)
    .map(option => ({ ...option, wandId: wand.id }));
}

export function getWandRecipeMaterialIds(state: GameState, wands: readonly WandInstance[]): Set<string> {
  const ids = new Set<string>();
  for (const wand of wands) {
    const options = getWandRecipeOptions(state, wand.id, demoContent);
    if (!options.length) continue;
    for (const option of options) for (const id of option.itemIds) ids.add(id);
    for (const { itemId } of wand.placements) {
      if (!ids.has(itemId) && getWandRecipeOptions(state, wand.id, demoContent, itemId).length) ids.add(itemId);
    }
  }
  return ids;
}

function name(definitionId: string) {
  return (demoContent.spells[definitionId] ?? demoContent.arcana[definitionId])?.name ?? '未知';
}
function RecipeMagic({ definitionId, details }: { definitionId: string; details?: string }) {
  return <span className="wand-recipe__magic">
    {getMagicPresentationIcon(definitionId) && <span aria-hidden="true"><MagicPresentationIcon definitionId={definitionId} size={42} seed={`recipe-preview-${definitionId}`} /></span>}
    <PencilText as="span">{name(definitionId)}</PencilText>
    {details && <PencilText as="small" className="wand-recipe__grade">{details}</PencilText>}
  </span>;
}

export function WandRecipeConfirmation({ state, itemId, dispatch, onClose }: {
  state: GameState; itemId: string; dispatch: (command: Command) => CommandResult; onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  // Keep the presented instances fixed so a layout change can never substitute an ingredient.
  const [choices] = useState(() => getWandRecipeChoices(state, itemId).map(option => ({
    ...option, materials: option.itemIds.map(id => ({ ...state.items[id] })),
  })));
  const [selected, select] = useState(0);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const choice = choices[selected];
  const stillValid = choice && getWandRecipeChoices(state, itemId).some(option => option.wandId === choice.wandId
    && option.recipeId === choice.recipeId && option.itemIds.length === choice.itemIds.length
    && option.itemIds.every(id => choice.itemIds.includes(id)));

  useLayoutEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.focus({ preventScroll: true });
    return () => {
      if (node?.contains(document.activeElement) && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return <div ref={dialog} className="magic-details wand-recipe" role="dialog" aria-label="合成确认" tabIndex={-1} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <PanelBackdrop>
      <div className="magic-details__body wand-recipe__body">
        <PencilText as="h2" className="magic-details__name">合成确认</PencilText>
        {choices.length > 1 && <div className="wand-recipe__choices" role="group" aria-label="选择配方">
          {choices.map((option, index) => <Button key={option.recipeId} type="button" variant={index === selected ? 'outline' : 'ghost'} aria-pressed={index === selected} disabled={pending} onClick={() => { select(index); setError(false); }}>{name(option.output)}</Button>)}
        </div>}
        {choice && <div className="wand-recipe__formula">
          <ul className="wand-recipe__ingredients" aria-label="消耗材料">
            {choice.materials.map(material => <li key={material.id}><RecipeMagic definitionId={material.definitionId} details={`Lv.${material.level} · ${gradeDefinitions[material.grade].name}`} /></li>)}
          </ul>
          <span className="wand-recipe__arrow" aria-hidden="true">→</span>
          <div role="group" aria-label="产物"><RecipeMagic definitionId={choice.output} /></div>
        </div>}
        {(!stillValid || error) && <PencilText as="p" className="wand-recipe__status" role="status">材料或摆放已变化，请重新选择。</PencilText>}
        <div className="wand-recipe__actions">
          <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          <Button type="button" disabled={!stillValid || pending} onClick={() => {
            if (!choice || !stillValid || pending) return;
            const result = dispatch({ id: globalThis.crypto?.randomUUID?.() ?? `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: 'mergeRecipe', wandId: choice.wandId, recipeId: choice.recipeId, itemIds: [...choice.itemIds] });
            if (result.status === 'executed') onClose();
            else if (result.status === 'accepted') setPending(true);
            else setError(true);
          }}>确认合成</Button>
        </div>
      </div>
    </PanelBackdrop>
  </div>;
}
