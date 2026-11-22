import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "../vendor/firebase.js";
import { auth } from "./db.js";
import { EMAIL_DOMAIN, USERS } from "./config.js";

const GENERIC = "Usuario o contraseña incorrectos.";

export async function login(username, password) {
  const u = String(username).trim().toLowerCase().split("@")[0];
  if (!Object.hasOwn(USERS, u) || !password) throw new Error(GENERIC);
  try {
    await signInWithEmailAndPassword(auth, `${u}@${EMAIL_DOMAIN}`, password);
  } catch (e) {
    throw new Error(authMessage(e));
  }
}

export function logout() {
  return signOut(auth);
}

export function onUser(cb) {
  const allowed = new Set(Object.values(USERS).map((u) => u.uid));
  return onAuthStateChanged(auth, (user) => {
    if (user && !allowed.has(user.uid)) {
      signOut(auth);
      return;
    }
    cb(user);
  });
}

function authMessage(e) {
  switch (e?.code) {
    case "auth/network-request-failed":
      return "Sin conexión. Comprueba la red e inténtalo de nuevo.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return GENERIC;
    default:
      return `No se pudo iniciar sesión (${e?.code ?? "error"}).`;
  }
}
