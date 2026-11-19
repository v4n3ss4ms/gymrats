import * as db from "./db.js";
import { state, getSession, overlaySet, overlayFlushed, notify } from "./state.js";
import { DELETE, setPath, lastRepsSet, MAX_KG } from "./model.js";

const DEBOUNCE_MS = 500;
const pending = new Map();
let timer = null;

function addPending(p, path, value) {
  for (const k of [...p.fields.keys()]) {
    if (k.startsWith(path + ".")) {
      p.fields.delete(k);
    } else if (path.startsWith(k + ".")) {
      const anc = p.fields.get(k);
      if (anc === DELETE) return;
      const clone = structuredClone(anc);
      setPath(clone, path.slice(k.length + 1), value);
      p.fields.set(k, clone);
      return;
    }
  }
  p.fields.set(path, value);
}

export function save(sid, fields, { immediate = false } = {}) {
  let p = pending.get(sid);
  if (!p) pending.set(sid, (p = { fields: new Map(), touched: new Set(), all: false }));
  for (const [path, value] of Object.entries(fields)) {
    addPending(p, path, value);
    overlaySet(sid, path, value);
    const m = /^exercises\.([^.]+)(\.|$)/.exec(path);
    if (m) p.touched.add(m[1]);
    if (path === "status" || path === "date") p.all = true;
  }
  notify();
  if (immediate) flush();
  else {
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }
}

export function flush() {
  clearTimeout(timer);
  timer = null;
  for (const [sid, p] of [...pending]) {
    pending.delete(sid);
    db.updateFields("sessions", sid, Object.fromEntries(p.fields));
    overlayFlushed(sid);
    syncExerciseStates(sid, p);
  }
}

function syncExerciseStates(sid, p) {
  const s = getSession(sid);
  if (!s || s.status === "planned") return;
  const ids = p.all ? Object.keys(s.exercises ?? {}) : [...p.touched];
  for (const id of ids) {
    const ex = s.exercises?.[id];
    const last = ex && lastRepsSet(ex);
    if (!last || !Number.isFinite(last.kg) || last.kg < 0 || last.kg > MAX_KG) continue;
    const key = `${s.uid}_${id}`;
    const cur = state.states[key];
    if (cur && s.date < cur.date) continue;
    const next = {
      uid: s.uid,
      exerciseId: id,
      kg: last.kg,
      reps: last.reps,
      adjustment: ex.adjustment || null,
      date: s.date
    };
    if (cur && cur.kg === next.kg && cur.reps === next.reps && cur.adjustment === next.adjustment && cur.date === next.date) continue;
    state.states[key] = { ...next, id: key };
    db.saveExerciseState(key, next);
  }
}
