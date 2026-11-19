import * as db from "./db.js";
import { USERS } from "./config.js";
import { setPath, DELETE } from "./model.js";

const COLS = ["users", "exercises", "plans", "sessions", "userExerciseState"];
const KEY = { userExerciseState: "states" };

export const state = {
  uid: null,
  users: {},
  exercises: {},
  plans: {},
  sessions: {},
  states: {},
  loaded: {},
  pendingFlags: {},
  online: navigator.onLine
};

const SEED = Object.fromEntries(Object.values(USERS).map((u) => [u.uid, u]));
export const UIDS = Object.keys(SEED);
export const SEED_DOCS = SEED;

export function person(uid) {
  return { ...(SEED[uid] ?? { name: "?", color: "#888888", imagePath: "" }), ...(state.users[uid] ?? {}) };
}
export const otherUid = (uid) => UIDS.find((u) => u !== uid);

const listeners = new Set();
let scheduled = false;
let unsubs = [];
const overlay = new Map();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    listeners.forEach((f) => f());
  });
}

window.addEventListener("online", () => {
  state.online = true;
  notify();
});
window.addEventListener("offline", () => {
  state.online = false;
  notify();
});

export function isReady() {
  return COLS.every((c) => state.loaded[c]);
}

export function hasPending() {
  return Object.values(state.pendingFlags).some(Boolean) || overlay.size > 0;
}

export function start(uid, onListenError) {
  stop();
  state.uid = uid;
  for (const col of COLS) {
    const key = KEY[col] ?? col;
    unsubs.push(
      db.listen(
        col,
        (map, meta) => {
          state[key] = map;
          state.loaded[col] = true;
          state.pendingFlags[col] = meta.hasPendingWrites;
          if (col === "sessions") dropFlushed();
          notify();
        },
        (err) => onListenError?.(col, err)
      )
    );
  }
}

export function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  overlay.clear();
  Object.assign(state, {
    uid: null, users: {}, exercises: {}, plans: {}, sessions: {}, states: {}, loaded: {}, pendingFlags: {}
  });
}

export function putLocal(col, id, data) {
  state[KEY[col] ?? col][id] = { ...data, id };
  notify();
}

export function overlaySet(sid, path, value) {
  let m = overlay.get(sid);
  if (!m) overlay.set(sid, (m = new Map()));
  m.delete(path);
  m.set(path, { value, flushed: false });
}

export function overlayFlushed(sid) {
  overlay.get(sid)?.forEach((e) => (e.flushed = true));
}

function dropFlushed() {
  for (const [sid, m] of overlay) {
    for (const [p, e] of m) if (e.flushed) m.delete(p);
    if (!m.size) overlay.delete(sid);
  }
}

export function getSession(sid) {
  const base = state.sessions[sid];
  const ov = overlay.get(sid);
  if (!base || !ov || !ov.size) return base;
  const copy = structuredClone(base);
  for (const [p, { value }] of ov) setPath(copy, p, value === DELETE ? value : structuredClone(value));
  return copy;
}

export function allSessions() {
  return Object.keys(state.sessions).map(getSession);
}

export function findMate(s) {
  if (!s?.groupId) return null;
  return allSessions().find((x) => x.id !== s.id && x.groupId === s.groupId && x.uid !== s.uid) ?? null;
}
