import {useEffect,useRef,type PointerEvent as ReactPointerEvent,type MouseEvent,type KeyboardEvent} from 'react';
import type {GameState} from '../contracts';

/** Inspect a tap and leave movement, long holds and cancelled gestures to the grid. */
export function useMagicInspectGesture(
  state: Pick<GameState, 'items'>,
  onInspect?: (itemId: string, preferredItemIds?: string[]) => void,
  onInspectOther?: (itemId: string, viaKeyboard: boolean) => void,
) {
  const gesture=useRef<{id:string;pointerId:number;x:number;y:number;started:number;touch:boolean;moved:boolean}|null>(null);
  useEffect(()=>{
    const move=(event:PointerEvent)=>{
      const current=gesture.current;
      if(current && event.pointerId===current.pointerId && Math.hypot(event.clientX-current.x,event.clientY-current.y)>=6) current.moved=true;
    };
    const end=(event:PointerEvent)=>{
      move(event);const current=gesture.current;
      if(current && event.pointerId===current.pointerId && (event.type==='pointercancel'||current.touch&&performance.now()-current.started>=180)) current.moved=true;
    };
    window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',end,true);window.addEventListener('pointercancel',end,true);
    return()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',end,true);window.removeEventListener('pointercancel',end,true);};
  },[]);
  function itemId(target:EventTarget|null) {
    if(!(target instanceof Element)||target.closest('button,a,input,select,textarea'))return;
    const id=target.closest<HTMLElement>('[data-inventory-item]')?.dataset.inventoryItem;
    const item=id?state.items[id]:undefined;
    return (item && (item.kind === 'spell' || item.kind === 'arcana')) || onInspectOther ? id : undefined;
  }
  function inspect(id:string,target:EventTarget|null,viaKeyboard: boolean) {
    if (!Object.hasOwn(state.items, id)) { onInspectOther?.(id, viaKeyboard); return; }
    const board = target instanceof Element ? target.closest('.inkra-inventory-grid__board') : null;
    for (const hint of board?.querySelectorAll<HTMLElement>('.wand-recipe-hints__wash[data-recipe-materials]') ?? []) {
      try {
        const ids: unknown = JSON.parse(hint.dataset.recipeMaterials ?? 'null');
        if (Array.isArray(ids) && ids.every(value => typeof value === 'string') && ids.includes(id)) {
          onInspect?.(id, ids);
          return;
        }
      } catch { /* A malformed visual hint must never prevent inspection. */ }
    }
    onInspect?.(id);
  }
  return {
    onPointerDownCapture(event:ReactPointerEvent<HTMLElement>) {
      const id=itemId(event.target);
      gesture.current=id&&event.button===0?{id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),touch:event.pointerType!=='mouse',moved:false}:null;
    },
    onClickCapture(event:MouseEvent<HTMLElement>) {
      const id=itemId(event.target);if((!onInspect&&!onInspectOther)||!id)return;
      if(event.detail!==0&&(!gesture.current||gesture.current.id!==id||gesture.current.moved))return;
      event.preventDefault();event.stopPropagation();inspect(id,event.target,event.detail===0);
    },
    onKeyDownCapture(event:KeyboardEvent<HTMLElement>) {
      const id=itemId(event.target);
      if((onInspect||onInspectOther)&&id&&event.key==='Enter'){event.preventDefault();event.stopPropagation();inspect(id,event.target,true);}
    },
  };
}
