export const uiDurations = {
  toastMs: 3000,
  shortToastMs: 2500,
  savedStatusMs: 2000,
  noteAutosaveMs: 1500,
  checkpointCreateTimeoutMs: 20000,
  authFunctionTimeoutMs: 20000,
  voiceAudioWaitMs: 5000,
  voiceTranscribeTimeoutMs: 25000,
  titleFetchTimeoutMs: 1500,
  pageTitleFetchTimeoutMs: 3000,
  transcriptionTimeoutMs: 20000
} as const;

export const uploadLimits = {
  pastedImageBytes: 2 * 1024 * 1024,
  inlineImageBytes: 2 * 1024 * 1024,
  inlineFileBytes: 5 * 1024 * 1024
} as const;

export const mermaidThemeVariables = {
  primaryColor: "#FFFFFF",
  primaryTextColor: "#111111",
  primaryBorderColor: "#E4E2DC",
  lineColor: "#6B6B6B",
  secondaryColor: "#F7F6F3",
  tertiaryColor: "#F0EEE9"
} as const;
