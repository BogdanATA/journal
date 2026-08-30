import { format } from "date-fns";

function App() {
  const today = format(new Date(), "EEEE, d MMMM yyyy");

  return (
    <main className="app">
      <h1 className="day-header">{today}</h1>
    </main>
  );
}

export default App;
