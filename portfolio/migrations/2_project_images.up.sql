CREATE TABLE project_images (
    id TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{64}$'),
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 5242880),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
