import * as actions from "../actions.js";
import * as dialogs from "../dialogs.js";
import * as db from "../db.js";
import { save } from "../autosave.js";
import { state, getSession, findMate, person, isReady } from "../state.js";
import { h, rerender, confirmDialog, avatar, fmtDate, setFieldError, radioGroup, loadingView } from "../ui.js";
import {
  DELETE, ADJUSTMENT_CHIPS, STATUS_LABEL, todayStr, setKeys, isExerciseDone, anyReps,
  parseDecimal, parseReps, fmtInput, byName, MAX_KG
} from "../model.js";

const ui = { sid: null, together: false, mode: null, exOpen: {} };

export function presetTogether(id) {
  Object.assign(ui, { sid: id, together: true, mode: "both", exOpen: {} });
}
const safeId = (s) => s.replace(/\W/g, "_");

export function mount(container, params) {
  const sid = params.id;
  if (ui.sid !== sid) Object.assign(ui, { sid, together: false, mode: null, exOpen: {} });
  let lastSig = null;
  let started = false;
  let pendingFocus = null;

  const nameOf = (id) => state.exercises[id]?.name ?? "Ejercicio desconocido";
  let held = null;
  let heldDone = false;
  const isDone = (s, id) => (held === `${s.id}|${id}` ? heldDone : isExerciseDone(s.exercises[id]));
  const orderedIds = (s) => {
    const ids = Object.keys(s.exercises ?? {}).sort(byName(state.exercises));
    return [...ids.filter((i) => !isDone(s, i)), ...ids.filter((i) => isDone(s, i))];
  };
  const placeholderOf = (s, id) => state.states[`${s.uid}_${id}`]?.reps ?? null;

  function visible(s, mate) {
    if (!mate) return [s];
    if (ui.together && ui.mode === "both") {
      return [s, mate].sort((a, b) => (a.uid === state.uid ? -1 : b.uid === state.uid ? 1 : 0));
    }
    return [ui.mode === mate.uid ? mate : s];
  }

  function signature(shown, mate) {
    return JSON.stringify({
      together: ui.together,
      mode: ui.mode,
      mate: mate?.id ?? null,
      shown: shown.map((s) => ({
        id: s.id,
        uid: s.uid,
        status: s.status,
        note: !!s.notes,
        exs: orderedIds(s).map((id) => ({
          id,
          n: nameOf(id),
          sets: setKeys(s.exercises[id]),
          done: isDone(s, id),
          adj: !!state.exercises[id]?.hasAdjustment,
          xn: !!state.exercises[id]?.notes,
          sw: s.exercises[id].swappedFrom ?? null,
          ph: placeholderOf(s, id)
        }))
      }))
    });
  }

  function numField(label, ctx, input, errId) {
    const err = h("p", { id: errId, class: "field-error hidden", role: "alert" });
    input.setAttribute("aria-describedby", errId);
    return h("div", { class: "field" }, h("label", { for: input.id }, label, h("span", { class: "sr-only", text: ctx })), input, err);
  }

  function buildSet(s, id, n, name, ph) {
    const set = s.exercises[id].sets[n];
    const base = safeId(`${s.id}_${id}_${n}`);
    const ctx = `, serie ${n} de ${name}`;
    const reps = h("input", {
      id: `r_${base}`, type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "off", maxlength: 4,
      value: set.reps ?? "", placeholder: ph ?? "",
      dataset: { fk: `${s.id}|${id}|${n}|reps`, field: "reps", sid: s.id, ex: id, set: n }
    });
    const kg = h("input", {
      id: `k_${base}`, type: "text", inputmode: "decimal", autocomplete: "off", maxlength: 8,
      value: fmtInput(set.kg), placeholder: "0",
      dataset: { fk: `${s.id}|${id}|${n}|kg`, field: "kg", sid: s.id, ex: id, set: n }
    });
    return h(
      "fieldset",
      { class: "set-row" },
      h("legend", { class: "sr-only", text: `Serie ${n} de ${name}` }),
      h("span", { class: "set-n", "aria-hidden": "true", text: n }),
      numField("Repeticiones", ctx, reps, `re_${base}`),
      numField("Kilos", ctx, kg, `ke_${base}`),
      h(
        "div",
        { class: "set-actions" },
        h("button", {
          type: "button", class: "icon-btn secondary outline", "aria-label": `Eliminar serie ${n} de ${name}`,
          dataset: { action: "del-set", sid: s.id, ex: id, set: n }, text: "✕"
        })
      )
    );
  }

  function buildAdjust(s, id, name) {
    const cur = s.exercises[id].adjustment ?? "";
    const inId = `adj_${safeId(`${s.id}_${id}`)}`;
    return h(
      "fieldset",
      { class: "adjust" },
      h("legend", { text: `Ajuste de ${name}` }),
      h(
        "div",
        { class: "chips" },
        ADJUSTMENT_CHIPS.map((c) =>
          h("button", {
            type: "button", class: "chip", "aria-pressed": String(cur === c),
            dataset: { action: "chip", sid: s.id, ex: id, value: c }, text: c
          })
        )
      ),
      h("div", { class: "field" },
        h("label", { for: inId, text: "Otro ajuste" }),
        h("input", {
          id: inId, type: "text", maxlength: 20, autocomplete: "off", value: cur,
          dataset: { fk: `${s.id}|${id}|adj`, field: "adjustment", sid: s.id, ex: id }
        })
      )
    );
  }

  function buildExercise(s, id) {
    const ex = s.exercises[id];
    const cat = state.exercises[id];
    const name = nameOf(id);
    const done = isDone(s, id);
    const key = `${s.id}|${id}`;
    const ph = placeholderOf(s, id);
    const p = person(s.uid);
    return h(
      "details",
      { class: `ex-card${done ? " is-done" : ""}`, open: ui.exOpen[key] ?? !done, dataset: { key } },
      h(
        "summary",
        {},
        h("h3", { text: name }),
        done ? h("span", { class: "sr-only", text: "Hecho" }) : null
      ),
      h(
        "div",
        { class: "ex-body" },
        cat?.notes
          ? h("details", { class: "ex-notes" }, h("summary", { text: "Indicaciones técnicas" }), h("p", { text: cat.notes }))
          : null,
        ex.swappedFrom ? h("p", { class: "muted small", text: `Sustituye a ${nameOf(ex.swappedFrom)}` }) : null,
        cat?.hasAdjustment ? buildAdjust(s, id, name) : null,
        h("div", { class: "sets" }, setKeys(ex).map((n) => buildSet(s, id, n, name, ph))),
        h(
          "div",
          { class: "btn-row start" },
          h("button", {
            type: "button", class: "secondary", "aria-label": `Añadir serie a ${name}`,
            dataset: { action: "add-set", sid: s.id, ex: id }, text: "+ Serie"
          }),
          setKeys(ex).length
            ? h("button", {
                type: "button", class: "secondary", "aria-label": `Duplicar serie ${Math.max(...setKeys(ex).map(Number))} de ${name}`,
                dataset: { action: "dup-set", sid: s.id, ex: id }, text: "Duplicar serie"
              })
            : null,
          h("button", {
            type: "button", class: "secondary outline", "aria-label": `Sustituir ${name}`,
            dataset: { action: "swap-ex", sid: s.id, ex: id }, text: "Sustituir"
          }),
          h("button", {
            type: "button", class: "secondary outline", "aria-label": `Quitar ${name} de la sesión de ${p.name}`,
            dataset: { action: "remove-ex", sid: s.id, ex: id }, text: "Quitar"
          })
        )
      )
    );
  }

  function buildPanel(s) {
    const p = person(s.uid);
    const ids = orderedIds(s);
    const base = safeId(s.id);
    const dateIn = h("input", { id: `d_${base}`, type: "date", value: s.date, dataset: { fk: `${s.id}|date`, field: "date", sid: s.id } });
    const statusSel = h(
      "select",
      { id: `s_${base}`, dataset: { field: "status", sid: s.id, fk: `${s.id}|status` } },
      Object.entries(STATUS_LABEL).map(([v, l]) => h("option", { value: v, text: l }))
    );
    statusSel.value = s.status;
    const nkey = `${s.id}|notes`;
    return h(
      "fieldset",
      { class: "panel" },
      h("legend", { class: "sr-only", text: `Sesión de ${p.name}` }),
      h(
        "header",
        { class: "panel-head" },
        avatar(p),
        h("h2", { text: `${p.name}${s.uid === state.uid ? " (yo)" : ""}` }),
        h("span", { class: `badge status-${s.status}`, text: STATUS_LABEL[s.status] })
      ),
      h("div", { class: "meta-row" },
        h("div", { class: "field" }, h("label", { for: dateIn.id, text: "Fecha" }), dateIn),
        h("div", { class: "field" }, h("label", { for: statusSel.id, text: "Estado" }), statusSel)
      ),
      h("div", { class: "ex-list" }, ids.length ? ids.map((id) => buildExercise(s, id)) : h("p", { class: "muted", text: "Sin ejercicios todavía." })),
      h("button", {
        type: "button", class: "secondary add-ex", "aria-label": `Añadir ejercicio a la sesión de ${p.name}`,
        dataset: { action: "add-ex", sid: s.id }, text: "+ Ejercicio"
      }),
      h(
        "details",
        { class: "notes", open: ui.exOpen[nkey] ?? false, dataset: { key: nkey } },
        h("summary", {}, "Notas de la sesión", s.notes ? h("span", { class: "badge" }, h("span", { "aria-hidden": "true", text: "✎ " }), "con nota") : null),
        h("div", { class: "field" },
          h("label", { for: `n_${base}`, text: `Notas de la sesión de ${p.name}` }),
          h("textarea", { id: `n_${base}`, rows: 3, maxlength: 2000, value: s.notes ?? "", dataset: { fk: `${s.id}|notes`, field: "notes", sid: s.id } })
        )
      ),
      h(
        "div",
        { class: "btn-row start" },
        s.status === "done"
          ? h("button", { type: "button", class: "secondary", "aria-label": `Reabrir entreno de ${p.name}`, dataset: { action: "reopen", sid: s.id }, text: "Reabrir" })
          : h("button", { type: "button", "aria-label": `Terminar entreno de ${p.name}`, dataset: { action: "finish", sid: s.id }, text: "Terminar entreno" }),
        h("button", { type: "button", class: "secondary outline", "aria-label": `Guardar como plan, sesión de ${p.name}`, dataset: { action: "save-plan", sid: s.id }, text: "Guardar como plan" }),
        h("button", { type: "button", class: "secondary outline danger", "aria-label": `Eliminar sesión de ${p.name}`, dataset: { action: "delete", sid: s.id }, text: "Eliminar sesión" })
      )
    );
  }

  function buildAll(s, mate, shown) {
    const top = [];
    if (mate) {
      top.push(
        h("label", { class: "switch" },
          h("input", { type: "checkbox", role: "switch", checked: ui.together, dataset: { action: "together", fk: "together" } }),
          h("span", { text: "Estamos juntos" })
        )
      );
      if (ui.together) {
        top.push(
          radioGroup("Ver y editar", "mode", [
            { value: s.uid, label: person(s.uid).name },
            { value: mate.uid, label: person(mate.uid).name },
            { value: "both", label: "Ambos" }
          ], ui.mode)
        );
      } else {
        top.push(h("a", { class: "link-other", href: `#/sesion/${mate.id}`, text: `Ver sesión de ${person(mate.uid).name}` }));
      }
    } else {
      top.push(
        h("label", { class: "switch" },
          h("input", { type: "checkbox", role: "switch", checked: false, dataset: { action: "together", fk: "together" } }),
          h("span", { text: "Estamos juntos" })
        )
      );
    }
    return [
      h("h1", { text: `Sesión del ${fmtDate(shown[0].date)}` }),
      h("div", { class: "session-top" }, top),
      h("div", { class: `panels${shown.length > 1 ? " two" : ""}` }, shown.map(buildPanel))
    ];
  }

  function fieldValue(s, el) {
    const d = el.dataset;
    const ex = s.exercises?.[d.ex];
    switch (d.field) {
      case "reps": return ex?.sets?.[d.set]?.reps ?? "";
      case "kg": return fmtInput(ex?.sets?.[d.set]?.kg);
      case "adjustment": return ex?.adjustment ?? "";
      case "notes": return s.notes ?? "";
      case "date": return s.date;
      case "status": return s.status;
      default: return el.value;
    }
  }

  function syncValues() {
    for (const el of container.querySelectorAll("[data-field]")) {
      const s = getSession(el.dataset.sid);
      if (!s || el === document.activeElement) continue;
      const v = String(fieldValue(s, el));
      if (el.value !== v) el.value = v;
      if (el.getAttribute("aria-invalid") === "true") setFieldError(el, "");
      if (el.dataset.field === "reps") el.placeholder = placeholderOf(s, el.dataset.ex) ?? "";
    }
    for (const b of container.querySelectorAll('[data-action="chip"]')) {
      const s = getSession(b.dataset.sid);
      b.setAttribute("aria-pressed", String(s?.exercises?.[b.dataset.ex]?.adjustment === b.dataset.value));
    }
    const first = container.querySelector("[data-field=date]");
    const h1 = container.querySelector("h1");
    if (first && h1) h1.textContent = `Sesión del ${fmtDate(getSession(first.dataset.sid)?.date)}`;
  }

  function render() {
    if (!isReady()) {
      lastSig = null;
      return rerender(container, loadingView("Sesión"));
    }
    const s = getSession(sid);
    if (!s) {
      lastSig = null;
      return rerender(container, [
        h("h1", { text: "Sesión no encontrada" }),
        h("p", { text: "Puede que se haya eliminado." }),
        h("a", { href: "#/hoy", role: "button", text: "Volver a Hoy" })
      ]);
    }
    if (!started) {
      started = true;
      if (s.status === "planned" && s.date <= todayStr() && s.uid === state.uid) save(sid, { status: "in_progress" }, { immediate: true });
    }
    const mate = findMate(s);
    if (!mate) ui.together = false;
    if (ui.mode == null || (ui.mode !== "both" && ui.mode !== s.uid && ui.mode !== mate?.uid)) ui.mode = ui.together ? "both" : s.uid;
    if (!ui.together && ui.mode === "both") ui.mode = s.uid;
    const shown = visible(s, mate);
    const sig = signature(shown, mate);
    if (sig !== lastSig) {
      lastSig = sig;
      rerender(container, buildAll(s, mate, shown));
      syncValues();
      if (pendingFocus) {
        container.querySelector(pendingFocus)?.focus();
        pendingFocus = null;
      }
      return;
    }
    syncValues();
  }

  async function onClick(e) {
    const b = e.target.closest("button[data-action]");
    if (!b || !container.contains(b)) return;
    const { action, ex, set, value } = b.dataset;
    const s = b.dataset.sid ? getSession(b.dataset.sid) : null;
    if (!s) return;
    switch (action) {
      case "add-ex": {
        const ids = await dialogs.pickExercises({ exclude: new Set(Object.keys(s.exercises ?? {})) });
        if (ids?.length) {
          pendingFocus = `[data-action="add-ex"][data-sid="${s.id}"]`;
          actions.addExercises(s.id, ids);
        }
        break;
      }
      case "remove-ex": {
        if (anyReps(s.exercises[ex]) && !(await confirmDialog("Quitar ejercicio", `Se perderán las series registradas de ${nameOf(ex)}. ¿Quitarlo?`, "Quitar"))) return;
        pendingFocus = `[data-action="add-ex"][data-sid="${s.id}"]`;
        actions.removeExercise(s.id, ex);
        break;
      }
      case "swap-ex": {
        const r = await dialogs.pickExercises({ title: `Sustituir ${nameOf(ex)}`, exclude: new Set(Object.keys(s.exercises ?? {})), single: true, okLabel: "Sustituir" });
        if (r?.length) actions.swapExercise(s.id, ex, r[0]);
        break;
      }
      case "add-set": {
        const n = Math.max(0, ...setKeys(s.exercises[ex]).map(Number)) + 1;
        pendingFocus = `[data-fk="${s.id}|${ex}|${n}|reps"]`;
        actions.addSet(s.id, ex);
        break;
      }
      case "del-set":
        pendingFocus = `[data-action="add-set"][data-sid="${s.id}"][data-ex="${ex}"]`;
        actions.removeSet(s.id, ex, set);
        break;
      case "dup-set": {
        const n = Math.max(0, ...setKeys(s.exercises[ex]).map(Number)) + 1;
        pendingFocus = `[data-fk="${s.id}|${ex}|${n}|reps"]`;
        actions.duplicateSet(s.id, ex);
        break;
      }
      case "chip": {
        const cur = s.exercises[ex].adjustment;
        save(s.id, { [`exercises.${ex}.adjustment`]: cur === value ? DELETE : value });
        break;
      }
      case "finish": save(s.id, { status: "done" }, { immediate: true }); break;
      case "reopen": save(s.id, { status: "in_progress" }, { immediate: true }); break;
      case "save-plan": {
        const m = findMate(s);
        const list = ui.together && ui.mode === "both" && m ? [s, m] : [s];
        await dialogs.saveAsPlanDialog(list);
        break;
      }
      case "delete": {
        if (await confirmDialog("Eliminar sesión", `Se eliminará la sesión de ${person(s.uid).name} del ${fmtDate(s.date)}. No se puede deshacer.`, "Eliminar")) {
          const mateAfter = findMate(s);
          db.removeDoc("sessions", s.id);
          if (s.id === sid) location.hash = mateAfter && ui.together ? `#/sesion/${mateAfter.id}` : "#/hoy";
        }
        break;
      }
    }
  }

  function onInput(e) {
    const t = e.target;
    const f = t.dataset?.field;
    if (!f || f === "status") return;
    const s = getSession(t.dataset.sid);
    if (!s) return;
    const { ex, set, sid: id } = t.dataset;
    if (f === "reps") {
      const r = parseReps(t.value);
      setFieldError(t, r.error ? "Introduce un número entero de 0 o más." : "");
      if (!r.error) save(id, { [`exercises.${ex}.sets.${set}.reps`]: r.empty ? null : r.value });
    } else if (f === "kg") {
      const r = parseDecimal(t.value);
      const bad = r.error || r.value > MAX_KG;
      setFieldError(t, bad ? `Introduce kilos entre 0 y ${MAX_KG} (con coma o punto).` : "");
      if (!bad) save(id, { [`exercises.${ex}.sets.${set}.kg`]: r.empty ? 0 : r.value });
    } else if (f === "adjustment") {
      const v = t.value.trim().slice(0, 20);
      save(id, { [`exercises.${ex}.adjustment`]: v || DELETE });
    } else if (f === "notes") {
      save(id, { notes: t.value.slice(0, 2000) });
    } else if (f === "date" && /^20\d\d-\d\d-\d\d$/.test(t.value)) {
      save(id, { date: t.value });
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset?.field === "status") return save(t.dataset.sid, { status: t.value }, { immediate: true });
    if (t.dataset?.action === "together") {
      const s = getSession(sid);
      if (t.checked) {
        actions.linkTogether(sid);
        ui.together = true;
        ui.mode = "both";
      } else {
        ui.together = false;
        ui.mode = s.uid;
      }
      render();
    } else if (t.name === "mode") {
      ui.mode = t.value;
      render();
    }
  }

  function onToggle(e) {
    const t = e.target;
    if (t.matches?.("details[data-key]")) ui.exOpen[t.dataset.key] = t.open;
  }

  container.addEventListener("click", onClick);
  container.addEventListener("input", onInput);
  container.addEventListener("change", onChange);
  container.addEventListener("toggle", onToggle, true);
  container.addEventListener("focusin", (e) => {
    const d = e.target.dataset;
    if (!d?.ex) return;
    const key = `${d.sid}|${d.ex}`;
    if (held !== key) {
      held = key;
      heldDone = isExerciseDone(getSession(d.sid)?.exercises?.[d.ex]);
    }
  });
  container.addEventListener("focusout", () =>
    setTimeout(() => {
      const a = document.activeElement;
      const d = a?.dataset;
      if (held && !(container.contains(a) && `${d.sid}|${d.ex}` === held)) {
        held = null;
        render();
      }
    }, 0)
  );

  return {
    title: () => {
      const s = getSession(sid);
      return s ? `Sesión de ${person(s.uid).name}` : "Sesión";
    },
    render,
    destroy() {}
  };
}
