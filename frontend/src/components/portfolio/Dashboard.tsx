import Toast, { type ToastNotification } from "./Toast";
import ProfilePhoto from "./ProfilePhoto";
import ProjectImage from "./ProjectImage";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { api, ApiError, uploadProjectImage, type Content } from "../../lib/portfolio";

type ProfileKey = "name" | "role" | "intro" | "about" | "location" | "email" | "github" | "linkedin";

function TextField({ label, value, onChange, required = false, type = "text", rows }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  rows?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {rows ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} required={required} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} type={type} required={required} />
      )}
    </label>
  );
}

export default function Dashboard({ content, onPublish }: {
  content: Content;
  onPublish: (content: Content) => void;
}) {
  const [auth, setAuth] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [draft, setDraft] = useState<Content>(() => structuredClone(content));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | "avatar" | null>(null);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(content);

  useEffect(() => {
    let active = true;
    api("/api/admin/session")
      .then(() => { if (active) setAuth(true); })
      .catch((err) => {
        if (!active) return;
        setAuth(false);
        if (!(err instanceof ApiError && err.status === 401)) setError(err.message);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || uploading !== null) { event.preventDefault(); event.returnValue = ""; }
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty, uploading]);

  function field<K extends keyof Content>(key: K, value: Content[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setToast(null);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/login", "POST", { password });
      setPassword("");
      setShowPassword(false);
      setAuth(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || uploading !== null) return;
    setBusy(true);
    setError("");
    setToast(null);
    try {
      const saved = await api<Content>("/api/admin/content", "PUT", {
        ...draft,
        skills: draft.skills.map((skill) => skill.trim()).filter(Boolean),
      });
      setDraft(structuredClone(saved));
      onPublish(saved);
      setToast({ type: "success", message: "Changes published successfully." });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
      if (err instanceof ApiError && err.status === 401) setAuth(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>, index: number | "avatar") {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setUploading(index);
    setError("");
    setToast(null);
    try {
      const image = await uploadProjectImage(file);
      setDraft((current) => ({
        ...current,
        ...(index === "avatar"
          ? { avatar_url: image.url }
          : { projects: current.projects.map((project, i) => i === index ? { ...project, image_url: image.url } : project) }),
      }));
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError && err.status === 401) setAuth(false);
    } finally {
      setUploading(null);
    }
  }

  async function logout() {
    if (dirty && !confirm("You have unsaved changes. Leave the dashboard?")) return;
    setBusy(true);
    try {
      await api("/api/admin/logout", "POST");
      setDraft(structuredClone(content));
      setAuth(false);
      setError("");
      setToast(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function preview(event: MouseEvent) {
    if (uploading !== null) { event.preventDefault(); return; }
    if (dirty && !confirm("Your changes have not been published. Open the portfolio anyway?")) event.preventDefault();
  }

  function profileField(label: string, key: ProfileKey, rows?: number) {
    return (
      <TextField
        label={label}
        value={draft[key]}
        onChange={(value) => field(key, value)}
        required={key === "name" || key === "role"}
        type={key === "email" ? "email" : key === "github" || key === "linkedin" ? "url" : "text"}
        rows={rows}
      />
    );
  }

  return (
    <div className="admin">
      <header className="admin-nav">
        <a href="#" onClick={preview} className="wordmark">Portfolio<span> / studio</span></a>
        <div>
          <a href="#" onClick={preview}>View portfolio ↗</a>
          {auth && <button className="secondary" disabled={busy || uploading !== null} onClick={logout}>Sign out</button>}
        </div>
      </header>
      {auth === null ? (
        <main className="state">Checking your session…</main>
      ) : !auth ? (
        <main className="login">
          <p className="eyebrow">YOUR PERSONAL STUDIO</p>
          <h1>Welcome<br /><span className="serif">back.</span></h1>
          <p>Sign in to manage your story and your work.</p>
          <form onSubmit={login}>
            <div className="field">
              <label className="password-label" htmlFor="admin-password">Admin password</label>
              <div className="password-field">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {showPassword ? (
                      <>
                        <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.3 6.3C3.3 8.3 2 12 2 12s3 7 10 7a11 11 0 0 0 5.7-1.6" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>
            {error && <p role="alert" className="error">{error}</p>}
            <button className="primary" disabled={busy || uploading !== null}>{busy ? "Signing in…" : "Sign in →"}</button>
          </form>
        </main>
      ) : (
        <main className="editor">
          <div className="editor-heading">
            <div>
              <p className="eyebrow">CONTENT MANAGEMENT</p>
              <h1>Your creative space<span className="accent">.</span></h1>
              <p>Edit your content, then publish when you are ready.</p>
            </div>
            <span className="draft-state">{dirty ? "● Unsaved changes" : "● All changes saved"}</span>
          </div>
          <form onSubmit={save} aria-busy={busy}>
            <fieldset disabled={busy || uploading !== null} className="editor-fields">
              <section className="editor-card">
                <h2>01 / Profile & identity</h2>
                <div className="profile-photo-editor">
                  <label className="field">
                    <span>Upload profile photo (optional)</span>
                    <input
                      type="file"
                      aria-label="Upload profile photo (optional)"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => handleImageUpload(event, "avatar")}
                    />
                    <small className="muted">JPEG, PNG, or WebP. Up to 5 MB. Your photo appears as a circle in the hero.</small>
                  </label>
                  {uploading === "avatar" && <p role="status" className="muted">Uploading photo…</p>}
                  <ProfilePhoto url={draft.avatar_url} name={draft.name} className="avatar-preview" />
                  {draft.avatar_url && (
                    <button type="button" className="secondary remove-image" onClick={() => field("avatar_url", "")}>
                      Remove profile photo
                    </button>
                  )}
                </div>
                <div className="form-grid">
                  {profileField("Name", "name")}
                  {profileField("Role / headline", "role")}
                  {profileField("Location", "location")}
                  {profileField("Contact email", "email")}
                </div>
                {profileField("Short introduction", "intro", 3)}
                {profileField("About me", "about", 5)}
                <label className="check">
                  <input type="checkbox" checked={draft.available} onChange={(e) => field("available", e.target.checked)} />
                  Open to collaboration
                </label>
              </section>

              <section className="editor-card">
                <h2>02 / Skills & links</h2>
                <TextField label="Skills (comma-separated)" value={draft.skills.join(",")} onChange={(value) => field("skills", value.split(","))} />
                <div className="form-grid">
                  {profileField("GitHub URL", "github")}
                  {profileField("LinkedIn URL", "linkedin")}
                </div>
              </section>

              <section className="editor-card">
                <div className="card-heading">
                  <h2>03 / Project</h2>
                  <button type="button" className="secondary" disabled={draft.projects.length >= 50} onClick={() => field("projects", [...draft.projects, { title: "", description: "", stack: "", url: "", image_url: "" }])}>+ Add project</button>
                </div>
                {draft.projects.length === 0 && <p className="muted">No projects yet. Add your first project.</p>}
                {draft.projects.map((project, i) => (
                  <div className="repeat-card" key={i}>
                    <div className="card-heading">
                      <h3>Project {i + 1}</h3>
                      <button type="button" className="danger" onClick={() => field("projects", draft.projects.filter((_, index) => i !== index))}>Remove project {i + 1}</button>
                    </div>
                    <label className="field">
                      <span>Upload image (optional)</span>
                      <input
                        type="file"
                        aria-label="Upload image (optional)"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => handleImageUpload(event, i)}
                      />
                      <small className="muted">JPEG, PNG, or WebP. Up to 5 MB.</small>
                    </label>
                    {uploading === i && <p role="status" className="muted">Uploading image…</p>}
                    {project.image_url && (
                      <button type="button" className="secondary remove-image" onClick={() => field("projects", draft.projects.map((item, index) => index === i ? { ...item, image_url: "" } : item))}>
                        Remove project image {i + 1}
                      </button>
                    )}
                    <div className="project-preview">
                      <ProjectImage project={project} index={i} />
                    </div>
                    {(["title", "description", "stack", "url"] as const).map((key) => (
                      <TextField
                        key={key}
                        label={{ title: "Project title", description: "Description", stack: "Technologies", url: "Project URL (optional)" }[key]}
                        value={project[key]}
                        onChange={(value) => field("projects", draft.projects.map((item, index) => index === i ? { ...item, [key]: value } : item))}
                        required={key === "title"}
                        type={key === "url" ? "url" : "text"}
                        rows={key === "description" ? 3 : undefined}
                      />
                    ))}
                  </div>
                ))}
              </section>

              <section className="editor-card">
                <div className="card-heading">
                  <h2>04 / Experience</h2>
                  <button type="button" className="secondary" disabled={draft.experiences.length >= 50} onClick={() => field("experiences", [...draft.experiences, { role: "", company: "", period: "", description: "" }])}>+ Add experience</button>
                </div>
                {draft.experiences.length === 0 && <p className="muted">Add work, freelance, or volunteer experience.</p>}
                {draft.experiences.map((experience, i) => (
                  <div className="repeat-card" key={i}>
                    <div className="card-heading">
                      <h3>Experience {i + 1}</h3>
                      <button type="button" className="danger" onClick={() => field("experiences", draft.experiences.filter((_, index) => i !== index))}>Remove experience {i + 1}</button>
                    </div>
                    {(["role", "company", "period", "description"] as const).map((key) => (
                      <TextField
                        key={key}
                        label={{ role: "Position", company: "Company / organization", period: "Period", description: "Description" }[key]}
                        value={experience[key]}
                        onChange={(value) => field("experiences", draft.experiences.map((item, index) => index === i ? { ...item, [key]: value } : item))}
                        required={key === "role"}
                        rows={key === "description" ? 3 : undefined}
                      />
                    ))}
                  </div>
                ))}
              </section>
            </fieldset>
            <div className="publish-bar">
              <div>
                {error && <p role="alert" className="error">{error}</p>}

                <span className="muted">Changes become public after you publish them.</span>
              </div>
              <button className="primary" disabled={busy || uploading !== null || !dirty} aria-busy={busy}>
                {busy ? <><span className="spinner" aria-hidden="true" />Publishing…</> : "Publish changes ↗"}
              </button>
            </div>
          </form>
        </main>
      )}
      {toast && <Toast notification={toast} onClose={dismissToast} />}
    </div>
  );
}
