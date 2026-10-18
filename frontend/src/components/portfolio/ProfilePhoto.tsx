import { useState } from "react";
import { safeImageURL } from "../../lib/portfolio";

export default function ProfilePhoto({ url, name, className }: {
  url?: string;
  name: string;
  className: string;
}) {
  const source = safeImageURL(url ?? "");
  return source ? <Photo key={source} source={source} name={name} className={className} /> : null;
}

function Photo({ source, name, className }: { source: string; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className={className}
      src={source}
      alt={`Photo of ${name}`}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
