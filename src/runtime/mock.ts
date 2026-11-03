import type { RuntimePort, GameState, GameEvent } from "../contracts";
import { createInitialState } from "./initial";
export { createInitialState as createFixtureState } from "./initial";
/** UI fixture adapter only. Does not pretend to simulate a playable game. */
export function createMockRuntime(): RuntimePort {
  let state=createInitialState();
  const listeners=new Set<(s: GameState,e: GameEvent[])=>void>();
  return {
    getState:()=>structuredClone(state),
    dispatch(command){
      if(command.type==="setBackpack") state={...state,backpackOpen:command.open,paused:command.open};
      else if(command.type==="setPaused") state={...state,paused:command.paused};
      else return {commandId:command.id,status:"rejected",revision:state.revision,code:"MOCK_ONLY",message:"等待真实运行时接入"};
      state.revision++;
      for(const listener of listeners) listener(structuredClone(state),[]);
      return {commandId:command.id,status:"executed",revision:state.revision};
    },
    subscribe(listener){listeners.add(listener);return ()=>{listeners.delete(listener)}}
  };
}

