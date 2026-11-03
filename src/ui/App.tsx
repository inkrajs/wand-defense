import type { RuntimePort } from "../contracts";
export function App({ runtime }: {runtime: RuntimePort}) { return <main><h1>法杖守城</h1><p>试玩原型开发中 · 当前波次 {runtime.getState().wave}</p></main>; }

