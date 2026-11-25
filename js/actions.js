import * as db from "./db.js";
import { save } from "./autosave.js";
import { state, getSession, putLocal, allSessions, otherUid } from "./state.js";
import { DELETE, DEFAULT_SETS_PLAN, newExerciseEntry, byName } from "./model.js";

const stateOf = (uid, exId) => state.states[`${uid}_${exId}`];

export function createSession({ uid, date, status, planId = null, groupId = null, exerciseIds = [] }) {
  const exercises = {};
  for (const id of exerciseIds) exercises[id] = newExerciseEntry(state.exercises[id], stateOf(uid, id), undefined, DEFAULT_SETS_PLAN);
  const data = { uid, date, status, planId, groupId, notes: "", exercises };
  const id = db.createDoc("sessions", data);
  putLocal("sessions", id, data);
  return id;
}

export function createSessions({ date, who, planId, status }) {
  const me = state.uid;
  const other = otherUid(me);
  const plan = planId ? state.plans[planId] : null;
  const make = (uid, groupId) =>
    createSession({ uid, date, status, planId: planId || null, groupId, exerciseIds: plan?.byUser?.[uid] ?? [] });
  if (who === "both") {
    const groupId = crypto.randomUUID();
    const mine = make(me, groupId);
    make(other, groupId);
    return { id: mine, together: true };
  }
  return { id: make(who === "other" ? other : me, null), together: false };
}

export function addExercises(sid, ids) {
  const s = getSession(sid);
  const fields = {};
  for (const id of ids) fields[`exercises.${id}`] = newExerciseEntry(state.exercises[id], stateOf(s.uid, id));
  save(sid, fields, { immediate: true });
}

export function removeExercise(sid, id) {
  save(sid, { [`exercises.${id}`]: DELETE }, { immediate: true });
}

export function swapExercise(sid, oldId, newId) {
  const s = getSession(sid);
  const origin = s.exercises?.[oldId]?.swappedFrom ?? oldId;
  save(
    sid,
    {
      [`exercises.${oldId}`]: DELETE,
      [`exercises.${newId}`]: newExerciseEntry(state.exercises[newId], stateOf(s.uid, newId), origin)
    },
    { immediate: true }
  );
}

export function addSet(sid, exId) {
  const ex = getSession(sid).exercises?.[exId];
  const keys = Object.keys(ex?.sets ?? {}).map(Number);
  const next = (keys.length ? Math.max(...keys) : 0) + 1;
  const prev = ex?.sets?.[Math.max(...keys)];
  const kg = typeof prev?.kg === "number" ? prev.kg : stateOf(getSession(sid).uid, exId)?.kg ?? 0;
  save(sid, { [`exercises.${exId}.sets.${next}`]: { reps: null, kg } }, { immediate: true });
}

export function duplicateSet(sid, exId) {
  const ex = getSession(sid).exercises?.[exId];
  const keys = Object.keys(ex?.sets ?? {}).map(Number);
  if (!keys.length) return;
  const last = Math.max(...keys);
  const src = ex.sets[last];
  save(
    sid,
    {
      [`exercises.${exId}.sets.${last + 1}.reps`]: src.reps ?? null,
      [`exercises.${exId}.sets.${last + 1}.kg`]: src.kg ?? 0
    },
    { immediate: true }
  );
}

export function removeSet(sid, exId, n) {
  save(sid, { [`exercises.${exId}.sets.${n}`]: DELETE }, { immediate: true });
}

export function linkTogether(sid) {
  const s = getSession(sid);
  const otherId = otherUid(s.uid);
  const groupId = s.groupId || crypto.randomUUID();
  const sessions = allSessions();
  let mate = sessions.find((x) => x.uid === otherId && x.groupId === groupId);
  if (!mate) mate = sessions.find((x) => x.uid === otherId && x.date === s.date && !x.groupId);
  if (!s.groupId) save(sid, { groupId }, { immediate: true });
  if (mate) {
    if (mate.groupId !== groupId) save(mate.id, { groupId }, { immediate: true });
  } else {
    createSession({ uid: otherId, date: s.date, status: s.status, groupId });
  }
}

export function createPlan(name, byUser) {
  const data = { name, byUser };
  const id = db.createDoc("plans", data);
  putLocal("plans", id, data);
  return id;
}

export function exerciseIdsOf(session) {
  return Object.keys(session.exercises ?? {}).sort(byName(state.exercises));
}
