export const scraperConfig = {
  redticketsBaseUrl: "https://redtickets.uy",
  redticketsSearchUrl: "https://redtickets.uy/busqueda?,*,0,0",
  entrasteBaseUrl: "https://www.entraste.com",
  carteleraBaseUrl: "https://cartelera.montevideo.com.uy",
  carteleraFrontUrl: "https://www.cartelera.com.uy",
  mvdEventosBaseUrl: "https://eventos.montevideo.gub.uy",
  cobraticketBaseUrl: "https://cobraticket.uy/eventos",
  ticketfacilBaseUrl: "https://ticketfacil.uy",
  ticketfacilListUrl: "https://ticketfacil.uy/eventos/?category=todos",
  mientradaBaseUrl: "https://mientrada.com.uy",
  hayplanBaseUrl: "https://www.hayplanapp.com",
  hayplanBackendUrl: "https://hayplan-backend.onrender.com",
  requestsPerSecond: 1,
  retryAttempts: 3,
  timeoutMs: 15_000,
  /** Soft cap for paginated scrapers; they can stop earlier when pages go empty/stale */
  maxSearchPages: 75,
} as const;
