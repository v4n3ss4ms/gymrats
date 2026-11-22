import { state, allSessions, findMate, person, UIDS, isReady } from "../state.js";
import { h, rerender, field, radioGroup, announce, fmtDate, loadingView } from "../ui.js";
import { STATUS_LABEL } from "../model.js";
import { downloadCsv } from "../csv.js";

const ui = { uid: null, xUid: "", from: "", to: "" };

export function mount(container) {
  container.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "hperson") {
      ui.uid = t.value;
      render();
    } else if (t.name === "xperson") ui.xUid = t.value;
    else if (t.id === "x-from") ui.from = t.value;
    else if (t.id === "x-to") ui.to = t.value;
  });
  container.addEventListener("click", (e) => {
    if (!e.target.closest("[data-action=export]")) return;
    const n = downloadCsv({ uid: ui.xUid, from: ui.from, to: ui.to });
    announce(n ? `CSV generado con ${n} series.` : "No hay datos para exportar con ese filtro.");
    const out = container.querySelector("#x-result");
    if (out) out.textContent = n ? `Descarga iniciada: ${n} series.` : "No hay datos con ese filtro.";
  });

  function render() {
    if (!isReady()) return rerender(container, loadingView("Historial"));
    ui.uid ??= state.uid;
    const list = allSessions().filter((s) => s.uid === ui.uid).sort((a, b) => b.date.localeCompare(a.date));
    const people = UIDS.map((u) => ({ value: u, label: person(u).name }));
    rerender(container, [
      h("h1", { text: "Historial" }),
      radioGroup("Persona", "hperson", people, ui.uid),
      h("section", { "aria-labelledby": "h-list" },
        h("h2", { id: "h-list", text: `Sesiones de ${person(ui.uid).name}` }),
        list.length
          ? h("ul", { class: "history-list" }, list.map((s) => {
              const n = Object.keys(s.exercises ?? {}).length;
              const mate = findMate(s);
              const plan = s.planId ? state.plans[s.planId]?.name : "";
              return h("li", {},
                h("a", { href: `#/sesion/${s.id}` },
                  h("strong", { text: fmtDate(s.date) }),
                  h("span", { class: `badge status-${s.status}`, text: STATUS_LABEL[s.status] })),
                h("span", { class: "muted small", text: [`${n} ${n === 1 ? "ejercicio" : "ejercicios"}`, plan, mate ? `con ${person(mate.uid).name}` : ""].filter(Boolean).join(" · ") }));
            }))
          : h("p", { class: "muted", text: "Sin sesiones todavía." })),
      h("section", { "aria-labelledby": "h-export" },
        h("h2", { id: "h-export", text: "Exportar CSV" }),
        h("p", { class: "muted", text: "Una fila por serie. Sirve también como copia de seguridad." }),
        radioGroup("Persona a exportar", "xperson", [{ value: "", label: "Todos" }, ...people], ui.xUid),
        h("div", { class: "toolbar" },
          field("Desde", h("input", { id: "x-from", type: "date", value: ui.from, dataset: { fk: "x-from" } })),
          field("Hasta", h("input", { id: "x-to", type: "date", value: ui.to, dataset: { fk: "x-to" } })),
          h("button", { type: "button", dataset: { action: "export" }, text: "Descargar CSV" })),
        h("p", { id: "x-result", class: "muted", role: "status" }))
    ]);
  }
  return { title: () => "Historial", render, destroy() {} };
}
