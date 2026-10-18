import AnimatedHeroTitle from "./AnimatedHeroTitle";
import ProfilePhoto from "./ProfilePhoto";
import ProjectImage from "./ProjectImage";
import { safeURL, type Content } from "../../lib/portfolio";

export default function Portfolio({ content: c }: { content: Content }) {
  return (
    <div className="portfolio">
      <header className="nav wrap">
        <a className="wordmark" href="#">{c.name}<span>.</span></a>
        <nav aria-label="Main navigation">
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#contact">Contact ↗</a>
        </nav>
      </header>
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" />
              {c.available ? "OPEN TO COLLABORATION" : c.location}
            </p>
            <p className="hello">Hi, I am {c.name}.</p>
            <AnimatedHeroTitle role={c.role} tagline="& creative thinker." startDelay={1100} />
            <p className="intro">{c.intro}</p>
            <div className="actions">
              <a className="primary" href="#projects">Explore my work <span>↗</span></a>
              <a className="text-link" href="#contact">Get in touch →</a>
            </div>
            <p className="location">◎ Based in {c.location}</p>
          </div>
          <div className={`hero-art${c.avatar_url ? " hero-art--portrait" : ""}`}>
            <div className="art-grid" aria-hidden="true" />
            <div className="orb" aria-hidden="true" />
            <ProfilePhoto url={c.avatar_url} name={c.name} className="hero-avatar" />
            <div className="art-caption" aria-hidden="true">
              <span>IDEAS → CODE → IMPACT</span>
              <strong>Built with<br />curiosity.</strong>
            </div>
            <span className="art-index" aria-hidden="true">01 / ALWAYS LEARNING</span>
          </div>
        </section>

        <section id="about" className="section wrap about">
          <div>
            <p className="eyebrow">01 — ABOUT ME</p>
            <h2>Behind<br /><span className="serif">every creation.</span></h2>
          </div>
          <div>
            <div className="about-copy">
              {c.about.trim().split(/\n\s*\n/).map((paragraph, i) => (
                <p key={i}>{paragraph.replace(/\s*\n\s*/g, " ")}</p>
              ))}
            </div>
            <div className="skills">
              {c.skills.map((skill, i) => <span key={i}>{skill}</span>)}
            </div>
          </div>
        </section>

        <section id="projects" className="section wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 — SELECTED WORK</p>
              <h2>Ideas brought to <span className="serif">life.</span></h2>
            </div>
            <span className="muted">{String(c.projects.length).padStart(2, "0")} PROJECTS</span>
          </div>
          <div className="project-grid">
            {c.projects.map((project, i) => (
              <article className="project" key={i}>
                <ProjectImage project={project} index={i} />
                <div className="project-title">
                  <h3>{project.title}</h3>
                  {safeURL(project.url) && (
                    <a href={safeURL(project.url)} target="_blank" rel="noreferrer" aria-label={`View ${project.title}`}>↗</a>
                  )}
                </div>
                <p>{project.description}</p>
                <p className="project-stack">{project.stack}</p>
              </article>
            ))}
          </div>
          {c.projects.length === 0 && <p className="empty">New projects are on the way. Check back soon.</p>}
        </section>

        {c.experiences.length > 0 && (
          <section className="section wrap experience">
            <div>
              <p className="eyebrow">03 — EXPERIENCE</p>
              <h2>Always <span className="serif">growing.</span></h2>
            </div>
            <div>
              {c.experiences.map((experience, i) => (
                <article key={i}>
                  <span className="eyebrow">{experience.period}</span>
                  <h3>{experience.role}</h3>
                  <p className="company">{experience.company}</p>
                  <p>{experience.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section id="contact" className="contact">
          <div className="wrap">
            <p className="eyebrow">HAVE AN IDEA IN MIND?</p>
            <h2>Create something<br />truly <span className="serif">meaningful.</span></h2>
            {c.email && (
              <a className="contact-email" href={`mailto:${encodeURIComponent(c.email).replace(/%40/g, "@")}`}>{c.email} ↗</a>
            )}
            <div className="socials">
              {safeURL(c.github) && <a href={safeURL(c.github)} target="_blank" rel="noreferrer">GitHub ↗</a>}
              {safeURL(c.linkedin) && <a href={safeURL(c.linkedin)} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
            </div>
          </div>
        </section>
      </main>
      <footer className="wrap">
        <span>© {new Date().getFullYear()} {c.name}</span>
        <span>Crafted with care.</span>
        {/* Admin dashboard is accessed directly through /#admin. */}
      </footer>
    </div>
  );
}
