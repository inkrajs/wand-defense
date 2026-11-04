/** Fit each wand into an equal horizontal share. Logical grid cells remain unchanged. */
export function fitWandSlots(availableWidth: number, wands: readonly {width:number;height:number}[], cellSize: number, padding = 22, gap = 24) {
  const count = Math.max(1,wands.length);
  const natural = wands.map(wand=>({width:wand.width*cellSize+6,height:wand.height*cellSize+6}));
  const largest = Math.max(6,...natural.map(size=>size.width));
  const slotWidth = Math.min(largest,Math.max(1,((availableWidth || largest*count+padding*2+gap*(count-1))-padding*2-gap*(count-1))/count));
  return {slotWidth,padding,gap,slots:natural.map(size=>({...size,scale:Math.min(1,slotWidth/size.width)}))};
}
