import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createBrokerServer } from '../../server/broker';
import { createBrowserConnection } from './connection';
import { createGameRuntime } from '../runtime';
import { demoContent } from '../content/demo';
import type { CommandResult } from '../contracts';

const until = async (predicate:()=>Promise<boolean>) => {
  const deadline=Date.now()+5000;
  while(Date.now()<deadline) {
    if(await predicate()) return;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  assert.fail('Timed out waiting for broker/browser roundtrip');
};
test('browser runtime roundtrip distinguishes queue/execute, pairs CLI and streams projected events', async () => {
  const broker=createBrokerServer();
  const {port}=await broker.listen(0,'127.0.0.1');
  const url=`http://127.0.0.1:${port}`;
  const runtime=createGameRuntime(demoContent);
  let session:{sessionId:string;browserToken:string;pairCode?:string}|undefined;
  const connection=createBrowserConnection(runtime,{baseUrl:url,content:demoContent,pollMs:50,onSession:s=>{session=s}});
  const request=async(path:string,token?:string,body?:unknown)=>fetch(`${url}${path}`,{
    method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  try {
    await until(async()=>!!session);
    const cliOutput=await promisify(execFile)(process.execPath,['--import','tsx',fileURLToPath(new URL('../../cli/index.ts',import.meta.url)),'pair',session!.pairCode!,'--url',url]);
    const paired=JSON.parse(cliOutput.stdout) as {agentToken:string};
    const path=`/sessions/${session!.sessionId}`;
    const token=paired.agentToken;
    await until(async()=>!!(await (await request(`${path}/state`,token)).json()));
    const command={id:'integration-pause',type:'setPaused',paused:true};
    const accepted=await (await request(`${path}/commands`,token,command)).json() as CommandResult;
    assert.equal(accepted.status,'accepted');
    await until(async()=>{
      const result=await (await request(`${path}/results/${command.id}`,token)).json() as CommandResult;
      return result.status==='executed';
    });
    assert.equal(runtime.getState().paused,true);
    const revision=runtime.getState().revision;
    const duplicate=await (await request(`${path}/commands`,token,command)).json() as CommandResult;
    assert.equal(duplicate.status,'executed');
    assert.equal(runtime.getState().revision,revision);
    assert.equal((await request(`${path}/commands`,token,{...command,paused:false})).status,409);
    assert.equal((await request(`${path}/frame`,token,{})).status,403);
    assert.equal((await request(`${path}/commands`,session!.browserToken)).status,200);
    assert.equal((await request(`${path}/commands`,token)).status,403);
    const events=await (await request(`${path}/events?after=0`,token)).json() as {events:{type:string}[]};
    assert.ok(events.events.some(e=>e.type==='pause.changed'));
    const sseController=new AbortController();
    const stream=await fetch(`${url}${path}/events/stream?after=0`,{headers:{Authorization:`Bearer ${token}`},signal:sseController.signal});
    assert.equal(stream.headers.get('content-type'),'text/event-stream');
    assert.ok((await stream.body!.getReader().read()).value!.length>0);
    sseController.abort();
    const other=await (await request('/sessions',undefined,{})).json() as {sessionId:string};
    assert.equal((await request(`/sessions/${other.sessionId}/state`,token)).status,401);
  } finally {
    connection.close();runtime.dispose();await broker.close();
  }
});
