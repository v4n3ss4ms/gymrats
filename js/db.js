import {
  initializeApp, getAuth, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, deleteField, arrayUnion, arrayRemove,
  onSnapshot, serverTimestamp, waitForPendingWrites
} from "../vendor/firebase.js";
import { firebaseConfig } from "./firebase-config.js";
import { DELETE } from "./model.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const fs = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

let onError = () => {};
export function setErrorHandler(fn) {
  onError = fn;
}

function guard(promise) {
  return promise.catch((e) => {
    onError(e);
  });
}

function stamp(data) {
  return { ...data, updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp() };
}

export const union = (...v) => arrayUnion(...v);
export const remove = (...v) => arrayRemove(...v);

export function listen(name, cb, onErr) {
  return onSnapshot(
    collection(fs, name),
    { includeMetadataChanges: true },
    (snap) => {
      const map = {};
      snap.forEach((d) => {
        const { updatedAt, ...data } = d.data({ serverTimestamps: "estimate" });
        map[d.id] = { ...data, id: d.id };
      });
      cb(map, snap.metadata);
    },
    onErr
  );
}

export async function ensureUsers(seed) {
  for (const [uid, data] of Object.entries(seed)) {
    const ref = doc(fs, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, data);
  }
}

export function createDoc(col, data) {
  const ref = doc(collection(fs, col));
  guard(setDoc(ref, stamp(data)));
  return ref.id;
}

export function updateFields(col, id, fields) {
  const payload = {};
  for (const [k, v] of Object.entries(fields)) payload[k] = v === DELETE ? deleteField() : v;
  return guard(updateDoc(doc(fs, col, id), stamp(payload)));
}

export function removeDoc(col, id) {
  return guard(deleteDoc(doc(fs, col, id)));
}

export function saveExerciseState(id, data) {
  return guard(setDoc(doc(fs, "userExerciseState", id), data));
}

export function whenSynced() {
  return waitForPendingWrites(fs);
}
