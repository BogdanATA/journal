import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EditorCanvas } from "../editor/EditorCanvas";
import { loadDay, saveDay } from "../storage/dayFile";
import { useDebouncedFlush } from "../hooks/useDebouncedFlush";

function App() {
  const [currentDate] = useState(() => new Date());
  const [initialText, setInitialText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { schedule, flush } = useDebouncedFlush((text) => saveDay(currentDate, text));

  useEffect(() => {
    let cancelled = false;
    loadDay(currentDate)
      .then((text) => {
        if (!cancelled) setInitialText(text);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setInitialText("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentDate]);

  const today = format(currentDate, "EEEE, d MMMM yyyy");

  return (
    <main className="app">
      <h1 className="day-header">{today}</h1>
      {error !== null && <p className="error">{error}</p>}
      {initialText !== null && (
        <EditorCanvas
          date={currentDate}
          initialText={initialText}
          onScheduleSave={(text) => {
            schedule(text);
            setError(null);
          }}
          onFlush={() => {
            void flush().catch((err: unknown) => {
              setError(err instanceof Error ? err.message : String(err));
            });
          }}
        />
      )}
    </main>
  );
}

export default App;
