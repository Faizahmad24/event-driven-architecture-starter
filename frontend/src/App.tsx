import { useEffect, useState } from "react";
import Dashboard from "./components/portfolio/Dashboard";
import Portfolio from "./components/portfolio/Portfolio";
import { api, type Content } from "./lib/portfolio";

// The original App is preserved as comments in UptimeTemplate.tsx.
export default function App() {
  const [admin, setAdmin] = useState(location.hash === "#admin");
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const change = () => setAdmin(location.hash === "#admin");
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);

  useEffect(() => {
    let active = true;
    api<Content>("/api/portfolio")
      .then((value) => { if (active) setContent(value); })
      .catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (content) document.title = `${content.name} — ${content.role}`;
  }, [content]);

  if (!content) {
    return (
      <main className="state">
        <span className="eyebrow">PORTFOLIO</span>
        <h1>{error || "Loading my story…"}</h1>
        {error && <button onClick={() => location.reload()}>Try again</button>}
      </main>
    );
  }

  return admin
    ? <Dashboard content={content} onPublish={setContent} />
    : <Portfolio content={content} />;
}
