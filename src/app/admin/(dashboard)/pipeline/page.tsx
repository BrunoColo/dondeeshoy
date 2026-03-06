import { getPipelineStats, getRawEvents } from "@/lib/admin-queries";
import { PipelineClient } from "./pipeline-client";

export const dynamic = "force-dynamic";

type PipelineError = {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  error: string | null;
  scrapedAt: Date;
};

type RawEventItem = {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  scrapedAt: Date;
  processed: boolean;
  processingError: string | null;
};

export default async function PipelinePage() {
  const [stats, rawEventsData] = await Promise.all([
    getPipelineStats(),
    getRawEvents({}, 1, 50),
  ]);

  const sourceLabels: Record<string, string> = {
    redtickets: "RedTickets",
    entraste: "Entraste",
    cartelera: "Cartelera",
    mvd_eventos: "MVD",
    cobraticket: "Cobra",
    ticketfacil: "TicketFacil",
    mientrada: "MiEntrada",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Pipeline</h1>
        <p className="text-zinc-500 text-sm">Estado del procesamiento de eventos</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="border border-zinc-800 rounded p-4">
          <p className="text-xs text-zinc-500 mb-1">Raw Events</p>
          <p className="text-2xl font-bold text-zinc-100">{stats.totalRaw}</p>
        </div>
        <div className="border border-zinc-800 rounded p-4">
          <p className="text-xs text-zinc-500 mb-1">Procesados</p>
          <p className="text-2xl font-bold text-zinc-100">{stats.processed}</p>
        </div>
        <div className="border border-zinc-800 rounded p-4">
          <p className="text-xs text-zinc-500 mb-1">Errores</p>
          <p className="text-2xl font-bold text-red-400">{stats.withError}</p>
        </div>
        <div className="border border-zinc-800 rounded p-4">
          <p className="text-xs text-zinc-500 mb-1">Eventos</p>
          <p className="text-2xl font-bold text-zinc-100">{stats.totalEvents}</p>
        </div>
        <div className="border border-zinc-800 rounded p-4">
          <p className="text-xs text-zinc-500 mb-1">Tasa Conversión</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <PipelineClient action="run" label="Run Pipeline" />
        <PipelineClient action="mark-past" label="Mark Past" />
      </div>

      {/* Recent Errors */}
      {stats.recentErrors.length > 0 && (
        <div className="border border-zinc-800 rounded">
          <div className="bg-red-900/20 px-4 py-2 border-b border-zinc-800">
            <h2 className="font-medium text-red-400">Errores Recientes</h2>
          </div>
          <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
            {stats.recentErrors.map((error: PipelineError) => (
              <div key={error.id} className="p-3 text-sm">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-zinc-400">{sourceLabels[error.source] || error.source}</span>
                  <span className="text-zinc-600 text-xs">
                    {error.scrapedAt ? new Date(error.scrapedAt).toLocaleString("es-UY") : ""}
                  </span>
                </div>
                <p className="text-red-400 mt-1 truncate">{error.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Events Table */}
      <div className="border border-zinc-800 rounded">
        <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800">
          <h2 className="font-medium text-zinc-300">Raw Events Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50 text-zinc-400">
              <tr>
                <th className="text-left p-3 font-medium">Fuente</th>
                <th className="text-left p-3 font-medium">Título</th>
                <th className="text-right p-3 font-medium">Scraped</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rawEventsData.items.map((item: RawEventItem) => (
                <tr key={item.id} className="hover:bg-zinc-900/30">
                  <td className="p-3 text-zinc-400">{sourceLabels[item.source] || item.source}</td>
                  <td className="p-3 text-zinc-300 max-w-xs truncate">{item.title}</td>
                  <td className="p-3 text-right text-zinc-500">
                    {item.scrapedAt
                      ? new Date(item.scrapedAt).toLocaleString("es-UY", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="p-3 text-center">
                    {item.processingError ? (
                      <span className="px-2 py-1 text-xs bg-red-900/30 text-red-400 rounded">Error</span>
                    ) : item.processed ? (
                      <span className="px-2 py-1 text-xs bg-green-900/30 text-green-400 rounded">OK</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 rounded">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <PipelineClient action={`reprocess/${item.id}`} label="Reprocesar" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rawEventsData.totalPages > 1 && (
          <div className="p-3 border-t border-zinc-800 text-center text-zinc-500 text-sm">
            Página {rawEventsData.page} de {rawEventsData.totalPages}
          </div>
        )}
      </div>
    </div>
  );
}
