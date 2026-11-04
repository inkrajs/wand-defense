import {useEffect,useRef,type PointerEvent as ReactPointerEvent,type MouseEvent,type KeyboardEvent} from 'react';
import type {GameState} from '../contracts';

/** A tap inspects; moving, cancelling or touch-holding remains the inventory drag gesture. */
export function useMagicInspectGesture(state:Pick<GameState,'items'>,onInspect?: (itemId:string)=>void) {
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
    return item&&(item.kind==='spell'||item.kind==='arcana')?id:undefined;
  }
  return {
    onPointerDownCapture(event:ReactPointerEvent<HTMLElement>) {
      const id=itemId(event.target);
      gesture.current=id&&event.button===0?{id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),touch:event.pointerType!=='mouse',moved:false}:null;
    },
    onClickCapture(event:MouseEvent<HTMLElement>) {
      const id=itemId(event.target);if(!onInspect||!id)return;
      if(event.detail!==0&&(!gesture.current||gesture.current.id!==id||gesture.current.moved))return;
      event.preventDefault();event.stopPropagation();onInspect(id);
    },
    onKeyDownCapture(event:KeyboardEvent<HTMLElement>) {
      const id=itemId(event.target);
      if(onInspect&&id&&event.key==='Enter'){event.preventDefault();event.stopPropagation();onInspect(id);}
    },
  };
}
