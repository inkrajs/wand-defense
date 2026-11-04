import type {ReactNode} from 'react';
import './FittedWand.css';

/** Native CSS zoom participates in layout; InventoryGrid reads the scaled client rect for dragging. */
export function FittedWand({slotWidth,width,height,scale,children,action}: {
  slotWidth:number;width:number;height:number;scale:number;children:ReactNode;action:ReactNode;
}) {
  return <div className="fitted-wand" style={{width:slotWidth}}>
    <div className="fitted-wand__frame" style={{width:width*scale,height:height*scale}}>
      <div className="fitted-wand__grid" style={{width,height,zoom:scale}}>{children}</div>
      <div className="fitted-wand__action">{action}</div>
    </div>
  </div>;
}
