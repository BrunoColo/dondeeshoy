"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type Event = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string;
  venueAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  city: string;
  eventType: string;
  musicGenre: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  isFree: boolean;
  ageRestriction: number | null;
  confidenceScore: string;
  viewCount: number;
  isRecurring: boolean;
  status: "active" | "cancelled" | "past";
  createdAt: string;
  updatedAt: string;
};

type RejectedEvent = {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  scrapedAt: string;
  processingError: string;
};

type BannedEvent = {
  id: string;
  normalizedName: string;
  originalName: string;
  source: string | null;
  sourceId: string | null;
  reason: string | null;
  bannedAt: string;
};

const EVENT_TYPES = [
  "fiesta",
  "festival",
  "concierto",
  "recital",
  "cultural",
  "deportivo",
  "gastronomico",
  "familiar",
  "feria",
  "taller",
  "club",
  "bar",
  "teatro",
  "otro",
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal states
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Event>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rejected events
  const [rejectedEvents, setRejectedEvents] = useState<RejectedEvent[]>([]);
  const [rejectedLoading, setRejectedLoading] = useState(false);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [rejectedTotalPages, setRejectedTotalPages] = useState(1);
  const [rejectedTotal, setRejectedTotal] = useState(0);

  // Banned events
  const [bannedEvents, setBannedEvents] = useState<BannedEvent[]>([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedPage, setBannedPage] = useState(1);
  const [bannedTotalPages, setBannedTotalPages] = useState(1);
  const [bannedTotal, setBannedTotal] = useState(0);
  const [unbanning, setUnbanning] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"events" | "rejected" | "banned">("events");

  useEffect(() => {
    loadEvents();
  }, [page]);

  useEffect(() => {
    if (activeTab === "rejected") {
      loadRejectedEvents();
    }
    if (activeTab === "banned") {
      loadBannedEvents();
    }
  }, [activeTab, rejectedPage, bannedPage]);

  useEffect(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    const timeout = setTimeout(() => {
      setPage(1);
      loadEvents(searchQuery);
    }, 300);
    
    setDebounceTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery]);

  async function loadEvents(query?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("page", page.toString());
      params.set("limit", "20");
      
      const res = await fetch(`/api/admin/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items || []);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRejectedEvents() {
    setRejectedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", rejectedPage.toString());
      params.set("limit", "50");
      
      const res = await fetch(`/api/admin/rejected?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRejectedEvents(data.items || []);
        setRejectedTotalPages(data.totalPages);
        setRejectedTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to load rejected events:", error);
    } finally {
      setRejectedLoading(false);
    }
  }

  async function loadBannedEvents() {
    setBannedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", bannedPage.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/admin/banned?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBannedEvents(data.items || []);
        setBannedTotalPages(data.totalPages);
        setBannedTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to load banned events:", error);
    } finally {
      setBannedLoading(false);
    }
  }

  async function handleUnban(id: string) {
    if (!confirm("¿Desbanear este evento? Podrá volver a aparecer en el sitio si es scrapeado de nuevo.")) {
      return;
    }
    setUnbanning(id);
    try {
      const res = await fetch(`/api/admin/banned/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBannedEvents(bannedEvents.filter(e => e.id !== id));
        setBannedTotal(t => t - 1);
      } else {
        alert("Error al desbanear");
      }
    } catch (error) {
      console.error("Failed to unban:", error);
      alert("Error al desbanear");
    } finally {
      setUnbanning(null);
    }
  }

  function handleEdit(event: Event) {
    setSelectedEvent(event);
    setEditForm({
      name: event.name,
      description: event.description,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      city: event.city,
      eventType: event.eventType,
      musicGenre: event.musicGenre,
      imageUrl: event.imageUrl,
      ticketUrl: event.ticketUrl,
      priceMin: event.priceMin,
      priceMax: event.priceMax,
      isFree: event.isFree,
      ageRestriction: event.ageRestriction,
      status: event.status,
    });
    setIsEditing(false);
  }

  async function handleSave() {
    if (!selectedEvent) return;
    setSaving(true);
    
    try {
      const res = await fetch(`/api/admin/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setEvents(events.map(e => e.id === updated.id ? updated : e));
        setSelectedEvent(updated);
        setIsEditing(false);
      } else {
        const data = await res.json();
        alert(data.error || "Error al guardar");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedEvent) return;
    
    if (!confirm(`¿Eliminar y BANEAR "${selectedEvent.name}"?\n\nEl evento será eliminado y baneado: no volverá a aparecer aunque sea scrapeado de nuevo.\n\nPodés desbanearlo desde la pestaña "Baneados" si cambiás de opinión.`)) {
      return;
    }
    
    setDeleting(true);
    
    try {
      const res = await fetch(`/api/admin/events/${selectedEvent.id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        setEvents(events.filter(e => e.id !== selectedEvent.id));
        setSelectedEvent(null);
        setIsEditing(false);
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Eventos</h1>
        <p className="text-zinc-500 text-sm">Gestión de eventos en la base de datos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "events"
              ? "text-zinc-100 border-b-2 border-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Eventos ({total})
        </button>
        <button
          onClick={() => setActiveTab("rejected")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "rejected"
              ? "text-zinc-100 border-b-2 border-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Rechazados ({rejectedTotal})
        </button>
        <button
          onClick={() => setActiveTab("banned")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "banned"
              ? "text-zinc-100 border-b-2 border-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          🚫 Baneados ({bannedTotal})
        </button>
      </div>

      {activeTab === "events" && (
        <>
          {/* Search */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Buscar eventos por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Results info */}
          <div className="flex justify-between items-center text-sm text-zinc-500">
            <span>
              {total} evento{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              {searchQuery && ` para "${searchQuery}"`}
            </span>
          </div>

          {/* Table */}
      <div className="border border-zinc-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Evento</th>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 font-medium">Venue</th>
              <th className="text-left px-4 py-3 font-medium">Ciudad</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No se encontraron eventos
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3 text-zinc-100 max-w-xs truncate">{event.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{event.date}</td>
                  <td className="px-4 py-3 text-zinc-400 capitalize">{event.eventType}</td>
                  <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{event.venueName}</td>
                  <td className="px-4 py-3 text-zinc-400">{event.city}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        event.status === "active"
                          ? "bg-green-500/20 text-green-400"
                          : event.status === "cancelled"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleEdit(event)}
                      className="text-blue-400 hover:text-blue-300 text-xs underline"
                    >
                      Editar
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
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="px-3 py-1 text-zinc-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      )}

      </>
      )}

      {/* REJECTED TAB */}
      {activeTab === "rejected" && (
        <>
          <div className="text-sm text-zinc-500 mb-4">
            {rejectedTotal} evento{rejectedTotal !== 1 ? "s" : ""} rechazado{rejectedTotal !== 1 ? "s" : ""} por no ser eventos válidos
          </div>

          {/* Rejected Table */}
          <div className="border border-zinc-800 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Título</th>
                  <th className="text-left px-4 py-3 font-medium">Fuente</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha scrapeo</th>
                  <th className="text-left px-4 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rejectedLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                      Cargando...
                    </td>
                  </tr>
                ) : rejectedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                      No hay eventos rechazados
                    </td>
                  </tr>
                ) : (
                  rejectedEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-3 text-zinc-100 max-w-md truncate">{event.title}</td>
                      <td className="px-4 py-3 text-zinc-400">{event.source}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {new Date(event.scrapedAt).toLocaleDateString("es-UY")}
                      </td>
                      <td className="px-4 py-3 text-red-400 text-xs max-w-xs">
                        {event.processingError}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Rejected Pagination */}
          {rejectedTotalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setRejectedPage(p => Math.max(1, p - 1))}
                disabled={rejectedPage === 1}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1 text-zinc-500">
                {rejectedPage} / {rejectedTotalPages}
              </span>
              <button
                onClick={() => setRejectedPage(p => Math.min(rejectedTotalPages, p + 1))}
                disabled={rejectedPage === rejectedTotalPages}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {/* BANNED TAB */}
      {activeTab === "banned" && (
        <>
          <div className="text-sm text-zinc-500 mb-4">
            {bannedTotal} evento{bannedTotal !== 1 ? "s" : ""} baneado{bannedTotal !== 1 ? "s" : ""} — no volverán a aparecer en el sitio aunque sean scrapeados de nuevo.
          </div>

          <div className="border border-zinc-800 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nombre original</th>
                  <th className="text-left px-4 py-3 font-medium">Fuente</th>
                  <th className="text-left px-4 py-3 font-medium">Source ID</th>
                  <th className="text-left px-4 py-3 font-medium">Motivo</th>
                  <th className="text-left px-4 py-3 font-medium">Baneado</th>
                  <th className="text-left px-4 py-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {bannedLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      Cargando...
                    </td>
                  </tr>
                ) : bannedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No hay eventos baneados
                    </td>
                  </tr>
                ) : (
                  bannedEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-3 text-zinc-100 max-w-xs truncate">{event.originalName}</td>
                      <td className="px-4 py-3 text-zinc-400">{event.source ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs font-mono max-w-[120px] truncate">{event.sourceId ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs max-w-xs truncate">{event.reason ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {new Date(event.bannedAt).toLocaleDateString("es-UY")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleUnban(event.id)}
                          disabled={unbanning === event.id}
                          className="text-orange-400 hover:text-orange-300 text-xs underline disabled:opacity-50"
                        >
                          {unbanning === event.id ? "..." : "Desbanear"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {bannedTotalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setBannedPage(p => Math.max(1, p - 1))}
                disabled={bannedPage === 1}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1 text-zinc-500">
                {bannedPage} / {bannedTotalPages}
              </span>
              <button
                onClick={() => setBannedPage(p => Math.min(bannedTotalPages, p + 1))}
                disabled={bannedPage === bannedTotalPages}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {(selectedEvent || isEditing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-zinc-100">
                  {isEditing ? "Editar Evento" : "Ver Evento"}
                </h2>
                <button
                  onClick={() => {
                    setSelectedEvent(null);
                    setIsEditing(false);
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>

              {selectedEvent?.imageUrl && (
                <div className="mb-6 relative w-full h-48">
                  <Image
                    src={selectedEvent.imageUrl}
                    alt={selectedEvent.name}
                    fill
                    className="object-cover rounded"
                    unoptimized
                  />
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Nombre</label>
                  <input
                    type="text"
                    value={isEditing ? editForm.name ?? "" : selectedEvent?.name ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Descripción</label>
                  <textarea
                    value={isEditing ? editForm.description ?? "" : selectedEvent?.description ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value || null })}
                    disabled={!isEditing}
                    rows={3}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500 resize-none"
                  />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Fecha</label>
                    <input
                      type="date"
                      value={isEditing ? editForm.date ?? "" : selectedEvent?.date ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Hora inicio</label>
                    <input
                      type="time"
                      value={isEditing ? editForm.startTime ?? "" : selectedEvent?.startTime ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value || null })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Hora fin</label>
                    <input
                      type="time"
                      value={isEditing ? editForm.endTime ?? "" : selectedEvent?.endTime ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value || null })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                </div>

                {/* Venue */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Venue</label>
                    <input
                      type="text"
                      value={isEditing ? editForm.venueName ?? "" : selectedEvent?.venueName ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, venueName: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Dirección</label>
                    <input
                      type="text"
                      value={isEditing ? editForm.venueAddress ?? "" : selectedEvent?.venueAddress ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, venueAddress: e.target.value || null })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                </div>

                {/* City and Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Ciudad</label>
                    <input
                      type="text"
                      value={isEditing ? editForm.city ?? "" : selectedEvent?.city ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Tipo</label>
                    <select
                      value={isEditing ? editForm.eventType ?? "" : selectedEvent?.eventType ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, eventType: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    >
                      {EVENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Music Genre */}
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Género musical</label>
                  <input
                    type="text"
                    value={isEditing ? editForm.musicGenre ?? "" : selectedEvent?.musicGenre ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, musicGenre: e.target.value || null })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                  />
                </div>

                {/* Prices */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Precio mín</label>
                    <input
                      type="number"
                      value={isEditing ? editForm.priceMin ?? "" : selectedEvent?.priceMin ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, priceMin: e.target.value ? parseInt(e.target.value) : null })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Precio máx</label>
                    <input
                      type="number"
                      value={isEditing ? editForm.priceMax ?? "" : selectedEvent?.priceMax ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, priceMax: e.target.value ? parseInt(e.target.value) : null })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Moneda</label>
                    <input
                      type="text"
                      value={isEditing ? editForm.currency ?? "" : selectedEvent?.currency ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                </div>

                {/* Free and Age */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isFree"
                      checked={isEditing ? editForm.isFree ?? false : selectedEvent?.isFree ?? false}
                      onChange={(e) => setEditForm({ ...editForm, isFree: e.target.checked })}
                      disabled={!isEditing}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <label htmlFor="isFree" className="text-zinc-300 text-sm">Evento gratuito</label>
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Restricción edad</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={isEditing ? editForm.ageRestriction ?? "" : selectedEvent?.ageRestriction ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, ageRestriction: e.target.value ? parseInt(e.target.value) : null })}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Status</label>
                  <select
                    value={isEditing ? editForm.status ?? "" : selectedEvent?.status ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as "active" | "cancelled" | "past" })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500"
                  >
                    <option value="active">Activo</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="past">Pasado</option>
                  </select>
                </div>

                {/* URLs */}
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Image URL</label>
                  <input
                    type="text"
                    value={isEditing ? editForm.imageUrl ?? "" : selectedEvent?.imageUrl ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value || null })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Ticket URL</label>
                  <input
                    type="text"
                    value={isEditing ? editForm.ticketUrl ?? "" : selectedEvent?.ticketUrl ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, ticketUrl: e.target.value || null })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 disabled:text-zinc-500 text-sm"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-zinc-800 flex gap-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Eliminando..." : "🚫 Eliminar y banear"}
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                    >
                      Editar evento
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
