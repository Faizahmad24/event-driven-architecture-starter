import ProjectImage from "./components/portfolio/ProjectImage";
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Content } from './lib/portfolio';

const content: Content = { name: 'Faiz', role: 'Developer', intro: 'Hello world', about: 'About me', location: 'Indonesia', email: 'me@example.com', github: '', linkedin: '', available: true, skills: ['React'], projects: [], experiences: [], revision: 1 };
const uploadedURL = "/api/images/" + "a".repeat(64);
let uploadStatus = 201;
let authorized = false;
let failSave = false;
let published: Content;
const fetchMock = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
  let data: unknown = published;
  let status = 200;
  if (path === "/api/admin/images") { status = uploadStatus; data = status === 201 ? { url: uploadedURL } : { message: "Upload failed" }; }
  if (path === '/api/admin/session' && !authorized) { status = 401; data = { message: 'Please sign in again.' }; }
  if (path === '/api/admin/login') { authorized = true; data = { authenticated: true }; }
  if (path === '/api/admin/content') {
    if (failSave) { status = 409; data = { message: 'Content was changed in another tab.' }; }
    else { published = { ...JSON.parse(init!.body as string), revision: 2 }; data = published; }
  }
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
});
beforeEach(() => { location.hash = ''; uploadStatus = 201; published = structuredClone(content); authorized = false; failSave = false; vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockClear(); });

