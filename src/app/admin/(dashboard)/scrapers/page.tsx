import { getScraperStats } from "@/lib/admin-queries";
import { ScrapersClient } from "./scrapers-client";

type ScraperStat = {
  source: string;
  total: number;
  today: number;
  unprocessed: number;
  withError: number;
  lastScrape: Date | null;
};

export default async function ScrapersPage() {
  const stats = await getScraperStats();

  const sourceLabels: Record<string, string> = {
    redtickets: "RedTickets",
    entraste: "Entraste",
    cartelera: "Cartelera",
    mvd_eventos: "MVD Eventos",
    cobraticket: "CobraTicket",
    ticketfacil: "TicketFacil",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Scrapers</h1>
        <p className="text-zinc-500 text-sm">Estado de los scrapers y fuentes de datos</p>
      </div>

      <div className="border border-zinc-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left p-3 font-medium">Fuente</th>
              <th className="text-right p-3 font-medium">Total</th>
              <th className="text-right p-3 font-medium">Hoy</th>
              <th className="text-right p-3 font-medium">Sin procesar</th>
              <th className="text-right p-3 font-medium">Errores</th>
              <th className="text-right p-3 font-medium">Último scrape</th>
              <th className="text-center p-3 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {stats.map((stat: ScraperStat) => (
              <tr key={stat.source} className="hover:bg-zinc-900/50">
                <td className="p-3 text-zinc-200 font-medium">
                  {sourceLabels[stat.source] || stat.source}
                </td>
                <td className="p-3 text-right text-zinc-400">{stat.total}</td>
                <td className="p-3 text-right text-zinc-400">{stat.today}</td>
                <td className="p-3 text-right text-zinc-400">{stat.unprocessed}</td>
                <td className="p-3 text-right text-red-400">{stat.withError}</td>
                <td className="p-3 text-right text-zinc-500">
                  {stat.lastScrape
                    ? new Date(stat.lastScrape).toLocaleString("es-UY", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="p-3 text-center">
                  <ScrapersClient source={stat.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
