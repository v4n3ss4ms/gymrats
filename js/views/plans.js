import * as dialogs from "../dialogs.js";
import * as db from "../db.js";
import { state, person, UIDS, isReady } from "../state.js";
import { h, rerender, confirmDialog, avatar, field, setFieldError, radioGroup, loadingView } from "../ui.js";
import { byName } from "../model.js";
import { presetTogether } from "./session.js";

export function mount(container) {
  container.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    const { action, id } = b.dataset;
    if (action === "new") {
      const pid = await dialogs.newPlanDialog();
      if (pid) location.hash = `#/planes/${pid}`;
    } else if (action === "use") {
      const r = await dialogs.newSessionDialog({ planId: id });
      if (r) {
        if (r.together) presetTogether(r.id);
        location.hash = `#/sesion/${r.id}`;
      }
    } else if (action === "delete") {
      if (await confirmDialog("Eliminar plan", `Se eliminará el plan «${state.plans[id]?.name}». Las sesiones ya creadas no cambian.`, "Eliminar")) db.removeDoc("plans", id);
    }
  });

  function render() {
    if (!isReady()) return rerender(container, loadingView("Planes"));
    const plans = Object.values(state.plans).sort((a, b) => a.name.localeCompare(b.name, "es"));
    rerender(container, [
      h("h1", { text: "Planes" }),
      h("div", { class: "toolbar" }, h("button", { type: "button", dataset: { action: "new" }, text: "Nuevo plan" })),
      plans.length
        ? h("div", { class: "cards" }, plans.map((p) =>
            h("article", { class: "card" },
              h("h2", { class: "card-title", text: p.name }),
              h("p", { class: "muted", text: UIDS.filter((u) => p.byUser?.[u]).map((u) => `${person(u).name}: ${p.byUser[u].length}`).join(" · ") || "Sin ejercicios" }),
              h("div", { class: "btn-row start" },
                h("button", { type: "button", "aria-label": `Usar el plan ${p.name}`, dataset: { action: "use", id: p.id }, text: "Usar" }),
                h("a", { href: `#/planes/${p.id}`, role: "button", class: "secondary", "aria-label": `Editar el plan ${p.name}`, text: "Editar" }),
                h("button", { type: "button", class: "secondary outline danger", "aria-label": `Eliminar el plan ${p.name}`, dataset: { action: "delete", id: p.id }, text: "Eliminar" })
              )))
          )
        : h("p", { class: "muted", text: "Todavía no hay planes." })
    ]);
  }
  return { title: () => "Planes", render, destroy() {} };
}

