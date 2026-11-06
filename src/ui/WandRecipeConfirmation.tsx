import { useLayoutEffect, useRef, useState } from 'react';
import { Button, PencilText } from '@inkra/react';
import type { Command, CommandResult, GameState } from '../contracts';
import { demoContent } from '../content/demo';
import { gradeDefinitions } from '../content/grades';
import { getWandRecipeGroups, getWandRecipeOptions, type WandRecipeOption } from '../loadout/recipe-options';
import { MagicPresentationIcon, getMagicPresentationIcon } from './magicPresentationIcons';
import { PanelBackdrop } from './PanelBackdrop';
import './MagicDetails.css';
import './WandRecipeConfirmation.css';

type RecipeChoice = WandRecipeOption & { wandId: string };

const sameMaterials = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(id => b.includes(id));

export function getWandRecipeChoices(state: GameState, itemId: string, preferredItemIds?: readonly string[]): RecipeChoice[] {
  const wand = state.wands.find(entry => entry.placements.some(placement => placement.itemId === itemId));
  if (!wand) return [];
  const options = getWandRecipeOptions(state, wand.id, demoContent, itemId);
  const preferred = preferredItemIds?.includes(itemId)
    ? getWandRecipeGroups(state, wand.id, demoContent).filter(option => sameMaterials(option.itemIds, preferredItemIds)) : [];
  return options.map(option => ({ ...(preferred.find(group => group.recipeId === option.recipeId) ?? option), wandId: wand.id }))
    .sort((a, b) => Number(preferred.some(group => group.recipeId === b.recipeId)) - Number(preferred.some(group => group.recipeId === a.recipeId)));
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

export function WandRecipeConfirmation({ state, itemId, preferredItemIds, dispatch, onClose }: {
  state: GameState; itemId: string; preferredItemIds?: readonly string[]; dispatch: (command: Command) => CommandResult; onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  // Keep the presented instances fixed so a layout change can never substitute an ingredient.
  const [choices] = useState(() => getWandRecipeChoices(state, itemId, preferredItemIds).map(option => ({
    ...option, materials: option.itemIds.map(id => ({ ...state.items[id] })),
  })));
  const [selected, select] = useState(0);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const choice = choices[selected];
  const stillValid = choice && getWandRecipeGroups(state, choice.wandId, demoContent).some(option =>
    option.recipeId === choice.recipeId && sameMaterials(option.itemIds, choice.itemIds));

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
