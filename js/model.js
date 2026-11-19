export const DELETE = Symbol("delete");
export const DEFAULT_SETS = 3;
export const ADJUSTMENT_CHIPS = ["mín", "máx", "rodillas", "caderas", "cintura", "pecho", "hombros", "cabeza"];
export const STATUS_LABEL = { planned: "Planificado", in_progress: "En curso", done: "Hecho" };
export const MAX_KG = 1000;

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function norm(s) {
  return String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] == null || typeof o[k] !== "object") o[k] = {};
    o = o[k];
  }
  const last = keys[keys.length - 1];
  if (value === DELETE) delete o[last];
  else o[last] = value;
}

export function setKeys(ex) {
  return Object.keys(ex?.sets ?? {}).sort((a, b) => a - b);
}

export function hasReps(set) {
  return typeof set?.reps === "number";
}

export function isExerciseDone(ex) {
  const ks = setKeys(ex);
  return ks.length > 0 && ks.every((k) => hasReps(ex.sets[k]));
}

export function anyReps(ex) {
  return setKeys(ex).some((k) => hasReps(ex.sets[k]));
}

export function lastRepsSet(ex) {
  let r = null;
  for (const k of setKeys(ex)) if (hasReps(ex.sets[k])) r = ex.sets[k];
  return r;
}

export function parseDecimal(text) {
  const t = String(text).trim().replace(",", ".");
  if (t === "") return { empty: true };
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(t)) return { error: true };
  return { value: Number(t) };
}

export function parseReps(text) {
  const t = String(text).trim();
  if (t === "") return { empty: true };
  if (!/^\d{1,4}$/.test(t)) return { error: true };
  return { value: Number(t) };
}

export function fmtInput(n) {
  return n == null || n === 0 ? "" : String(n).replace(".", ",");
}

export function newExerciseEntry(exercise, st, swappedFrom) {
  const kg = typeof st?.kg === "number" ? st.kg : 0;
  const sets = {};
  for (let i = 1; i <= DEFAULT_SETS; i++) sets[i] = { reps: null, kg };
  const e = { sets };
  if (exercise?.hasAdjustment && st?.adjustment) e.adjustment = st.adjustment;
  if (swappedFrom) e.swappedFrom = swappedFrom;
  return e;
}

export function byName(catalog) {
  return (a, b) =>
    (catalog[a]?.name ?? "").localeCompare(catalog[b]?.name ?? "", "es", { sensitivity: "base" });
}

export function safeImagePath(p) {
  if (typeof p !== "string") return "";
  if (!/^images\/[\w\-./ ]+$/.test(p) || p.includes("..") || p.includes("//")) return "";
  return p;
}

export function safeColor(c) {
  return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "#888888";
}
