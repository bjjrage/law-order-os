// The browser bridge can only run the offline demo. A future network regression must fail closed.
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";
const blocked = () => {
  throw Error("OFFLINE_DEMO_NETWORK_BLOCKED");
};
globalThis.fetch = blocked;
http.request = blocked;
http.get = blocked;
https.request = blocked;
https.get = blocked;
net.connect = blocked;
net.createConnection = blocked;
tls.connect = blocked;
syncBuiltinESMExports();
