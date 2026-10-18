package portfolio

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strings"

	"encore.dev/storage/sqldb"
)

const maxImageBytes = 5 * 1024 * 1024

func validImageID(id string) bool {
	if len(id) != 64 {
		return false
	}
	for _, char := range id {
		if !(char >= '0' && char <= '9') && !(char >= 'a' && char <= 'f') {
			return false
		}
	}
	return true
}
func validImageURL(value string) bool {
	if strings.HasPrefix(value, "/api/images/") {
		return validImageID(strings.TrimPrefix(value, "/api/images/"))
	}
	return validURL(value)
}

// uploadImage is called only after the admin session and origin are verified.
func uploadImage(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxImageBytes))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			fail(w, 413, "Image size must not exceed 5 MB.")
		} else {
			fail(w, 400, "Unable to read the file.")
		}
		return
	}
	mimeType := http.DetectContentType(data)
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		fail(w, 415, "Choose a JPEG, PNG, or WebP image.")
		return
	}
	digest := sha256.Sum256(data)
	id := hex.EncodeToString(digest[:])
	// Identical uploads share a stable URL and do not duplicate stored data.
	_, err = db.Exec(r.Context(), "INSERT INTO project_images (id, mime_type, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", id, mimeType, data)
	if err != nil {
		fail(w, 500, "Unable to save the image. Please try again.")
		return
	}
	reply(w, 201, map[string]string{"url": "/api/images/" + id})
}

// Image serves uploaded project images from persistent database storage.
//
//encore:api public raw method=GET path=/api/images/*id
func Image(w http.ResponseWriter, r *http.Request) { imageHandler(w, r) }

func imageHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/images/")
	if !validImageID(id) {
		fail(w, 404, "Image not found.")
		return
	}
	var data []byte
	var mimeType string
	err := db.QueryRow(r.Context(), "SELECT mime_type, data FROM project_images WHERE id=$1", id).Scan(&mimeType, &data)
	if errors.Is(err, sqldb.ErrNoRows) {
		fail(w, 404, "Image not found.")
		return
	}
	if err != nil {
		fail(w, 500, "Unable to load the image.")
		return
	}
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("ETag", `"`+id+`"`)
	if r.Header.Get("If-None-Match") == `"`+id+`"` {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	_, _ = w.Write(data)
}
