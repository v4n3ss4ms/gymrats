import * as dialogs from "../dialogs.js";
import { state, allSessions, findMate, person, isReady } from "../state.js";
import { h, rerender, avatar, fmtDate, loadingView } from "../ui.js";
import { todayStr, STATUS_LABEL } from "../model.js";
import { presetTogether } from "./session.js";

let selDate = todayStr();

function sessionCard(s) {
  const p = person(s.uid);
  const mate = findMate(s);
  const n = Object.keys(s.exercises ?? {}).length;
  const plan = s.planId ? state.plans[s.planId]?.name : "";
  return h(
    "article",
    { class: "card" },
    h(
      "header",
      { class: "panel-head" },
      avatar(p),
      h("h3", { text: p.name }),
      h("span", { class: `badge status-${s.status}`, text: STATUS_LABEL[s.status] })
    ),
    h("p", { class: "muted", text: [fmtDate(s.date), `${n} ${n === 1 ? "ejercicio" : "ejercicios"}`, plan, mate ? `con ${person(mate.uid).name}` : ""].filter(Boolean).join(" · ") }),
    h("a", { href: `#/sesion/${s.id}`, role: "button", "aria-label": `Abrir sesión de ${p.name} del ${fmtDate(s.date)}`, text: "Abrir" })
  );
}

export function mount(container) {
  container.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    if (b.dataset.action === "today") {
      selDate = todayStr();
      render();
    } else if (b.dataset.action === "new") {
      const r = await dialogs.newSessionDialog({ date: selDate });
      if (r) {
        if (r.together) presetTogether(r.id);
        location.hash = `#/sesion/${r.id}`;
      }
    }
  });
  container.addEventListener("change", (e) => {
    if (e.target.dataset.action === "date" && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
      selDate = e.target.value;
      render();
    }
  });

  function render() {
    if (!isReady()) return rerender(container, loadingView("Hoy"));
    const all = allSessions();
    const mineFirst = (a, b) => (a.uid === state.uid ? -1 : b.uid === state.uid ? 1 : 0);
    const day = all.filter((s) => s.date === selDate).sort(mineFirst);
    const upcoming = all.filter((s) => s.date > todayStr() && s.status === "planned" && s.date !== selDate).sort((a, b) => a.date.localeCompare(b.date) || mineFirst(a, b));
    rerender(container, [
      h("h1", { text: "Hoy" }),
      h(
        "div",
        { class: "toolbar" },
        h("div", { class: "field" }, h("label", { for: "day", text: "Fecha" }), h("input", { id: "day", type: "date", value: selDate, dataset: { action: "date", fk: "day" } })),
        selDate !== todayStr() ? h("button", { type: "button", class: "secondary", dataset: { action: "today" }, text: "Ir a hoy" }) : null,
        h("button", { type: "button", dataset: { action: "new" }, text: "Nuevo entreno" })
      ),
      h("section", { "aria-labelledby": "sec-day" },
        h("h2", { id: "sec-day", text: selDate === todayStr() ? "Entrenos de hoy" : `Entrenos del ${fmtDate(selDate)}` }),
        day.length ? h("div", { class: "cards" }, day.map(sessionCard)) : h("p", { class: "muted", text: "No hay entrenos en esta fecha. Crea uno con «Nuevo entreno»." })
      ),
      upcoming.length
        ? h("section", { "aria-labelledby": "sec-up" }, h("h2", { id: "sec-up", text: "Planificados" }), h("div", { class: "cards" }, upcoming.map(sessionCard)))
        : null
    ]);
  }

  return { title: () => "Hoy", render, destroy() {} };
}
