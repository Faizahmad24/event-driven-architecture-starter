import { useState } from "react";
import { safeImageURL, type Project } from "../../lib/portfolio";

export default function ProjectImage({ project, index }: { project: Project; index: number }) {
  const imageURL = safeImageURL(project.image_url ?? "");
  // Remount the image when its URL changes so a failed preview can be replaced.
  return <ImagePreview key={imageURL ?? "empty"} project={project} index={index} imageURL={imageURL} />;
}

function ImagePreview({ project, index, imageURL }: {
  project: Project;
  index: number;
  imageURL?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (imageURL && !failed) {
    return (
      <img
        className="project-image"
        src={imageURL}
        alt={`Preview ${project.title || `project ${index + 1}`}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`project-art tone-${index % 3}`}>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <strong>{project.title.slice(0, 1).toUpperCase()}<span>↗</span></strong>
      <small>{project.stack}</small>
    </div>
  );
}
