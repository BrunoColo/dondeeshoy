export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 bg-zinc-800 rounded" />
        <div className="h-9 w-28 bg-zinc-800 rounded" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
            <div className="h-4 w-20 bg-zinc-800 rounded" />
            <div className="h-8 w-16 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="h-5 w-32 bg-zinc-800 rounded" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-4">
            <div className="h-4 w-4 bg-zinc-800 rounded" />
            <div className="h-4 flex-1 bg-zinc-800 rounded" />
            <div className="h-4 w-24 bg-zinc-800 rounded" />
            <div className="h-4 w-16 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
