export const scraperConfig = {
  redticketsBaseUrl: "https://redtickets.uy",
  entrasteBaseUrl: "https://www.entraste.com",
  carteleraBaseUrl: "https://cartelera.montevideo.com.uy",
  carteleraFrontUrl: "https://www.cartelera.com.uy",
  mvdEventosBaseUrl: "https://eventos.montevideo.gub.uy",
  requestsPerSecond: 1,
  retryAttempts: 3,
  timeoutMs: 15_000,
} as const;
