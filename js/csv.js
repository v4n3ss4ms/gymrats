import { state, allSessions, person } from "./state.js";
import { setKeys, byName, todayStr } from "./model.js";

const HEADER = ["date", "user", "exercise", "set", "reps", "kg", "adjustment", "session_status", "session_notes", "plan", "trained_with"];

function esc(v) {
  const s = String(v ?? "");
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const num = (n) => (n == null ? "" : String(n).replace(".", ","));

export function buildRows({ uid = "", from = "", to = "" } = {}) {
  const sessions = allSessions()
    .filter((s) => (!uid || s.uid === uid) && (!from || s.date >= from) && (!to || s.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));
  const rows = [];
  for (const s of sessions) {
    const mate = s.groupId ? allSessions().find((x) => x.id !== s.id && x.groupId === s.groupId && x.uid !== s.uid) : null;
    const plan = s.planId ? state.plans[s.planId]?.name ?? "" : "";
    const ids = Object.keys(s.exercises ?? {}).sort(byName(state.exercises));
    for (const id of ids) {
      const ex = s.exercises[id];
      for (const k of setKeys(ex)) {
        const set = ex.sets[k];
        rows.push([
          s.date, person(s.uid).name, state.exercises[id]?.name ?? id, k, num(set.reps), num(set.kg),
          ex.adjustment ?? "", s.status, s.notes ?? "", plan, mate ? person(mate.uid).name : ""
        ]);
      }
    }
  }
  return rows;
}

export function buildCsv(filter) {
  const lines = [HEADER, ...buildRows(filter)].map((r) => r.map(esc).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function downloadCsv(filter) {
  const blob = new Blob([buildCsv(filter)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gym-${todayStr()}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return buildRows(filter).length;
}
