import { expect, it } from "vitest";
// @ts-expect-error Local host uses native ESM.
import { createWorkspaceCall } from "../../scripts/workspace-call.mjs";

it("does not resurrect a call when access validation finishes after the socket closed", async () => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    entered = new Promise<void>((resolve) => {
      started = resolve;
    });
  const call = createWorkspaceCall(async () => {
    started();
    await gate;
    return { grant: { actor_id: "local-lawyer" } };
  });
  const received: unknown[] = [],
    connection = {
      socketId: "slow",
      context: { token: "token" },
      callbacks: { onClose: [] as Array<() => void> },
      sendStateless: (value: string) => received.push(JSON.parse(value)),
    };
  try {
    const joining = call.handle(
      "room",
      connection,
      JSON.stringify({ kind: "call", event: "join" }),
    );
    await entered;
    connection.callbacks.onClose.forEach((fn) => fn());
    release();
    await joining;
    expect(received).toHaveLength(0);
  } finally {
    release();
    call.close();
  }
});

function fixture(options:Record<string,unknown>={}) {
  const grants = new Map<string, { room: string; actor: string }>();
  const authorize = async (token: string, room: string) => {
    const grant = grants.get(token);
    if (!grant || grant.room !== room) throw Error("WORKSPACE_ACCESS_DENIED");
    return { grant: { actor_id: grant.actor } };
  };
  const call = createWorkspaceCall(async(...args:any[])=>({...await authorize(args[0],args[1]),room:{law_firm_id:"firm",matter_id:"matter"}}),options);
  function client(id: string, room = "room", actor = "local-lawyer") {
    grants.set(id, { room, actor });
    const received: any[] = [];
    const connection = {
      socketId: id,
      context: { token: id, grant: { actor_id: actor } },
      callbacks: { onClose: [] as Array<() => void> },
      sendStateless: (payload: string) => received.push(JSON.parse(payload)),
    };
    return {
      received,
      connection,
      send: (message: object) =>
        call.handle(
          room,
          connection,
          JSON.stringify({ kind: "call", ...message }),
        ),
      close: () => connection.callbacks.onClose.forEach((fn) => fn()),
    };
  }
  return { call, client, grants };
}
it("starts recording only after every participant consents and stops on denial, join or disconnect",async()=>{
 const events:any[]=[],f=fixture({recording:async(_context:any,_access:any,event:string,data:any)=>{events.push({event,data});return{id:"session-"+events.length}}});
 const capture=(client:any)=>client.received.filter((m:any)=>m.event==="recording").at(-1)?.capture;
 try{const a=f.client("a","room","director"),b=f.client("b","room","lawyer");await a.send({event:"join"});await b.send({event:"join"});await a.send({event:"record-request"});let c=capture(a);expect(c.status).toBe("CONSENTING");await a.send({event:"record-consent",capture_id:c.capture_id,accept:true});expect(events.some(e=>e.event==="START")).toBe(false);await b.send({event:"record-consent",capture_id:c.capture_id,accept:false});expect(capture(a).status).toBe("STOPPED");expect(events.some(e=>e.event==="START")).toBe(false);
 await a.send({event:"record-request"});c=capture(a);await a.send({event:"record-consent",capture_id:c.capture_id,accept:true});await b.send({event:"record-consent",capture_id:c.capture_id,accept:true});expect(capture(a).status).toBe("RECORDING");const third=f.client("c");await third.send({event:"join"});expect(capture(a).status).toBe("STOPPED");expect(events.filter(e=>e.event==="START")).toHaveLength(1);
 await third.send({event:"record-request"});c=capture(third);for(const p of [a,b,third])await p.send({event:"record-consent",capture_id:c.capture_id,accept:true});expect(capture(a).status).toBe("RECORDING");b.close();expect(capture(a).status).toBe("STOPPED");
 }finally{f.call.close()}
});
it("only signals between opted-in participants of the same authorized document, with server identities", async () => {
  const f = fixture();
  try {
    const a = f.client("a", "room", "local-administrator"),
      b = f.client("b"),
      outsider = f.client("x", "other"),
      silent = f.client("silent");
    await a.send({ event: "join", name: "Forged" });
    await b.send({ event: "join" });
    await outsider.send({ event: "join" });
    const aid = a.received.find((m) => m.event === "joined").self.id,
      bid = b.received.find((m) => m.event === "joined").self.id;
    expect(a.received[0].self.name).toBe("Administrador local");
    expect(a.received[0].self.muted).toBe(true);
    await a.send({
      event: "signal",
      to: bid,
      from: "Forged",
      description: { type: "offer", sdp: "synthetic" },
    });
    expect(b.received.at(-1)).toMatchObject({
      event: "signal",
      from: aid,
      description: { sdp: "synthetic" },
    });
    const count = b.received.length;
    await outsider.send({
      event: "signal",
      to: bid,
      description: { type: "offer", sdp: "wrong-room" },
    });
    await silent.send({
      event: "signal",
      to: bid,
      description: { type: "offer", sdp: "not-joined" },
    });
    expect(b.received).toHaveLength(count);
    await a.send({ event: "mute", muted: false });
    expect(b.received.at(-1)).toMatchObject({
      event: "mute",
      id: aid,
      muted: false,
    });
    await a.send({ event: "leave" });
    expect(b.received.at(-1)).toMatchObject({ event: "left", id: aid });
    const after = b.received.length;
    await a.send({
      event: "signal",
      to: bid,
      description: { type: "offer", sdp: "after-leave" },
    });
    expect(b.received).toHaveLength(after);
  } finally {
    f.call.close();
  }
});
it("removes disconnected/revoked/expired participants and bounds the room", async () => {
  const f = fixture();
  try {
    const peers = Array.from({ length: 7 }, (_, i) => f.client(String(i)));
    for (const p of peers) await p.send({ event: "join" });
    expect(peers[6]!.received.at(-1)).toMatchObject({
      event: "error",
      code: "CALL_FULL",
    });
    peers[0]!.close();
    expect(peers[1]!.received.at(-1).event).toBe("left");
    await peers[6]!.send({ event: "join" });
    expect(peers[6]!.received.at(-1).event).toBe("joined");
    f.grants.delete("1");
    await f.call.audit();
    expect(peers[1]!.received.at(-1).event).toBe("ended");
    f.call.revoke("room", "local-lawyer");
    expect(peers[2]!.received.some((m) => m.event === "ended")).toBe(true);
  } finally {
    f.call.close();
  }
});

it("shares camera state only inside the joined room and includes it for late arrivals", async () => {
  const f = fixture();
  try {
    const a = f.client("a"),
      b = f.client("b"),
      outsider = f.client("outside", "other"),
      silent = f.client("silent");
    await a.send({ event: "join" });
    expect(a.received[0].self.camera).toBe(false);
    await outsider.send({ event: "join" });
    await a.send({ event: "camera", camera: true, id: "forged" });
    await b.send({ event: "join" });
    const person = b.received[0].peers[0];
    expect(person.camera).toBe(true);
    const count = b.received.length;
    await silent.send({ event: "camera", camera: true });
    await outsider.send({ event: "camera", camera: true });
    await a.send({ event: "camera", camera: "false" });
    expect(b.received).toHaveLength(count);
    await a.send({ event: "camera", camera: false });
    expect(b.received.at(-1)).toMatchObject({
      event: "camera",
      id: person.id,
      camera: false,
    });
    await a.send({ event: "leave" });
    const afterLeave = b.received.length;
    await a.send({ event: "camera", camera: true });
    expect(b.received).toHaveLength(afterLeave);
    expect(outsider.received.filter((m) => m.event === "camera")).toHaveLength(
      1,
    );
  } finally {
    f.call.close();
  }
});
