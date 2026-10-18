export interface Project {
  title: string;
  description: string;
  stack: string;
  url: string;
  image_url?: string;
}
export interface Experience {
  role: string;
  company: string;
  period: string;
  description: string;
}
export interface Content {
  avatar_url?: string;
  name: string;
  role: string;
  intro: string;
  about: string;
  location: string;
  email: string;
  github: string;
  linkedin: string;
  available: boolean;
  skills: string[];
  projects: Project[];
  experiences: Experience[];
  revision: number;
}
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || "Unable to reach the server.", response.status);
  return data as T;
}
export function safeURL(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function safeImageURL(value: string) {
  return /^\/api\/images\/[0-9a-f]{64}$/.test(value) ? value : safeURL(value);
}

export async function uploadProjectImage(file: File): Promise<{ url: string }> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Image size must not exceed 5 MB.");
  if (file.size === 0) throw new Error("The image file is empty.");
  if (file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  const response = await fetch("/api/admin/images", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || "Image upload failed. Please try again.", response.status);
  return data as { url: string };
}
