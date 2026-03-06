"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

type Submission = {
  id: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  eventType: string;
  venueName: string;
  venueAddress: string;
  city: string;
  description: string;
  contactName: string;
  contactEmail: string;
  isFree: boolean;
  priceRange: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  submittedAt: string;
};

type Tab = "pending" | "approved" | "rejected";

export default function SubmissionsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(searchParams.get("status") as Tab || "pending");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadSubmissions(activeTab);
  }, [activeTab]);

  async function loadSubmissions(status: Tab) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.items || []);
      }
    } catch (error) {
      console.error("Failed to load submissions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedSubmission) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${selectedSubmission.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", notes: notes || undefined }),
      });
      if (res.ok) {
        setSelectedSubmission(null);
        setNotes("");
        loadSubmissions(activeTab);
      } else {
        const data = await res.json();
        alert(data.error || "Error al aprobar");
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      alert("Error al aprobar");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedSubmission) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${selectedSubmission.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", notes: notes || undefined }),
      });
      if (res.ok) {
        setSelectedSubmission(null);
        setNotes("");
        loadSubmissions(activeTab);
      } else {
        const data = await res.json();
        alert(data.error || "Error al rechazar");
      }
    } catch (error) {
      console.error("Failed to reject:", error);
      alert("Error al rechazar");
    } finally {
      setActionLoading(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "pending", label: "Pendientes" },
    { key: "approved", label: "Aprobadas" },
    { key: "rejected", label: "Rechazadas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Submissions</h1>
        <p className="text-zinc-500 text-sm">Gestión de eventos enviados por usuarios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-zinc-100 border-b-2 border-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
              <th className="text-left px-4 py-3 font-medium">Departamento</th>
              <th className="text-left px-4 py-3 font-medium">Contacto</th>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No hay submissions
                </td>
              </tr>
            ) : (
              submissions.map((sub) => (
                <tr
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  className="hover:bg-zinc-900/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-zinc-100 max-w-xs truncate">{sub.eventName}</td>
                  <td className="px-4 py-3 text-zinc-400">{sub.eventDate}</td>
                  <td className="px-4 py-3 text-zinc-400 capitalize">{sub.eventType}</td>
                  <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{sub.venueName}</td>
                  <td className="px-4 py-3 text-zinc-400">{sub.city}</td>
                  <td className="px-4 py-3 text-zinc-400">{sub.contactName}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(sub.submittedAt).toLocaleDateString("es-UY")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        sub.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : sub.status === "approved"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-zinc-100">{selectedSubmission.eventName}</h2>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>

              {selectedSubmission.imageUrl && (
                <div className="mb-6 relative w-full h-48">
                  <Image
                    src={selectedSubmission.imageUrl}
                    alt={selectedSubmission.eventName}
                    fill
                    className="object-cover rounded"
                    unoptimized
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-zinc-500 text-xs">Fecha</p>
                    <p className="text-zinc-100">{selectedSubmission.eventDate}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Hora</p>
                    <p className="text-zinc-100">{selectedSubmission.eventTime || "—"}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Tipo</p>
                    <p className="text-zinc-100 capitalize">{selectedSubmission.eventType}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Precio</p>
                    <p className="text-zinc-100">
                      {selectedSubmission.isFree ? "Gratis" : selectedSubmission.priceRange || "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-zinc-500 text-xs">Venue</p>
                  <p className="text-zinc-100">{selectedSubmission.venueName}</p>
                  <p className="text-zinc-400 text-sm">{selectedSubmission.venueAddress}</p>
                  <p className="text-zinc-400 text-sm">Departamento: {selectedSubmission.city}</p>
                </div>

                <div>
                  <p className="text-zinc-500 text-xs">Descripción</p>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{selectedSubmission.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-zinc-500 text-xs">Contacto</p>
                    <p className="text-zinc-100">{selectedSubmission.contactName}</p>
                    <p className="text-zinc-400 text-sm">{selectedSubmission.contactEmail}</p>
                  </div>
                  {selectedSubmission.ticketUrl && (
                    <div>
                      <p className="text-zinc-500 text-xs">Ticket URL</p>
                      <a
                        href={selectedSubmission.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-sm hover:underline"
                      >
                        Ver tickets
                      </a>
                    </div>
                  )}
                </div>

                {selectedSubmission.notes && (
                  <div>
                    <p className="text-zinc-500 text-xs">Notas</p>
                    <p className="text-zinc-300 text-sm">{selectedSubmission.notes}</p>
                  </div>
                )}
              </div>

              {selectedSubmission.status === "pending" && (
                <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Agregar notas..."
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 text-sm resize-none"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? "Procesando..." : "Rechazar"}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? "Procesando..." : "Aprobar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
