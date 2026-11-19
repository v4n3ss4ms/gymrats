import { state, allSessions, person, UIDS, isReady } from "../state.js";
import { h, rerender, field, radioGroup, fmtDate, fmtNum, loadingView } from "../ui.js";
import { hasReps, setKeys, safeColor } from "../model.js";

const ui = { uid: null, exId: "", compare: false, volume: false };
const MARKERS = ["circle", "rect", "triangle", "rectRot"];

function points(uid, exId) {
  const byDate = new Map();
  for (const s of allSessions()) {
    if (s.uid !== uid) continue;
    const ex = s.exercises?.[exId];
    if (!ex) continue;
    const sets = setKeys(ex).map((k) => ex.sets[k]).filter(hasReps);
    if (!sets.length) continue;
    const cur = byDate.get(s.date) ?? { date: s.date, kg: 0, reps: 0, volume: 0 };
    cur.kg = Math.max(cur.kg, ...sets.map((x) => x.kg || 0));
    cur.reps = Math.max(cur.reps, ...sets.map((x) => x.reps));
    cur.volume += sets.reduce((a, x) => a + x.reps * (x.kg || 0), 0);
    byDate.set(s.date, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function mount(container) {
  let chart = null;
  let chartKey = null;
  const box = h("div", { class: "chart-box" });
  let canvas = null;
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    chartKey = null;
    render();
  };
  mq.addEventListener("change", onScheme);

  container.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "cperson") ui.uid = t.value;
    else if (t.id === "c-ex") ui.exId = t.value;
    else if (t.id === "c-compare") ui.compare = t.checked;
    else if (t.id === "c-volume") ui.volume = t.checked;
    else return;
    render();
  });

  function ensureChart(spec) {
    const key = JSON.stringify(spec.key);
    if (canvas) canvas.setAttribute("aria-label", spec.summary);
    if (key === chartKey && chart) return;
    chartKey = key;
    chart?.destroy();
    chart = null;
    box.replaceChildren();
    if (!spec.datasets.length || !window.Chart) return;
    canvas = h("canvas", { role: "img", "aria-label": spec.summary });
    box.append(canvas);
    const text = cssVar("--pico-color", "#333");
    const grid = cssVar("--pico-muted-border-color", "#ccc");
    const scale = (extra = {}) => ({ ticks: { color: text }, grid: { color: grid }, ...extra });
    chart = new window.Chart(canvas, {
      type: "line",
      data: { labels: spec.labels.map((d) => fmtDate(d, true)), datasets: spec.datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(matchMedia("(prefers-reduced-motion: reduce)").matches ? { animation: false } : {}),
        plugins: { legend: { labels: { color: text, usePointStyle: true } } },
        scales: {
          x: scale(),
          y: scale({ beginAtZero: true, title: { display: true, text: spec.unit, color: text } }),
          ...(spec.hasVolume ? { y1: scale({ position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "Volumen (kg)", color: text } }) } : {})
        }
      }
    });
  }

  function render() {
    if (!isReady()) return rerender(container, loadingView("Gráficas"));
    ui.uid ??= state.uid;
    const other = UIDS.find((u) => u !== ui.uid);
    const people = ui.compare ? [ui.uid, other] : [ui.uid];
    const withData = (u) => new Set(Object.keys(state.exercises).filter((id) => points(u, id).length));
    const available = new Set([...withData(ui.uid), ...(ui.compare ? withData(other) : [])]);
    const options = [...available].sort((a, b) => state.exercises[a].name.localeCompare(state.exercises[b].name, "es"));
    if (!available.has(ui.exId)) ui.exId = options[0] ?? "";
    const exName = state.exercises[ui.exId]?.name ?? "";

    const series = people.map((u) => ({ uid: u, pts: ui.exId ? points(u, ui.exId) : [] }));
    const useKg = series.some((s) => s.pts.some((p) => p.kg > 0));
    const metric = useKg ? "kg" : "reps";
    const unit = useKg ? "Kilos (máximo por sesión)" : "Repeticiones (máximo por sesión)";
    const labels = [...new Set(series.flatMap((s) => s.pts.map((p) => p.date)))].sort();
    const hasVolume = ui.volume && useKg;
    const datasets = [];
    series.forEach((s, i) => {
      if (!s.pts.length) return;
      const map = new Map(s.pts.map((p) => [p.date, p]));
      const color = safeColor(person(s.uid).color);
      const base = { borderColor: color, backgroundColor: color, pointStyle: MARKERS[i % MARKERS.length], pointRadius: 5, pointHoverRadius: 7, spanGaps: true, tension: 0.2, borderDash: i ? [8, 4] : [] };
      datasets.push({ ...base, label: `${person(s.uid).name} · ${useKg ? "kg" : "reps"}`, data: labels.map((d) => map.get(d)?.[metric] ?? null) });
      if (hasVolume) {
        datasets.push({ ...base, label: `${person(s.uid).name} · volumen`, yAxisID: "y1", pointStyle: MARKERS[(i + 2) % MARKERS.length], borderDash: [2, 4], data: labels.map((d) => map.get(d)?.volume ?? null) });
      }
    });

    const u = useKg ? "kg" : "reps";
    const summary = series.filter((s) => s.pts.length).map((s) => {
      const a = s.pts[0], b = s.pts[s.pts.length - 1];
      const n = person(s.uid).name;
      return s.pts.length === 1
        ? `${exName} de ${n}: ${fmtNum(a[metric])} ${u} el ${fmtDate(a.date)}`
        : `${exName} de ${n}: de ${fmtNum(a[metric])} ${u} el ${fmtDate(a.date)} a ${fmtNum(b[metric])} ${u} el ${fmtDate(b.date)}`;
    }).join(". ") || "Sin datos";

    const cols = datasets.map((d) => d.label);
    const table = h("details", { class: "chart-table" },
      h("summary", { text: "Ver datos en tabla" }),
      h("div", { class: "table-wrap" },
        h("table", {},
          h("caption", { text: `${exName || "Ejercicio"}: evolución por sesión` }),
          h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Fecha" }), cols.map((c) => h("th", { scope: "col", text: c })))),
          h("tbody", {}, labels.map((d, r) => h("tr", {}, h("th", { scope: "row", text: fmtDate(d) }), datasets.map((ds) => h("td", { text: ds.data[r] == null ? "—" : fmtNum(ds.data[r]) }))))))));

    rerender(container, [
      h("h1", { text: "Gráficas" }),
      radioGroup("Persona", "cperson", UIDS.map((x) => ({ value: x, label: person(x).name })), ui.uid),
      h("div", { class: "toolbar" },
        field("Ejercicio", h("select", { id: "c-ex", dataset: { fk: "c-ex" }, disabled: !options.length || null }, options.length ? options.map((id) => h("option", { value: id, text: state.exercises[id].name, selected: id === ui.exId })) : h("option", { text: "Sin datos" }))),
        h("label", { class: "check" }, h("input", { id: "c-compare", type: "checkbox", checked: ui.compare, dataset: { fk: "c-compare" } }), h("span", { text: `Comparar con ${person(other).name}` })),
        h("label", { class: "check" }, h("input", { id: "c-volume", type: "checkbox", checked: ui.volume, dataset: { fk: "c-volume" } }), h("span", { text: "Mostrar volumen" }))),
      datasets.length ? [h("p", { class: "muted", text: summary }), box, table] : h("p", { class: "muted", text: "Todavía no hay series registradas para graficar." })
    ]);
    ensureChart({ key: { labels, datasets: datasets.map((d) => [d.label, d.data]), unit, dark: mq.matches }, summary, datasets, labels, unit, hasVolume });
  }

  return {
    title: () => "Gráficas",
    render,
    destroy() {
      mq.removeEventListener("change", onScheme);
      chart?.destroy();
    }
  };
}
