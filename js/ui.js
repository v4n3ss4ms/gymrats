import { safeImagePath, safeColor } from "./model.js";

const PROPS = new Set(["value", "checked", "disabled", "selected", "open", "textContent"]);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function rerender(container, nodes) {
  const a = document.activeElement;
  let fk = null, val = null, s0 = null, s1 = null;
  if (a && container.contains(a) && a.dataset?.fk) {
    fk = a.dataset.fk;
    if ("value" in a) val = a.value;
    try {
      s0 = a.selectionStart;
      s1 = a.selectionEnd;
    } catch {
      s0 = s1 = null;
    }
  }
  container.replaceChildren(...[nodes].flat(Infinity).filter(Boolean));
  if (!fk) return;
  const n = container.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
  if (!n) return;
  for (let p = n.closest("details"); p; p = p.parentElement?.closest("details")) p.open = true;
  if (val != null && n.matches("input:not([type=checkbox]):not([type=radio]),textarea,select")) n.value = val;
  n.focus({ preventScroll: true });
  if (s0 != null) {
    try {
      n.setSelectionRange(s0, s1);
    } catch {
      /* input sin selección */
    }
  }
}

export function announce(msg) {
  const el = $("#announcer");
  if (el) el.textContent = msg;
}

export function toast(msg) {
  const box = $("#alerts");
  const t = h(
    "div",
    { class: "toast" },
    h("span", { text: msg }),
    h("button", { type: "button", class: "toast-close", "aria-label": "Cerrar aviso", onClick: () => t.remove(), text: "✕" })
  );
  box.append(t);
  setTimeout(() => t.remove(), 12000);
}

let dlgCount = 0;
export function modal(title, build) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const id = `dlg${++dlgCount}`;
    let result;
    const dlg = h("dialog", { class: "modal", "aria-labelledby": `${id}-t` });
    const close = (v) => {
      result = v;
      dlg.close();
    };
    dlg.append(
      h(
        "article",
        {},
        h(
          "header",
          { class: "modal-head" },
          h("h2", { id: `${id}-t`, text: title }),
          h("button", { type: "button", class: "close-x secondary outline", "aria-label": "Cerrar", onClick: () => close(undefined), text: "✕" })
        ),
        build(close)
      )
    );
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) close(undefined);
    });
    dlg.addEventListener("close", () => {
      dlg.remove();
      document.documentElement.classList.remove("modal-is-open");
      if (opener && document.contains(opener)) opener.focus();
      resolve(result);
    });
    document.body.append(dlg);
    document.documentElement.classList.add("modal-is-open");
    dlg.showModal();
  });
}

export function confirmDialog(title, message, okLabel = "Aceptar") {
  return modal(title, (close) =>
    h(
      "div",
      {},
      h("p", { text: message }),
      h(
        "div",
        { class: "btn-row" },
        h("button", { type: "button", class: "secondary", onClick: () => close(false), text: "Cancelar" }),
        h("button", { type: "button", autofocus: true, onClick: () => close(true), text: okLabel })
      )
    )
  ).then(Boolean);
}

export function avatar(u) {
  const wrap = h("span", { class: "avatar", "aria-hidden": "true" });
  wrap.style.setProperty("--user-color", safeColor(u.color));
  wrap.append(h("span", { class: "avatar-initial", text: (u.name || "?").charAt(0) }));
  const src = safeImagePath(u.imagePath);
  if (src) {
    const img = h("img", { src, alt: "", width: 40, height: 40, loading: "lazy" });
    img.addEventListener("error", () => img.remove());
    wrap.append(img);
  }
  return wrap;
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "2-digit" });
const numFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export function fmtDate(s, short = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? "")) return s ?? "";
  return (short ? shortFmt : dateFmt).format(new Date(`${s}T00:00:00`));
}
export const fmtNum = (n) => numFmt.format(n);

export function setFieldError(input, msg) {
  input.setAttribute("aria-invalid", msg ? "true" : "false");
  const err = document.getElementById(input.getAttribute("aria-describedby") ?? "");
  if (err) {
    err.textContent = msg ?? "";
    err.classList.toggle("hidden", !msg);
  }
}

export function field(label, input, errId) {
  const wrap = h("div", { class: "field" }, h("label", { for: input.id, text: label }), input);
  if (errId) {
    input.setAttribute("aria-describedby", errId);
    wrap.append(h("p", { id: errId, class: "field-error hidden", role: "alert" }));
  }
  return wrap;
}

export function radioGroup(legend, name, options, value, action) {
  return h(
    "fieldset",
    { class: "segmented" },
    h("legend", { text: legend }),
    options.map((o) => {
      const id = `${name}-${o.value}`;
      return h(
        "label",
        { for: id, class: "seg" },
        h("input", { type: "radio", id, name, value: o.value, checked: o.value === value, dataset: action ? { action, fk: id } : { fk: id } }),
        h("span", { text: o.label })
      );
    })
  );
}

export function loadingView(title) {
  return [h("h1", { text: title }), h("p", { "aria-busy": "true", text: "Cargando…" })];
}
