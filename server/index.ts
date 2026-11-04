import { createBrokerServer } from "./broker.js";

const port = Number(process.env.PORT ?? "8787");
const host = process.env.BROKER_HOST ?? "0.0.0.0";

const broker = createBrokerServer();
const bound = await broker.listen(Number.isSafeInteger(port) && port >= 0 ? port : 8787, host);

console.log(`杀死那个巫师 Playlink broker listening on http://${bound.host}:${bound.port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void broker.close().then(() => process.exit(0));
  });
}
