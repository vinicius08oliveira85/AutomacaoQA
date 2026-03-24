import {
  AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "./types";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      defaultUrl:
        typeof parsed.defaultUrl === "string" && parsed.defaultUrl.trim()
          ? parsed.defaultUrl.trim()
          : DEFAULT_SETTINGS.defaultUrl,
      startRecordingOnLoad: Boolean(parsed.startRecordingOnLoad),
      confirmBeforeClear:
        parsed.confirmBeforeClear !== undefined
          ? Boolean(parsed.confirmBeforeClear)
          : DEFAULT_SETTINGS.confirmBeforeClear,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
