import { Practice, sceneView } from "./domain.js";
import { mount } from "../sandbox/scene.js";
try {
  const w = new Practice();
  for (const [actor, cell, kind] of [
    ["A", 41, 2],
    ["B", 49, 3],
    ["C", 39, 4],
    ["B", 50, 3],
    ["C", 31, 7],
  ])
    w.apply(actor, { type: "build", cell, kind, rotation: 0 });
  const scene = mount(document.getElementById("island"), () => {});
  scene.rebuild(sceneView(w.snapshot()));
  window.addEventListener("pagehide", () => scene.dispose(), { once: true });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) location.reload();
  });
} catch {
  document.getElementById("preview-note").textContent =
    "CITY ZERO requires WebGL 2 for the live preview.";
}
