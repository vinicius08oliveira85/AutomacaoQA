export interface Step {
  id: string;
  action: "click" | "type" | "navigate" | "wait";
  selector?: string;
  value?: string;
  text?: string;
  tagName?: string;
  status?: "pending" | "executing" | "success" | "error";
}

export interface InspectorData {
  selector: string;
  tagName: string;
  attributes: {
    id?: string;
    class?: string;
    name?: string;
  };
}

export interface AppSettings {
  defaultUrl: string;
  startRecordingOnLoad: boolean;
  confirmBeforeClear: boolean;
}

export const SETTINGS_STORAGE_KEY = "webflow-automator-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  defaultUrl: "https://www.google.com",
  startRecordingOnLoad: false,
  confirmBeforeClear: true,
};
