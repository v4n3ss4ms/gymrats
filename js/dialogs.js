import * as db from "./db.js";
import * as actions from "./actions.js";
import { state, person, UIDS } from "./state.js";
import { h, modal, field, setFieldError, radioGroup } from "./ui.js";
import { norm, todayStr, safeImagePath, byName } from "./model.js";

const sortedCatalog = (exclude) => {
  const ids = Object.keys(state.exercises).filter((id) => !state.exercises[id].archived && !exclude.has(id));
  return ids.sort(byName(state.exercises));
};

export function exerciseChecklist({ exclude = new Set(), single = false, onChange = () => {} } = {}) {
  const selected = new Set();
  const search = h("input", { type: "search", id: "pick-q", autocomplete: "off", dataset: { fk: "pick-q" } });
  const list = h("div", { class: "picker-list" });
  const draw = () => {
    const q = norm(search.value);
    const ids = sortedCatalog(exclude).filter((id) => norm(state.exercises[id].name).includes(q));
    list.replaceChildren(
      ...(ids.length
        ? ids.map((id) =>
            h(
              "label",
              { class: "check" },
              h("input", {
                type: single ? "radio" : "checkbox",
                name: "pick",
                checked: selected.has(id),
                onChange: (e) => {
                  if (single) selected.clear();
                  if (e.target.checked) selected.add(id);
                  else selected.delete(id);
                  onChange(selected);
                }
              }),
              h("span", { text: state.exercises[id].name })
            )
          )
        : [h("p", { class: "muted", text: "No hay ejercicios que coincidan." })])
    );
  };
  search.addEventListener("input", draw);
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
  });
  draw();
  const el = h("div", { class: "picker" }, field("Buscar ejercicio", search), list);
  return { el, selected };
}

export function pickExercises({ title = "Añadir ejercicios", exclude = new Set(), single = false, okLabel = "Añadir" } = {}) {
  return modal(title, (close) => {
    const ok = h("button", { type: "button", disabled: true, text: okLabel });
    const { el, selected } = exerciseChecklist({
      exclude,
      single,
      onChange: (s) => {
        ok.disabled = s.size === 0;
        ok.textContent = single || !s.size ? okLabel : `${okLabel} (${s.size})`;
      }
    });
    ok.addEventListener("click", () => close([...selected]));
    return h(
      "div",
      {},
      el,
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "secondary", onClick: () => close(undefined), text: "Cancelar" }), ok)
    );
  });
}

export function exerciseDialog(id) {
  const ex = id ? state.exercises[id] : null;
  return modal(ex ? "Editar ejercicio" : "Nuevo ejercicio", (close) => {
    const name = h("input", { id: "ex-name", type: "text", maxlength: 80, required: true, autofocus: true, value: ex?.name ?? "" });
    const notes = h("textarea", { id: "ex-notes", rows: 3, maxlength: 2000, value: ex?.notes ?? "" });
    const adj = h("input", { id: "ex-adj", type: "checkbox", checked: !!ex?.hasAdjustment, "aria-describedby": "ex-adj-help" });
    const img = h("input", { id: "ex-img", type: "text", maxlength: 120, value: ex?.imagePath ?? "", placeholder: "images/exercises/sentadilla.png" });
    const form = h(
      "form",
      { novalidate: true },
      field("Nombre", name, "ex-name-err"),
      field("Indicaciones técnicas", notes),
      h("label", { class: "check" }, adj, h("span", { text: "Tiene ajuste (altura de polea)" })),
      h("p", { id: "ex-adj-help", class: "muted small", text: "El valor no se pone aquí: se elige en cada sesión y se recuerda para la próxima vez." }),
      field("Ruta de imagen (opcional)", img, "ex-img-err"),
      h(
        "div",
        { class: "btn-row" },
        h("button", { type: "button", class: "secondary", onClick: () => close(undefined), text: "Cancelar" }),
        ex
          ? h("button", {
              type: "button",
              class: "secondary outline",
              onClick: () => {
                db.updateFields("exercises", id, { archived: !ex.archived });
                close(true);
              },
              text: ex.archived ? "Restaurar" : "Archivar"
            })
          : null,
        h("button", { type: "submit", text: "Guardar" })
      )
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = name.value.trim();
      const p = img.value.trim();
      setFieldError(name, n ? "" : "Escribe un nombre (máximo 80 caracteres).");
      setFieldError(img, !p || safeImagePath(p) ? "" : "Ruta no válida. Usa una ruta relativa dentro de images/.");
      if (!n || (p && !safeImagePath(p))) return;
      const data = { name: n, notes: notes.value.slice(0, 2000), hasAdjustment: adj.checked, imagePath: p };
      if (ex) db.updateFields("exercises", id, data);
      else db.createDoc("exercises", { ...data, archived: false });
      close(true);
    });
    return form;
  });
}