describe('Portfolio and editor', () => {
  it('renders published content without invented projects', async () => {
    render(<App />);
    expect(await screen.findByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText(/New projects are on the way/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /me@example.com/ })).toHaveAttribute('href', 'mailto:me@example.com');
  });
  it('shows API failures instead of a fake portfolio', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ message: 'Database unavailable' }), { status: 500 }));
    render(<App />);
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
  });
  it('requires login, publishes edits and keeps them on the public view', async () => {
    location.hash = '#admin';
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Admin password'), 'a long admin password');
    await user.click(screen.getByRole('button', { name: /Sign in/ }));
    const name = await screen.findByLabelText('Name');
    await user.clear(name); await user.type(name, 'Faiz Updated');
    await user.click(screen.getByRole('button', { name: /Publish changes/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Changes published successfully.');
    expect(published.name).toBe('Faiz Updated');
    expect(fetchMock.mock.calls.find(([p]) => p === '/api/admin/content')?.[1]?.method).toBe('PUT');
    await user.click(screen.getByRole('link', { name: /View portfolio/ }));
    await waitFor(() => expect(screen.getByText('Hi, I am Faiz Updated.')).toBeInTheDocument());
  });
  it('keeps edits when a concurrent publication is rejected', async () => {
    authorized = true; failSave = true; location.hash = '#admin';
    const user = userEvent.setup(); render(<App />);
    const name = await screen.findByLabelText('Name');
    await user.clear(name); await user.type(name, 'Unsaved name');
    await user.click(screen.getByRole('button', { name: /Publish changes/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Content was changed');
    expect(name).toHaveValue('Unsaved name'); expect(published.name).toBe('Faiz');
  });
  it('adds and removes project and experience entries', async () => {
    authorized = true; location.hash = '#admin'; const user = userEvent.setup(); render(<App />);
    await user.click(await screen.findByRole('button', { name: '+ Add project' }));
    expect(screen.getByLabelText('Project title')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove project 1' }));
    expect(screen.queryByLabelText('Project title')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add experience' }));
    expect(screen.getByLabelText('Position')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove experience 1' }));
    expect(screen.queryByLabelText('Position')).not.toBeInTheDocument();
  });
});

describe('Optional project images', () => {
  const project = { title: 'My project', description: 'A project', stack: 'React', url: '' };

  it('keeps old projects without an image usable', async () => {
    published.projects = [project];
    render(<App />);
    expect(await screen.findByText('My project')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('shows a landing image and falls back on load failure', async () => {
    published.projects = [{ ...project, image_url: 'https://images.example.com/project.jpg' }];
    render(<App />);
    const image = await screen.findByRole('img', { name: 'Preview My project' });
    expect(image).toHaveAttribute('src', 'https://images.example.com/project.jpg');
    fireEvent.error(image);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('uploads a local image, publishes it and removes it from the project', async () => {
    authorized = true; location.hash = '#admin'; published.projects = [project];
    const user = userEvent.setup(); render(<App />);
    const input = await screen.findByLabelText('Upload image (optional)');
    expect(input).not.toBeRequired();
    const file = new File(['test image bytes'], 'cover.png', { type: 'image/png' });
    await user.upload(input, file);
    expect(await screen.findByRole('img', { name: 'Preview My project' })).toHaveAttribute('src', uploadedURL);
    const upload = fetchMock.mock.calls.find(([path]) => path === '/api/admin/images');
    expect(upload?.[1]?.body).toBe(file);
    expect(upload?.[1]?.method).toBe('POST');
    await user.click(screen.getByRole('button', { name: /Publish changes/ }));
    await screen.findByRole('status');
    expect(published.projects[0].image_url).toBe(uploadedURL);
    await user.click(screen.getByRole('link', { name: /View portfolio/ }));
    expect(await screen.findByRole('img', { name: 'Preview My project' })).toHaveAttribute('src', uploadedURL);
    act(() => { location.hash = '#admin'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await screen.findByLabelText('Upload image (optional)');
    await user.click(screen.getByRole('button', { name: 'Remove project image 1' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Publish changes/ }));
    await waitFor(() => expect(published.projects[0].image_url).toBe(''));
    await user.click(screen.getByRole('link', { name: /View portfolio/ }));
    await waitFor(() => expect(screen.getByText('My project')).toBeInTheDocument());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps the previous image when an upload fails', async () => {
    authorized = true; location.hash = '#admin'; uploadStatus = 500;
    published.projects = [{ ...project, image_url: 'https://example.com/old.jpg' }];
    const user = userEvent.setup(); render(<App />);
    await user.upload(await screen.findByLabelText('Upload image (optional)'), new File(['png'], 'new.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/old.jpg');
  });

  it('rejects files exceeding 5 MB before uploading', async () => {
    authorized = true; location.hash = '#admin'; published.projects = [project];
    const user = userEvent.setup(); render(<App />);
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Upload image (optional)'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('must not exceed 5 MB');
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/images')).toBe(false);
  });

  it('retries after replacing a broken URL and ignores unsafe URLs', () => {
    const { rerender } = render(<ProjectImage project={{ ...project, image_url: 'https://example.com/broken.jpg' }} index={0} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<ProjectImage project={{ ...project, image_url: 'https://example.com/new.jpg' }} index={0} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/new.jpg');
    rerender(<ProjectImage project={{ ...project, image_url: 'javascript:alert(1)' }} index={0} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('Optional hero photo', () => {
  it('uploads a profile photo, publishes it in the hero and removes it', async () => {
    authorized = true; location.hash = '#admin';
    const user = userEvent.setup(); render(<App />);
    const input = await screen.findByLabelText('Upload profile photo (optional)');
    expect(input).not.toBeRequired();
    await user.upload(input, new File(['photo'], 'me.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('img', { name: 'Photo of Faiz' })).toHaveAttribute('src', uploadedURL);
    await user.click(screen.getByRole('button', { name: /Publish changes/ }));
    await screen.findByRole('status');
    expect(published.avatar_url).toBe(uploadedURL);
    await user.click(screen.getByRole('link', { name: /View portfolio/ }));
    const photo = await screen.findByRole('img', { name: 'Photo of Faiz' });
    expect(photo).toHaveClass('hero-avatar');
    expect(document.querySelector('.orb')).toBeInTheDocument();
    act(() => { location.hash = '#admin'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await user.click(await screen.findByRole('button', { name: 'Remove profile photo' }));
    await user.click(screen.getByRole('button', { name: /Publish changes/ }));
    await waitFor(() => expect(published.avatar_url).toBe(''));
    await user.click(screen.getByRole('link', { name: /View portfolio/ }));
    await screen.findByText('Hello world');
    expect(screen.queryByRole('img', { name: 'Photo of Faiz' })).not.toBeInTheDocument();
    expect(document.querySelector('.orb')).toBeInTheDocument();
  });

  it('keeps the hero design when the profile photo fails to load', async () => {
    published.avatar_url = uploadedURL;
    render(<App />);
    fireEvent.error(await screen.findByRole('img', { name: 'Photo of Faiz' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('.orb')).toBeInTheDocument();
  });

  it('preserves the old photo after a failed replacement', async () => {
    authorized = true; location.hash = '#admin'; uploadStatus = 500;
    published.avatar_url = 'https://example.com/me.jpg';
    const user = userEvent.setup(); render(<App />);
    await user.upload(await screen.findByLabelText('Upload profile photo (optional)'), new File(['photo'], 'new.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
    expect(screen.getByRole('img', { name: 'Photo of Faiz' })).toHaveAttribute('src', 'https://example.com/me.jpg');
  });
});

it('shows a publishing spinner and locks editing until the save completes', async () => {
  authorized = true; location.hash = '#admin';
  let complete!: (response: Response) => void;
  const original = fetchMock.getMockImplementation()!;
  vi.stubGlobal('fetch', (path: RequestInfo | URL, init?: RequestInit) => {
    if (path === '/api/admin/content') return new Promise<Response>((resolve) => { complete = resolve; });
    return original(path, init);
  });
  const user = userEvent.setup(); render(<App />);
  const name = await screen.findByLabelText('Name');
  await user.clear(name); await user.type(name, 'Updated name');
  await user.click(screen.getByRole('button', { name: /Publish changes/ }));
  const saving = screen.getByRole('button', { name: 'Publishing…' });
  expect(saving).toBeDisabled();
  expect(saving).toHaveAttribute('aria-busy', 'true');
  expect(saving.querySelector('.spinner')).toBeInTheDocument();
  expect(name).toBeDisabled();
  complete(new Response(JSON.stringify({ ...content, name: 'Updated name', revision: 2 }), { status: 200 }));
  expect(await screen.findByRole('status')).toHaveTextContent('Changes published successfully.');
  expect(screen.queryByRole('button', { name: 'Publishing…' })).not.toBeInTheDocument();
  expect(name).toBeEnabled();
});

it('toggles password visibility without submitting or changing the password', async () => {
  location.hash = '#admin';
  const user = userEvent.setup(); render(<App />);
  const input = await screen.findByLabelText('Admin password');
  expect(input).toHaveAttribute('type', 'password');
  await user.type(input, 'example-password');
  const show = screen.getByRole('button', { name: 'Show password' });
  expect(show).toHaveAttribute('aria-pressed', 'false');
  await user.click(show);
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('example-password');
  const hide = screen.getByRole('button', { name: 'Hide password' });
  expect(hide).toHaveAttribute('aria-pressed', 'true');
  await user.click(hide);
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveValue('example-password');
  expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/login')).toBe(false);
});
