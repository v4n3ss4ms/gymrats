import * as auth from "../auth.js";
import { h } from "../ui.js";

export function mount(container) {
  const user = h("input", {
    id: "login-user", type: "text", name: "username", autocomplete: "username", autocapitalize: "none",
    autocorrect: "off", spellcheck: "false", required: true, "aria-describedby": "login-error"
  });
  const pass = h("input", {
    id: "login-pass", type: "password", name: "password", autocomplete: "current-password",
    required: true, "aria-describedby": "login-error"
  });
  const err = h("p", { id: "login-error", class: "field-error", role: "alert" });
  const btn = h("button", { type: "submit", text: "Entrar" });
  const form = h(
    "form",
    { class: "login", novalidate: true },
    h("label", { for: "login-user", text: "Usuario" }),
    user,
    h("label", { for: "login-pass", text: "Contraseña" }),
    pass,
    err,
    btn
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    user.setAttribute("aria-invalid", "false");
    pass.setAttribute("aria-invalid", "false");
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    try {
      await auth.login(user.value, pass.value);
    } catch (ex) {
      err.textContent = ex.message;
      user.setAttribute("aria-invalid", "true");
      pass.setAttribute("aria-invalid", "true");
      (user.value ? pass : user).focus();
    } finally {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  });
  container.append(h("h1", { text: "Entrar" }), form);
  return { title: () => "Entrar", render() {}, destroy() {} };
}
