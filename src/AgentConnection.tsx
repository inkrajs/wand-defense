import { useEffect, useState } from "react";
import { Button, PencilText } from "@inkra/react";
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
  return <section className="agent-connection" aria-label="Agent 连接" style={{overflowWrap:"anywhere"}}>
    <PencilText as="p" seed="agent-status">{`服务地址：${brokerUrl} · ${status}`}</PencilText>
    <Button variant="outline" onClick={()=>setConnected(value=>!value)}>{connected?"断开连接":"连接 HTTP 服务"}</Button>
    {session?.pairCode && <PencilText as="p" seed="agent-pair">{`配对码：${session.pairCode}`}</PencilText>}
    {session && <PencilText as="p" seed="agent-session">{`会话：${session.sessionId}`}</PencilText>}
    <PencilText as="p" seed="agent-instructions">先启动 npm run broker，再连接。将配对码交给你允许控制本局的 Agent。</PencilText>
  </section>;
}
