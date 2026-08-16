import type {
  GenerationDialogInput,
  ModalResult,
} from "../application/modal-result";

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage(message: unknown): void;
      };
    };
    webkit?: {
      messageHandlers?: {
        live?: {
          postMessage(message: unknown): void;
        };
      };
    };
  }
}

export function readDialogInput(): GenerationDialogInput {
  const encodedInput = window.location.hash.slice(1);
  if (!encodedInput) {
    // `vite dev` has no Live host to supply a recipe; the branch is stripped
    // from the packaged single-file build.
    if (import.meta.env.DEV) return DEV_DIALOG_INPUT;
    throw new Error("The extension did not provide initial generation data.");
  }

  return JSON.parse(decodeURIComponent(encodedInput)) as GenerationDialogInput;
}

export function closeModal(result: ModalResult): void {
  const message = {
    method: "close_and_send",
    params: [JSON.stringify(result)],
  };

  if (import.meta.env.DEV && !window.webkit?.messageHandlers?.live && !window.chrome?.webview) {
    console.info("[dev] modal result", result);
    return;
  }

  const macHandler = window.webkit?.messageHandlers?.live;
  if (macHandler) {
    macHandler.postMessage(message);
    return;
  }

  const windowsHandler = window.chrome?.webview;
  if (windowsHandler) {
    windowsHandler.postMessage(message);
    return;
  }

  throw new Error("Ableton Live's modal bridge is unavailable.");
}

const DEV_DIALOG_INPUT: GenerationDialogInput = {
  recipe: {
    engineVersion: 6,
    seed: 1774,
    parameters: {
      rootPitchClass: 2,
      scale: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
      motion: 0.45,
      tension: 0.38,
      space: 0.6,
      drift: 0.35,
    },
    lanes: [
      { id: "dev-1", role: "bass", octaveOffset: 0, enabled: true, style: "articulated" },
      { id: "dev-2", role: "drone", octaveOffset: -1, enabled: true },
      { id: "dev-3", role: "pad", octaveOffset: 0, enabled: true },
      { id: "dev-4", role: "arp-source", octaveOffset: 0, enabled: true },
      { id: "dev-5", role: "lead", octaveOffset: 0, enabled: true, style: "flow" },
      { id: "dev-6", role: "pad", octaveOffset: 1, enabled: false },
    ],
  },
  destination: {
    lanes: [
      { id: "dev-1", trackName: "Sub Bass", occupiedCount: 0 },
      { id: "dev-2", trackName: "Drone Rhodes", occupiedCount: 0 },
      { id: "dev-3", trackName: "Pad Omnisphere", occupiedCount: 2 },
      { id: "dev-4", trackName: "Arp Source", occupiedCount: 0 },
      { id: "dev-5", trackName: "Lead Prophet", occupiedCount: 0 },
      { id: "dev-6", trackName: "Pad Layer B", occupiedCount: 0 },
    ],
    occupiedCount: 2,
    missingSceneCount: 1,
  },
};
