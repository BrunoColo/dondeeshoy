"use client";

import { useEffect, useState, useCallback } from "react";

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  departments: string[] | null;
  eventTypes: string[] | null;
  frequency: "weekly" | "daily";
  verified: boolean;
  createdAt: string;
};

type Stats = {
  total: number;
  verified: number;
  unverified: number;
  daily: number;
  weekly: number;
} | null;

export default function SubscriptionsPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSubscribers(data.subscribers);
      setTotalPages(data.pagination.pages);
      setTotal(data.pagination.total);
      if (data.stats) setStats(data.stats);
    } catch {
      console.error("Error fetching subscribers");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar suscriptor ${email}?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
      if (stats) setStats({ ...stats, total: stats.total - 1 });
    } catch {
      alert("Error al eliminar suscriptor");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">Suscripciones</h1>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total },
            { label: "Verificados", value: stats.verified },
            { label: "Sin verificar", value: stats.unverified },
            { label: "Diario", value: stats.daily },
            { label: "Semanal", value: stats.weekly },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className="text-lg font-bold text-zinc-100">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por email..."
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-zinc-800 text-zinc-100 text-sm rounded hover:bg-zinc-700 transition-colors"
        >
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Estado</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Frecuencia</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Departamentos</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Tipos</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Fecha</th>
              <th className="px-4 py-3 font-medium w-16" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/50 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-40 bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-16 bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-16 bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-24 bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-24 bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-20 bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 bg-zinc-800 rounded" /></td>
                </tr>
              ))
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No se encontraron suscriptores
                </td>
              </tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-100">
                    {sub.email}
                    {sub.name && <span className="text-zinc-500 ml-1 text-xs">({sub.name})</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        sub.verified
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {sub.verified ? "Verificado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-400 capitalize">
                    {sub.frequency === "daily" ? "Diario" : "Semanal"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-zinc-500 text-xs">
                    {sub.departments?.join(", ") || "Todos"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-zinc-500 text-xs">
                    {sub.eventTypes?.join(", ") || "Todos"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-500 text-xs">
                    {new Date(sub.createdAt).toLocaleDateString("es-UY")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(sub.id, sub.email)}
                      disabled={deleting === sub.id}
                      className="text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 text-xs"
                      title="Eliminar"
                    >
                      {deleting === sub.id ? "..." : "✕"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-zinc-500">
            {total} suscriptor{total !== 1 ? "es" : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors"
            >
              ← Anterior
            </button>
            <span className="px-3 py-1 text-zinc-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
