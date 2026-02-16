export const scraperConfig = {
  redticketsBaseUrl: "https://redtickets.uy",
  entrasteBaseUrl: "https://www.entraste.com",
  requestsPerSecond: 1,
  retryAttempts: 3,
  timeoutMs: 15_000,
} as const;