export function newSessionDialog({ date = todayStr(), planId = "", who = "me" } = {}) {
  return modal("Nuevo entreno", (close) => {
    const me = state.uid;
    const other = UIDS.find((u) => u !== me);
    const dateIn = h("input", { id: "ns-date", type: "date", required: true, value: date, autofocus: true });
    const auto = (d) => (d > todayStr() ? "planned" : d < todayStr() ? "done" : "in_progress");
    const status = h(
      "select",
      { id: "ns-status" },
      [["planned", "Planificado"], ["in_progress", "En curso"], ["done", "Hecho (entreno pasado)"]].map(([v, l]) => h("option", { value: v, text: l }))
    );
    status.value = auto(date);
    let touched = false;
    status.addEventListener("change", () => (touched = true));
    dateIn.addEventListener("change", () => {
      if (!touched && dateIn.value) status.value = auto(dateIn.value);
    });
    const plan = h(
      "select",
      { id: "ns-plan" },
      h("option", { value: "", text: "Sin plan" }),
      Object.values(state.plans)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((p) => h("option", { value: p.id, text: p.name }))
    );
    plan.value = planId;
    const whoGroup = radioGroup(
      "Para",
      "ns-who",
      [
        { value: "me", label: `Yo (${person(me).name})` },
        { value: "other", label: person(other).name },
        { value: "both", label: "Los dos juntos" }
      ],
      who
    );
    const form = h(
      "form",
      { novalidate: true },
      field("Fecha", dateIn, "ns-date-err"),
      whoGroup,
      field("Plan", plan),
      field("Estado", status),
      h(
        "div",
        { class: "btn-row" },
        h("button", { type: "button", class: "secondary", onClick: () => close(undefined), text: "Cancelar" }),
        h("button", { type: "submit", text: "Crear entreno" })
      )
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      setFieldError(dateIn, /^\d{4}-\d{2}-\d{2}$/.test(dateIn.value) ? "" : "Elige una fecha válida.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIn.value)) return;
      const chosen = form.querySelector("input[name=ns-who]:checked").value;
      const r = actions.createSessions({ date: dateIn.value, who: chosen, planId: plan.value, status: status.value });
      close(r);
    });
    return form;
  });
}

export function newPlanDialog() {
  return modal("Nuevo plan", (close) => {
    const me = state.uid;
    const other = UIDS.find((u) => u !== me);
    const name = h("input", { id: "np-name", type: "text", maxlength: 80, required: true, autofocus: true });
    const who = radioGroup(
      "Para",
      "np-who",
      [
        { value: "me", label: `Mí (${person(me).name})` },
        { value: "other", label: person(other).name },
        { value: "both", label: "Los dos" }
      ],
      "me"
    );
    const { el, selected } = exerciseChecklist();
    const form = h(
      "form",
      { novalidate: true },
      field("Nombre del plan", name, "np-name-err"),
      who,
      el,
      h(
        "div",
        { class: "btn-row" },
        h("button", { type: "button", class: "secondary", onClick: () => close(undefined), text: "Cancelar" }),
        h("button", { type: "submit", text: "Crear plan" })
      )
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = name.value.trim();
      setFieldError(name, n ? "" : "Escribe un nombre (máximo 80 caracteres).");
      if (!n) return;
      const ids = [...selected].sort(byName(state.exercises));
      const choice = form.querySelector("input[name=np-who]:checked").value;
      const uids = choice === "both" ? UIDS : [choice === "me" ? me : other];
      const byUser = {};
      for (const u of uids) byUser[u] = [...ids];
      close(actions.createPlan(n, byUser));
    });
    return form;
  });
}

export function saveAsPlanDialog(sessions) {
  return modal("Guardar como plan", (close) => {
    const name = h("input", { id: "sp-name", type: "text", maxlength: 80, required: true, autofocus: true });
    const existing = h(
      "select",
      { id: "sp-existing", disabled: true },
      Object.values(state.plans)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((p) => h("option", { value: p.id, text: p.name }))
    );
    const mode = radioGroup(
      "Destino",
      "sp-mode",
      [{ value: "new", label: "Plan nuevo" }, { value: "existing", label: "Actualizar uno existente" }],
      "new"
    );
    const sides = h(
      "fieldset",
      {},
      h("legend", { text: "Ejercicios de" }),
      sessions.map((s) =>
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: true, dataset: { uid: s.uid } }), h("span", { text: `Sesión de ${person(s.uid).name}` }))
      )
    );
    const err = h("p", { class: "field-error hidden", role: "alert", id: "sp-err" });
    const sync = () => {
      const isNew = form.querySelector("input[name=sp-mode]:checked").value === "new";
      name.disabled = !isNew;
      existing.disabled = isNew;
    };
    const form = h(
      "form",
      { novalidate: true },
      mode,
      field("Nombre del plan nuevo", name, "sp-name-err"),
      field("Plan a actualizar", existing),
      sides,
      err,
      h(
        "div",
        { class: "btn-row" },
        h("button", { type: "button", class: "secondary", onClick: () => close(undefined), text: "Cancelar" }),
        h("button", { type: "submit", text: "Guardar plan" })
      )
    );
    form.addEventListener("change", sync);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const isNew = form.querySelector("input[name=sp-mode]:checked").value === "new";
      const chosen = sessions.filter((s) => form.querySelector(`input[data-uid="${s.uid}"]`).checked);
      const n = name.value.trim();
      const problem = !chosen.length ? "Elige al menos una sesión." : isNew && !n ? "Escribe un nombre (máximo 80 caracteres)." : !isNew && !existing.value ? "No hay planes que actualizar." : "";
      err.textContent = problem;
      err.classList.toggle("hidden", !problem);
      if (problem) return;
      const idsOf = (s) => actions.exerciseIdsOf(s);
      if (isNew) {
        const byUser = {};
        for (const s of chosen) byUser[s.uid] = idsOf(s);
        actions.createPlan(n, byUser);
      } else {
        const fields = {};
        for (const s of chosen) fields[`byUser.${s.uid}`] = idsOf(s);
        db.updateFields("plans", existing.value, fields);
      }
      close(true);
    });
    return form;
  });
}
