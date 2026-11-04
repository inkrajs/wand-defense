import { useLayoutEffect, useState, type RefObject } from "react";
import type { BeamLayout } from "./beamVisuals";

/** Shared presentation anchors, measured from the actual clickable character. */
export function useCombatLayout(ref:RefObject<HTMLDivElement|null>,characterIds:string):BeamLayout {
  const [layout,setLayout]=useState<BeamLayout>({width:0,height:0,sources:{}});
  useLayoutEffect(()=>{
    const node=ref.current;if(!node)return;
    const heroes=Array.from(node.parentElement?.querySelectorAll<HTMLElement>(".battlefield__hero[data-character-id]")??[]);
    const measure=()=>{
      const bounds=node.getBoundingClientRect(),sources:BeamLayout["sources"]={};
      for(const hero of heroes) {
        const rectangle=hero.getBoundingClientRect();
        sources[hero.dataset.characterId!]={x:rectangle.left+rectangle.width/2-bounds.left,y:rectangle.top+rectangle.height/2-bounds.top};
      }
      setLayout({width:bounds.width,height:bounds.height,sources});
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(node);
    heroes.forEach(hero=>{
      observer.observe(hero);
      // Measure HUD row layout changes as well as the fixed-size hero.
      if(hero.parentElement) observer.observe(hero.parentElement);
    });
    return ()=>observer.disconnect();
  },[ref,characterIds]);
  return layout;
}