export function mountEdit(container, params) {
  const pid = params.id;
  const wide = matchMedia("(min-width: 1024px)").matches;
  let mode = wide ? "both" : state.uid;
  let nameTimer = null;
  let lastSig = null;

  const flushName = () => {
    if (nameTimer == null) return;
    clearTimeout(nameTimer);
    nameTimer = null;
    const input = container.querySelector("#plan-name");
    const n = input?.value.trim();
    if (n && n !== state.plans[pid]?.name) db.updateFields("plans", pid, { name: n });
  };

  container.addEventListener("input", (e) => {
    if (e.target.id !== "plan-name") return;
    const ok = e.target.value.trim().length > 0;
    setFieldError(e.target, ok ? "" : "El nombre no puede estar vacío.");
    clearTimeout(nameTimer);
    nameTimer = ok ? setTimeout(flushName, 500) : null;
  });
  container.addEventListener("change", (e) => {
    if (e.target.name === "pmode") {
      mode = e.target.value;
      render();
    }
  });
  container.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    const { action, uid, ex } = b.dataset;
    const plan = state.plans[pid];
    if (!plan) return;
    if (action === "add") {
      const ids = await dialogs.pickExercises({ exclude: new Set(plan.byUser?.[uid] ?? []) });
      if (ids?.length) db.updateFields("plans", pid, { [`byUser.${uid}`]: db.union(...ids) });
    } else if (action === "remove") {
      db.updateFields("plans", pid, { [`byUser.${uid}`]: db.remove(ex) });
    } else if (action === "include") {
      db.updateFields("plans", pid, { [`byUser.${uid}`]: [] });
    } else if (action === "copy") {
      const to = UIDS.find((u) => u !== uid);
      if (await confirmDialog("Aplicar a la otra persona", `La lista de ${person(to).name} se reemplazará por la de ${person(uid).name}.`, "Aplicar")) {
        db.updateFields("plans", pid, { [`byUser.${to}`]: [...(plan.byUser?.[uid] ?? [])] });
      }
    }
  });

  function side(plan, uid) {
    const p = person(uid);
    const list = plan.byUser?.[uid];
    const other = UIDS.find((u) => u !== uid);
    return h(
      "fieldset",
      { class: "panel" },
      h("legend", { class: "sr-only", text: `Plan de ${p.name}` }),
      h("header", { class: "panel-head" }, avatar(p), h("h2", { text: p.name })),
      list
        ? [
            list.length
              ? h("ul", { class: "plan-list" },
                  [...list].sort(byName(state.exercises)).map((id) =>
                    h("li", {},
                      h("span", { text: state.exercises[id]?.name ?? "Ejercicio desconocido" }),
                      h("button", { type: "button", class: "icon-btn secondary outline", "aria-label": `Quitar ${state.exercises[id]?.name ?? "ejercicio"} del plan de ${p.name}`, dataset: { action: "remove", uid, ex: id }, text: "✕" })
                    )
                  ))
              : h("p", { class: "muted", text: "Sin ejercicios." }),
            h("div", { class: "btn-row start" },
              h("button", { type: "button", class: "secondary", "aria-label": `Añadir ejercicios al plan de ${p.name}`, dataset: { action: "add", uid }, text: "+ Ejercicios" }),
              h("button", { type: "button", class: "secondary outline", "aria-label": `Aplicar la lista de ${p.name} también a ${person(other).name}`, dataset: { action: "copy", uid }, text: `Aplicar también a ${person(other).name}` })
            )
          ]
        : [
            h("p", { class: "muted", text: `Este plan no incluye a ${p.name}.` }),
            h("button", { type: "button", class: "secondary", dataset: { action: "include", uid }, "aria-label": `Añadir a ${p.name} a este plan`, text: "Incluir" })
          ]
    );
  }

  function render() {
    if (!isReady()) {
      lastSig = null;
      return rerender(container, loadingView("Plan"));
    }
    const plan = state.plans[pid];
    if (!plan) {
      return rerender(container, [h("h1", { text: "Plan no encontrado" }), h("a", { href: "#/planes", role: "button", text: "Volver a Planes" })]);
    }
    const sig = JSON.stringify([plan.name, plan.byUser, mode, Object.values(state.exercises).map((x) => x.name)]);
    if (sig === lastSig) return;
    lastSig = sig;
    const shown = mode === "both" ? UIDS : [mode];
    const nameIn = h("input", { id: "plan-name", type: "text", maxlength: 80, value: plan.name, dataset: { fk: "plan-name" } });
    rerender(container, [
      h("h1", { text: `Plan: ${plan.name}` }),
      field("Nombre del plan", nameIn, "plan-name-err"),
      radioGroup("Ver y editar", "pmode", [...UIDS.map((u) => ({ value: u, label: person(u).name })), { value: "both", label: "Ambos" }], mode),
      h("div", { class: `panels${shown.length > 1 ? " two" : ""}` }, shown.map((u) => side(plan, u))),
      h("p", {}, h("a", { href: "#/planes", text: "← Volver a Planes" }))
    ]);
  }

  return {
    title: () => (state.plans[pid] ? `Plan ${state.plans[pid].name}` : "Plan"),
    render,
    destroy: flushName
  };
}
