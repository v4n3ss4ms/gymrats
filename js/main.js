import * as auth from "./auth.js";
import * as db from "./db.js";
import { state, start, stop, subscribe, person, hasPending, SEED_DOCS } from "./state.js";
import { flush } from "./autosave.js";
import { h, $, announce, toast } from "./ui.js";
import * as login from "./views/login.js";
import * as today from "./views/today.js";
import * as session from "./views/session.js";
import * as plans from "./views/plans.js";
import * as exercises from "./views/exercises.js";
import * as history from "./views/history.js";
import * as charts from "./views/charts.js";

const main = $("#main");
const nav = $("#nav");
const who = $("#who");
const conn = $("#conn");

const ROUTES = {
  hoy: { mod: today, nav: "hoy" },
  sesion: { mod: session, nav: "hoy" },
  planes: { mod: plans, nav: "planes" },
  ejercicios: { mod: exercises, nav: "ejercicios" },
  historial: { mod: history, nav: "historial" },
  graficas: { mod: charts, nav: "graficas" }
};

let current = null;
let user = null;
let first = true;
let lastKey = null;

function resolve() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (!user) return { mod: login, params: {}, nav: null, key: "login" };
  if (name === "planes" && arg) return { mod: { mount: plans.mountEdit }, params: { id: arg }, nav: "planes", key: `plan/${arg}` };
  const r = Object.hasOwn(ROUTES, name) ? ROUTES[name] : null;
  if (!r) return null;
  return { mod: r.mod, params: { id: arg }, nav: r.nav, key: `${name}/${arg ?? ""}` };
}

function route() {
  const r = resolve();
  if (!r) {
    location.replace("#/hoy");
    return;
  }
  if (r.key === lastKey) return;
  lastKey = r.key;
  current?.destroy?.();
  const container = h("div", { class: "view" });
  main.replaceChildren(container);
  current = r.mod.mount(container, r.params);
  current.render();
  document.title = `${current.title()} · Gym`;
  for (const a of nav.querySelectorAll("a")) {
    if (a.dataset.nav === r.nav) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (!first) {
    const h1 = main.querySelector("h1");
    if (h1) {
      h1.setAttribute("tabindex", "-1");
      h1.focus({ preventScroll: false });
    } else main.focus();
    announce(current.title());
  }
  first = false;
}

function updateConn() {
  if (!user) {
    conn.textContent = "";
    return;
  }
  const pending = hasPending();
  const text = !state.online
    ? pending ? "Sin conexión, pendiente de sincronizar" : "Sin conexión"
    : pending ? "Sincronizando…" : "Sincronizado";
  if (conn.textContent !== text) conn.textContent = text;
  conn.dataset.state = !state.online ? "offline" : pending ? "pending" : "ok";
}

subscribe(() => {
  current?.render();
  if (current) document.title = `${current.title()} · Gym`;
  updateConn();
});

db.setErrorHandler((e) => {
  const msg =
    e?.code === "permission-denied"
      ? "Cambio rechazado por las reglas de seguridad. No se ha guardado."
      : `No se pudo guardar el cambio${e?.code ? ` (${e.code})` : ""}.`;
  toast(msg);
});

auth.onUser((u) => {
  user = u;
  lastKey = null;
  document.body.classList.toggle("anon", !u);
  nav.classList.toggle("hidden", !u);
  who.classList.toggle("hidden", !u);
  if (u) {
    start(u.uid, (col, err) => toast(`No se pudo leer «${col}»${err?.code ? ` (${err.code})` : ""}.`));
    db.ensureUsers(SEED_DOCS).catch(() => {});
    $("#who-name").textContent = person(u.uid).name;
    if (!location.hash || location.hash === "#/entrar") location.hash = "#/hoy";
  } else {
    stop();
    current?.destroy?.();
    current = null;
  }
  route();
  updateConn();
});

subscribe(() => {
  if (user) $("#who-name").textContent = person(user.uid).name;
});

window.addEventListener("hashchange", route);
window.addEventListener("online", updateConn);
window.addEventListener("offline", updateConn);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});
window.addEventListener("pagehide", flush);

$("#logout").addEventListener("click", async () => {
  flush();
  try {
    await auth.logout();
  } catch {
    toast("No se pudo cerrar la sesión.");
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
