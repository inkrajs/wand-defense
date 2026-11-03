import { useEffect, useState } from "react";
import type { ContentCatalog, RuntimePort } from "./contracts";
import { createBrowserConnection } from "./agent/connection";

const brokerUrl = import.meta.env.VITE_PLAYLINK_URL || location.protocol + "//" + location.hostname + ":8787";
export function AgentConnection({runtime,content}: {runtime:RuntimePort;content:ContentCatalog}) {
  const [connected,setConnected]=useState(false);
  const [status,setStatus]=useState("未连接");
  const [session,setSession]=useState<{sessionId:string;pairCode?:string}>();
  useEffect(()=>{
    if (!connected) return;
    const connection=createBrowserConnection(runtime,{
      baseUrl:brokerUrl, content,
      onSession(value){setSession({sessionId:value.sessionId,pairCode:value.pairCode})},
      onStatus:setStatus
    });
    return ()=>{connection.close();setSession(undefined)};
  },[connected,runtime,content]);
  return <details style={{maxWidth:1200,margin:"1rem auto",padding:"1rem"}}>
    <summary>Agent 连接</summary>
    <p>服务地址：{brokerUrl} · {status}</p>
    <button type="button" onClick={()=>setConnected(value=>!value)} style={{minHeight:44,padding:"0.5rem 1rem"}}>{connected?"断开连接":"连接 HTTP 服务"}</button>
    {session?.pairCode && <p>配对码：<strong>{session.pairCode}</strong></p>}
    {session && <p>会话：{session.sessionId}</p>}
    <p>先启动 npm run broker，再连接。将配对码交给你允许控制本局的 Agent。</p>
  </details>;
}

