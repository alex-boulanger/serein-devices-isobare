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
    throw new Error("The extension did not provide initial generation data.");
  }

  return JSON.parse(decodeURIComponent(encodedInput)) as GenerationDialogInput;
}

export function closeModal(result: ModalResult): void {
  const message = {
    method: "close_and_send",
    params: [JSON.stringify(result)],
  };

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
