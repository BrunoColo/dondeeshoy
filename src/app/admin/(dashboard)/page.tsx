import { getAdminDashboardSnapshot } from "@/lib/admin-queries";

export const dynamic = "force-dynamic";

type DailyCount = { date: string; scraped: number; processed: number };
type EventTypeCount = { type: string; count: number };

export default async function AdminDashboardPage() {
  const { stats, dailyCounts, enhanced, traffic } = await getAdminDashboardSnapshot();

  const maxDaily = Math.max(
    ...dailyCounts.map((d: DailyCount) => Math.max(d.scraped, d.processed)),
    1
  );

  const otroCount = stats.eventsByType.find((t: EventTypeCount) => t.type === "otro")?.count ?? 0;
  const otroPercentage = stats.totalEvents > 0 ? Math.round((otroCount / stats.totalEvents) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Dashboard</h1>
        <p className="text-zinc-300 text-sm">Estadísticas generales del sistema</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Eventos Activos"
          value={stats.totalEvents.toLocaleString("es-UY")}
          sublabel="en la base de datos"
        />
        <KpiCard
          label="Creados Hoy"
          value={stats.eventsToday.toLocaleString("es-UY")}
          sublabel="nuevos eventos"
        />
        <KpiCard
          label="Raw Events"
          value={stats.unprocessedRaw.toLocaleString("es-UY")}
          sublabel="sin procesar"
          highlight={stats.unprocessedRaw > 0}
        />
        <KpiCard
          label="Submissions"
          value={stats.pendingSubmissions.toLocaleString("es-UY")}
          sublabel="pendientes"
          highlight={stats.pendingSubmissions > 0}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Próximos"
          value={enhanced.upcomingCount.toLocaleString("es-UY")}
          sublabel="eventos futuros"
        />
        <KpiCard
          label="Pasados"
          value={enhanced.pastCount.toLocaleString("es-UY")}
          sublabel="eventos anteriores"
        />
        <KpiCard
          label="Gratuitos"
          value={enhanced.freeCount.toLocaleString("es-UY")}
          sublabel={`${stats.totalEvents > 0 ? Math.round((enhanced.freeCount / stats.totalEvents) * 100) : 0}% del total`}
        />
        <KpiCard
          label="Sin clasificar"
          value={`${otroCount}`}
          sublabel={`${otroPercentage}% → tipo "otro"`}
          highlight={otroPercentage > 10}
        />
      </div>

      {/* Coverage Stats */}
      <div className="border border-zinc-800 rounded p-4">
        <h2 className="text-lg font-bold text-zinc-100 mb-4">Cobertura de Datos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProgressBar
            label="Con Precio"
            current={stats.withPrice}
            total={stats.totalEvents}
          />
          <ProgressBar
            label="Con Imagen"
            current={stats.withImage}
            total={stats.totalEvents}
          />
          <ProgressBar
            label="Con Ubicación"
            current={stats.withLocation}
            total={stats.totalEvents}
          />
        </div>
      </div>

      {/* Traffic Stats */}
      <div className="border border-zinc-800 rounded p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Tráfico y Engagement</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Señales en tiempo real de vistas de eventos y clicks en botones de entradas.
            </p>
          </div>
          <span className="text-[11px] text-zinc-500 uppercase tracking-wide">Hoy (UY)</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Vistas totales"
            value={traffic.totalEventViews.toLocaleString("es-UY")}
            sublabel="acumuladas en eventos activos"
          />
          <KpiCard
            label="Vistas hoy"
            value={traffic.viewsToday.toLocaleString("es-UY")}
            sublabel="detalle de eventos"
          />
          <KpiCard
            label="Clicks entradas hoy"
            value={traffic.ticketClicksToday.toLocaleString("es-UY")}
            sublabel="botón de compra/inscripción"
          />
          <KpiCard
            label="Promedio por evento"
            value={traffic.avgViewsPerActiveEvent.toLocaleString("es-UY", { maximumFractionDigits: 1 })}
            sublabel="vistas por evento activo"
          />
        </div>

        <div className="border border-zinc-800/60 rounded p-3">
          <h3 className="text-sm font-semibold text-zinc-200 mb-2">Top clicks de entradas (hoy)</h3>
          {traffic.topClickedToday.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Aún no hay clicks registrados hoy en botones de entradas.
            </p>
          ) : (
            <div className="space-y-2">
              {traffic.topClickedToday.map((event, i) => (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="text-zinc-500 w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 truncate">{event.name}</p>
                    <p className="text-zinc-400 text-xs truncate">
                      {event.venueName} · {new Date(event.date).toLocaleDateString("es-UY")}
                    </p>
                  </div>
                  <span className="text-zinc-300 text-xs whitespace-nowrap">
                    {event.ticketClicks} clicks
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout: Events by Type + Events by Source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Events by Type */}
        <div className="border border-zinc-800 rounded p-4">
          <h2 className="text-lg font-bold text-zinc-100 mb-4">Eventos por Tipo</h2>
          <div className="space-y-2">
            {stats.eventsByType
              .sort((a: EventTypeCount, b: EventTypeCount) => b.count - a.count)
              .map((item: EventTypeCount) => {
                const pct = stats.totalEvents > 0 ? Math.round((item.count / stats.totalEvents) * 100) : 0;
                return (
                  <div key={item.type} className="flex items-center gap-3">
                    <span className="text-zinc-300 capitalize text-sm w-28 truncate">{item.type}</span>
                    <div className="flex-1 h-4 bg-zinc-800 rounded-sm overflow-hidden">
                      <div
                        className={`h-full rounded-sm ${item.type === "otro" ? "bg-yellow-500/60" : "bg-zinc-600"}`}
                        style={{ width: `${pct}%`, minWidth: item.count > 0 ? "4px" : "0" }}
                      />
                    </div>
                    <span className="text-zinc-300 text-sm w-12 text-right">{item.count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Events by Source */}
        <div className="border border-zinc-800 rounded p-4">
          <h2 className="text-lg font-bold text-zinc-100 mb-4">Eventos por Fuente</h2>
          <div className="space-y-2">
            {enhanced.eventsBySource
              .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
              .map((item: { source: string; count: number }) => {
                const maxSource = Math.max(...enhanced.eventsBySource.map((s: { count: number }) => s.count), 1);
                const pct = Math.round((item.count / maxSource) * 100);
                return (
                  <div key={item.source} className="flex items-center gap-3">
                    <span className="text-zinc-300 text-sm w-28 truncate">{item.source}</span>
                    <div className="flex-1 h-4 bg-zinc-800 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-blue-500/40 rounded-sm"
                        style={{ width: `${pct}%`, minWidth: item.count > 0 ? "4px" : "0" }}
                      />
                    </div>
                    <span className="text-zinc-300 text-sm w-12 text-right">{item.count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Events by City/Department */}
      <div className="border border-zinc-800 rounded p-4">
        <h2 className="text-lg font-bold text-zinc-100 mb-4">Eventos por Departamento</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {enhanced.eventsByCity.map((item: { department: string; count: number }) => (
            <div key={item.department} className="flex justify-between text-sm border border-zinc-800/50 rounded p-2">
              <span className="text-zinc-300 truncate">{item.department}</span>
              <span className="text-zinc-200 ml-2 font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Chart */}
      <div className="border border-zinc-800 rounded p-4">
        <h2 className="text-lg font-bold text-zinc-100 mb-4">Últimos 7 días</h2>
        <div className="space-y-3">
          {dailyCounts.map((day: DailyCount) => (
            <div key={day.date} className="flex items-center gap-4">
              <span className="text-xs text-zinc-300 w-20">
                {new Date(day.date).toLocaleDateString("es-UY", {
                  weekday: "short",
                  day: "numeric",
                })}
              </span>
              <div className="flex-1 flex gap-1">
                <div
                  className="h-4 bg-zinc-700 rounded-sm"
                  style={{ width: `${(day.scraped / maxDaily) * 100}%`, minWidth: day.scraped > 0 ? "4px" : "0" }}
                />
              </div>
              <span className="text-xs text-zinc-300 w-12 text-right">
                {day.scraped}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-zinc-300">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-zinc-700 rounded-sm" />
            Scraped
          </span>
        </div>
      </div>

      {/* Two-column: Top Viewed + Recently Created */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Viewed Events */}
        <div className="border border-zinc-800 rounded p-4">
          <h2 className="text-lg font-bold text-zinc-100 mb-4">Más Vistos</h2>
          <div className="space-y-2">
            {enhanced.topViewed.map(
              (event: { id: string; name: string; viewCount: number; date: string; venueName: string; eventType: string }, i: number) => (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="text-zinc-400 w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 truncate">{event.name}</p>
                    <p className="text-zinc-300 text-xs truncate">
                      {event.venueName} · <span className="capitalize">{event.eventType}</span>
                    </p>
                  </div>
                  <span className="text-zinc-300 text-xs whitespace-nowrap">
                    {event.viewCount} vistas
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Recently Created Events */}
        <div className="border border-zinc-800 rounded p-4">
          <h2 className="text-lg font-bold text-zinc-100 mb-4">Recién Creados</h2>
          <div className="space-y-2">
            {enhanced.recentEvents.map(
              (event: { id: string; name: string; date: string; venueName: string; eventType: string; department: string; createdAt: Date }) => (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 truncate">{event.name}</p>
                    <p className="text-zinc-300 text-xs truncate">
                      {event.venueName} · {event.department} · <span className="capitalize">{event.eventType}</span>
                    </p>
                  </div>
                  <span className="text-zinc-300 text-xs whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleDateString("es-UY", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string;
  sublabel: string;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded p-4 ${highlight ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-800"}`}>
      <p className="text-xs text-zinc-300 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-yellow-400" : "text-zinc-100"}`}>
        {value}
      </p>
      <p className="text-xs text-zinc-400">{sublabel}</p>
    </div>
  );
}

function ProgressBar({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-200">
          {current} / {total} ({percentage}%)
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-600 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
