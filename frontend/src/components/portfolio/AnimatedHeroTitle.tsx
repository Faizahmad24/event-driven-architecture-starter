import { useEffect, useState } from "react";

export default function AnimatedHeroTitle({ role, tagline, startDelay = 1100 }: {
  role: string;
  tagline: string;
  startDelay?: number;
}) {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const roleChars = Array.from(role);
  const taglineChars = Array.from(tagline);
  const total = roleChars.length + taglineChars.length;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setCount(0);
    setStarted(false);
    if (reducedMotion || total === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    let position = 0;
    let deleting = false;
    function tick() {
      setStarted(true);
      position += deleting ? -1 : 1;
      setCount(position);
      if (position === total) {
        deleting = true;
        timer = setTimeout(tick, 3000);
      } else if (position === 0) {
        deleting = false;
        timer = setTimeout(tick, 120);
      } else {
        timer = setTimeout(tick, deleting ? 35 : 120);
      }
    }
    timer = setTimeout(tick, startDelay);
    return () => clearTimeout(timer);
  }, [role, tagline, total, startDelay, reducedMotion]);

  const visible = reducedMotion ? total : count;
  const roleActive = !reducedMotion && started && count < roleChars.length;
  const taglineActive = !reducedMotion && started && count >= roleChars.length;
  return (
    <h1 className="hero-title" aria-label={`${role} ${tagline}`}>
      <span className="hero-role typing-line" aria-hidden="true">
        <span className="typing-space">{role}</span>
        <span className={`typing-text${roleActive ? " typing-cursor" : ""}`}>{roleChars.slice(0, visible).join("")}</span>
      </span>
      <span className="accent hero-tagline typing-line" aria-hidden="true">
        <span className="typing-space">{tagline}</span>
        <span className={`typing-text${taglineActive ? " typing-cursor" : ""}`}>{taglineChars.slice(0, Math.max(0, visible - roleChars.length)).join("")}</span>
      </span>
    </h1>
  );
}
