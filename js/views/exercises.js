import * as dialogs from "../dialogs.js";
import { state, isReady } from "../state.js";
import { h, rerender, field, loadingView } from "../ui.js";
import { norm, safeImagePath } from "../model.js";

let query = "";
let showArchived = false;

export function mount(container) {
  container.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    dialogs.exerciseDialog(b.dataset.id || undefined);
  });
  container.addEventListener("input", (e) => {
    if (e.target.id === "ex-search") {
      query = e.target.value;
      render();
    }
  });
  container.addEventListener("change", (e) => {
    if (e.target.id === "ex-archived") {
      showArchived = e.target.checked;
      render();
    }
  });

  function card(ex) {
    const img = safeImagePath(ex.imagePath);
    const thumb = img ? h("img", { class: "thumb", src: img, alt: "", width: 64, height: 64, loading: "lazy" }) : null;
    thumb?.addEventListener("error", () => thumb.remove());
    return h(
      "article",
      { class: "card ex-row" },
      thumb,
      h("div", { class: "grow" },
        h("h2", { class: "card-title", text: ex.name }),
        h("p", { class: "muted small" },
          ex.hasAdjustment ? h("span", { class: "badge", text: "Con ajuste" }) : null,
          ex.archived ? h("span", { class: "badge", text: "Archivado" }) : null),
        ex.notes ? h("p", { class: "small clamp", text: ex.notes }) : null
      ),
      h("button", { type: "button", class: "secondary", "aria-label": `Editar ${ex.name}`, dataset: { action: "edit", id: ex.id }, text: "Editar" })
    );
  }

  function render() {
    if (!isReady()) return rerender(container, loadingView("Ejercicios"));
    const q = norm(query);
    const list = Object.values(state.exercises)
      .filter((e) => (showArchived || !e.archived) && norm(e.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    rerender(container, [
      h("h1", { text: "Ejercicios" }),
      h("div", { class: "toolbar" },
        field("Buscar", h("input", { id: "ex-search", type: "search", autocomplete: "off", value: query, dataset: { fk: "ex-search" } })),
        h("label", { class: "check" }, h("input", { id: "ex-archived", type: "checkbox", checked: showArchived, dataset: { fk: "ex-archived" } }), h("span", { text: "Mostrar archivados" })),
        h("button", { type: "button", dataset: { action: "new" }, text: "Nuevo ejercicio" })
      ),
      h("p", { class: "muted", role: "status", text: `${list.length} ${list.length === 1 ? "ejercicio" : "ejercicios"}` }),
      list.length ? h("div", { class: "cards" }, list.map(card)) : h("p", { class: "muted", text: "No hay ejercicios que mostrar." })
    ]);
  }
  return { title: () => "Ejercicios", render, destroy() {} };
}
