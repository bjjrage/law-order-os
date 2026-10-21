import { randomUUID } from "node:crypto";

// Ephemeral signaling only. Media stays between explicitly joined WebRTC peers.
export function createWorkspaceCall(authorize, { auditMs = 10000, recording } = {}) {
  let closed = false;
  const rooms = new Map(),
    captures = new Map(), roomQueues = new Map(),
    watched = new WeakSet(),
    dead = new WeakSet(),
    queues = new WeakMap();
  const emit = (connection, message) => {
    try {
      connection.sendStateless(JSON.stringify({ kind: "call", ...message }));
    } catch {}
  };
  const person = (m) => ({
    id: m.id,
    name: m.name,
    muted: m.muted,
    camera: m.camera,
  });
  const publishCapture=room=>{const capture=captures.get(room);if(!capture)return;for(const m of rooms.get(room)?.values()??[])emit(m.connection,{event:"recording",capture:{session_id:capture.session_id,firm:capture.access.room.law_firm_id,capture_id:capture.capture_id,status:capture.status,recorder:capture.recorder,participants:capture.participants}})};
  const stopCapture=async room=>{const c=captures.get(room);if(!c||c.status==="STOPPED")return;c.status="STOPPED";publishCapture(room);try{await recording(c.context,c.access,"STOP",{session_id:c.session_id})}catch{for(const m of rooms.get(room)?.values()??[])emit(m.connection,{event:"recording_error",code:"RECORDING_STOP_NOT_SAVED"})}};
  const remove = (room, connection) => {
    const members = rooms.get(room),
      member = members?.get(connection.socketId);
    if (!member || member.connection !== connection) return;
    void stopCapture(room);
    members.delete(connection.socketId);
    for (const m of members.values())
      emit(m.connection, { event: "left", id: member.id });
    if (!members.size) rooms.delete(room);
  };
  async function process(room, connection, message) {
    if (closed || dead.has(connection)) return;
    const access = await authorize(connection.context.token, room, connection.context);
    if (closed || dead.has(connection)) return;
    let members = rooms.get(room),
      member = members?.get(connection.socketId);
    if (message.event === "leave") {
      remove(room, connection);
      return;
    }
    if (message.event === "join") {
      if (!member) {
        if ((members?.size ?? 0) >= 6) {
          emit(connection, { event: "error", code: "CALL_FULL" });
          return;
        }
        members ??= new Map();
        rooms.set(room, members);
        member = {
          id: randomUUID(),
          actor_id:access.grant.actor_id,
          connection,
          name: access.identity?.display_name ?? (
            access.grant.actor_id === "local-administrator"
              ? "Administrador local"
              : "Abogado local"),
          muted: true,
          camera: false,
          rate: 0,
          since: Date.now(),
        };
        const others = [...members.values()];
        await stopCapture(room);
        members.set(connection.socketId, member);
        emit(connection, {
          event: "joined",
          self: person(member),
          peers: others.map(person),
        });
        for (const other of others)
          emit(other.connection, { event: "peer", peer: person(member) });
      } else
        emit(connection, {
          event: "joined",
          self: person(member),
          peers: [...members.values()].filter((m) => m !== member).map(person),
        });
      publishCapture(room);return;
    }
    if (!member) return;
    if (Date.now() - member.since > 1000) {
      member.since = Date.now();
      member.rate = 0;
    }
    if (++member.rate > 60) return;
    try {
    if(message.event==="record-request"){
      if(!recording){emit(connection,{event:"recording_error",code:"RECORDING_REQUIRES_CENTRAL_ACCOUNTS"});return}
      if(captures.get(room)&&captures.get(room).status!=="STOPPED")return;
      const capture_id=randomUUID(),participants=[...members.values()].map(m=>({identity_id:m.actor_id,name:m.name,peer_id:m.id,consent:"PENDING",consented_at:null}));
      const saved=await recording(connection.context,access,"REQUEST",{title:"Reunión del documento",room_id:room,capture_id,participants:participants.map(({peer_id,...p})=>p)});
      captures.set(room,{session_id:saved.id,capture_id,participants,status:"CONSENTING",recorder:member.id,context:connection.context,access});publishCapture(room);return;
    }
    if(message.event==="record-consent"){
      const c=captures.get(room);if(!c||c.status!=="CONSENTING"||message.capture_id!==c.capture_id||typeof message.accept!=="boolean")return;
      const p=c.participants.find(p=>p.peer_id===member.id);if(!p)return;p.consent=message.accept?"ACCEPTED":"DECLINED";p.consented_at=new Date().toISOString();
      await recording(connection.context,access,"CONSENT",{session_id:c.session_id,participants:c.participants.map(({peer_id,...p})=>p)});
      if(!message.accept){await stopCapture(room);return}
      if(c.participants.every(p=>p.consent==="ACCEPTED")){
        // Membership is checked again immediately before starting the capture.
        for(const m of members.values())await authorize(m.connection.context.token,room,m.connection.context);
        if(c.status==="STOPPED")return;await recording(c.context,c.access,"START",{session_id:c.session_id});if(c.status==="STOPPED"){await recording(c.context,c.access,"STOP",{session_id:c.session_id});return}c.status="RECORDING";
      }
      publishCapture(room);return;
    }
    if(message.event==="record-stop"){await stopCapture(room);return}
    }catch{
      emit(connection,{event:"recording_error",code:"RECORDING_OPERATION_FAILED"});
      await stopCapture(room);return;
    }
    if (message.event === "mute" && typeof message.muted === "boolean") {
      member.muted = message.muted;
      for (const other of members.values())
        emit(other.connection, {
          event: "mute",
          id: member.id,
          muted: member.muted,
        });
    } else if (
      message.event === "camera" &&
      typeof message.camera === "boolean"
    ) {
      member.camera = message.camera;
      for (const other of members.values())
        emit(other.connection, {
          event: "camera",
          id: member.id,
          camera: member.camera,
        });
    } else if (message.event === "signal" && typeof message.to === "string") {
      const target = [...members.values()].find(
        (m) => m.id === message.to && m !== member,
      );
      if (!target) return;
      // Both ends must still have access; sender identity and room are never client claims.
      try {
        await authorize(target.connection.context.token, room, target.connection.context);
      } catch {
        emit(target.connection, {
          event: "ended",
          code: "WORKSPACE_ACCESS_DENIED",
        });
        remove(room, target.connection);
        return;
      }
      if (
        dead.has(connection) ||
        members.get(connection.socketId) !== member ||
        members.get(target.connection.socketId) !== target
      )
        return;
      const s = message.description,
        c = message.candidate;
      if (
        s &&
        ["offer", "answer"].includes(s.type) &&
        typeof s.sdp === "string" &&
        s.sdp.length <= 48000
      )
        emit(target.connection, {
          event: "signal",
          from: member.id,
          description: { type: s.type, sdp: s.sdp },
        });
      else if (
        c &&
        typeof c.candidate === "string" &&
        c.candidate.length <= 4096 &&
        (c.sdpMid === null || typeof c.sdpMid === "string") &&
        (c.sdpMLineIndex === null || Number.isInteger(c.sdpMLineIndex))
      )
        emit(target.connection, {
          event: "signal",
          from: member.id,
          candidate: {
            candidate: c.candidate,
            sdpMid: c.sdpMid,
            sdpMLineIndex: c.sdpMLineIndex,
          },
        });
    }
  }
  const audit = async () => {
    for (const [room, members] of rooms)
      for (const m of [...members.values()]) {
        try {
          await authorize(m.connection.context.token, room, m.connection.context);
        } catch {
          emit(m.connection, {
            event: "ended",
            code: "WORKSPACE_ACCESS_DENIED",
          });
          remove(room, m.connection);
        }
      }
  };
  const timer = setInterval(() => void audit(), auditMs);
  timer.unref?.();
  return {
    handle(room, connection, payload) {
      if (payload.length > 64000) return Promise.resolve();
      let message;
      try {
        message = JSON.parse(payload);
      } catch {
        return Promise.resolve();
      }
      if (message?.kind !== "call") return Promise.resolve();
      if(typeof message.event!=="string"||!["join","leave","mute","camera","signal","record-request","record-consent","record-stop"].includes(message.event))return Promise.resolve();
      if (!watched.has(connection)) {
        watched.add(connection);
        connection.callbacks.onClose.push(() => {
          dead.add(connection);
          remove(room, connection);
        });
      }
      const roomOperation=message.event.startsWith("record-")||["join","leave"].includes(message.event);
      const task = ((roomOperation?roomQueues.get(room):queues.get(connection)) ?? Promise.resolve())
        .catch(() => {})
        .then(() => process(room, connection, message))
        .catch(() => {
          emit(connection, { event: "ended", code: "WORKSPACE_ACCESS_DENIED" });
          remove(room, connection);
        });
      if(roomOperation)roomQueues.set(room,task);else queues.set(connection, task);
      return task;
    },
    revoke(room, actor) {
      for (const m of [...(rooms.get(room)?.values() ?? [])])
        if (!actor || m.connection.context.grant.actor_id === actor) {
          emit(m.connection, {
            event: "ended",
            code: "WORKSPACE_ACCESS_DENIED",
          });
          remove(room, m.connection);
        }
    },
    audit,
    async close() {
      closed = true;
      clearInterval(timer);
      await Promise.allSettled([...captures.keys()].map(stopCapture));
      for (const members of rooms.values())
        for (const m of members.values())
          emit(m.connection, { event: "ended", code: "WORKSPACE_RESTARTING" });
      rooms.clear();
    },
  };
}
