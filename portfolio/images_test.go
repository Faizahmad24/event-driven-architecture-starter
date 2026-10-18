package portfolio

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLocalImageUpload(t *testing.T) {
	old := secrets.PortfolioAdminPassword
	secrets.PortfolioAdminPassword = "image-test-password"
	defer func() { secrets.PortfolioAdminPassword = old }()
	value := fmt.Sprintf("%d.nonce", time.Now().Add(time.Hour).Unix())
	cookie := sessionCookie(httptest.NewRequest("GET", "http://localhost", nil), value+"."+signature(value), 3600)
	upload := func(data []byte, authenticated bool, origin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "http://localhost/api/admin/images", bytes.NewReader(data))
		r.Header.Set("Origin", origin)
		// A fake browser Content-Type must not bypass file signature validation.
		r.Header.Set("Content-Type", "image/png")
		if authenticated {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		adminHandler(w, r)
		return w
	}
	png, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=")
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		data   []byte
		auth   bool
		origin string
		status int
	}{
		{png, false, "http://localhost", 401},
		{png, true, "http://evil.test", 403},
		{nil, true, "http://localhost", 415},
		{[]byte("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), true, "http://localhost", 415},
		{bytes.Repeat([]byte{0}, maxImageBytes+1), true, "http://localhost", 413},
	} {
		if w := upload(tt.data, tt.auth, tt.origin); w.Code != tt.status {
			t.Fatalf("got %d, want %d: %s", w.Code, tt.status, w.Body.String())
		}
	}
	w := upload(png, true, "http://localhost")
	if w.Code != 201 {
		t.Fatalf("upload failed: %d %s", w.Code, w.Body.String())
	}
	var response struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !validImageURL(response.URL) || !strings.HasPrefix(response.URL, "/api/images/") {
		t.Fatal("invalid image URL")
	}
	duplicate := upload(png, true, "http://localhost")
	if duplicate.Code != 201 || duplicate.Body.String() != w.Body.String() {
		t.Fatal("identical upload should reuse URL")
	}
	r := httptest.NewRequest("GET", "http://localhost"+response.URL, nil)
	image := httptest.NewRecorder()
	imageHandler(image, r)
	if image.Code != 200 || !bytes.Equal(image.Body.Bytes(), png) || image.Header().Get("Content-Type") != "image/png" || image.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("stored image not served correctly")
	}
	r.Header.Set("If-None-Match", image.Header().Get("ETag"))
	cached := httptest.NewRecorder()
	imageHandler(cached, r)
	if cached.Code != 304 {
		t.Fatal("cache validation failed")
	}
	c, err := load(r)
	if err != nil {
		t.Fatal(err)
	}
	c.Projects = []Project{{Title: "Local upload", ImageURL: response.URL}}
	c.AvatarURL = response.URL
	body, _ := json.Marshal(c)
	saveReq := httptest.NewRequest("PUT", "http://localhost/api/admin/content", bytes.NewReader(body))
	saveReq.Header.Set("Origin", "http://localhost")
	saveReq.AddCookie(cookie)
	saved := httptest.NewRecorder()
	adminHandler(saved, saveReq)
	if saved.Code != 200 {
		t.Fatalf("uploaded URL publish failed: %s", saved.Body.String())
	}
	persisted, err := load(r)
	if err != nil || len(persisted.Projects) != 1 || persisted.Projects[0].ImageURL != response.URL || persisted.AvatarURL != response.URL {
		t.Fatal("uploaded image reference not persisted")
	}
	for _, path := range []string{"/api/images/../../x", "/api/images/" + strings.Repeat("0", 64)} {
		missing := httptest.NewRecorder()
		imageHandler(missing, httptest.NewRequest(http.MethodGet, "http://localhost"+path, nil))
		if missing.Code != 404 {
			t.Fatalf("missing image status: %d", missing.Code)
		}
	}
}

func TestImagePathValidation(t *testing.T) {
	for _, path := range []string{"/api/images/", "/api/images/../../x", "//evil.test/image.png", "/api/images/" + strings.Repeat("a", 64) + "?x=1"} {
		if validImageURL(path) {
			t.Errorf("invalid path accepted: %s", path)
		}
	}
}
