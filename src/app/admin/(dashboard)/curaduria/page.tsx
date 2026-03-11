import { getWeekendDatesUY } from "@/lib/format";
import { getWeekendHighlightEditorState } from "@/lib/weekend-highlights-store";

import { WeekendHighlightsClient } from "./weekend-highlights-client";

export const dynamic = "force-dynamic";

export default async function CuraduriaPage() {
  const weekend = getWeekendDatesUY();
  const initialState = await getWeekendHighlightEditorState();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Curaduría</h1>
        <p className="text-zinc-500 text-sm">Elegí picks manuales para “Lo mejor del finde” y dejá que el ranking complete el resto.</p>
      </div>

      <WeekendHighlightsClient
        initialState={initialState}
        weekendStart={weekend.start}
        weekendEnd={weekend.end}
      />
    </div>
  );
}