package portfolio

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestValidation(t *testing.T) {
	c := defaultContent()
	if !validate(c) {
		t.Fatal("default content must be valid")
	}
	for _, u := range []string{"javascript:alert(1)", "data:text/html,hi", "/relative", "https://user:pass@example.com"} {
		c.Github = u
		if validate(c) {
			t.Errorf("unsafe URL accepted: %s", u)
		}
	}
	c = defaultContent()
	c.Name = " "
	if validate(c) {
		t.Fatal("blank name accepted")
	}
	c = defaultContent()
	c.Projects = []Project{{Title: "Test", URL: "javascript:alert(1)"}}
	if validate(c) {
		t.Fatal("unsafe project URL accepted")
	}
}
func TestSession(t *testing.T) {
	old := secrets.PortfolioAdminPassword
	secrets.PortfolioAdminPassword = "testpass"
	defer func() { secrets.PortfolioAdminPassword = old }()
	value := fmt.Sprintf("%d.nonce", time.Now().Add(time.Hour).Unix())
	r := httptest.NewRequest("GET", "http://localhost/api/admin/session", nil)
	r.AddCookie(sessionCookie(r, value+"."+signature(value), 3600))
	if !authenticated(r) {
		t.Fatal("valid signature rejected")
	}
	secrets.PortfolioAdminPassword = "new-pass"
	if authenticated(r) {
		t.Fatal("old password session accepted")
	}
}
func TestAdminGuards(t *testing.T) {
	for _, tt := range []struct {
		method, origin string
		status         int
	}{{"PUT", "http://evil.test", 403}, {"PUT", "http://localhost", 401}, {"GET", "", 401}} {
		r := httptest.NewRequest(tt.method, "http://localhost/api/admin/content", strings.NewReader(`{}`))
		if tt.origin != "" {
			r.Header.Set("Origin", tt.origin)
		}
		w := httptest.NewRecorder()
		adminHandler(w, r)
		if w.Code != tt.status {
			t.Errorf("got %d, want %d", w.Code, tt.status)
		}
	}
}

func TestLoginPublishAndConflict(t *testing.T) {
	old := secrets.PortfolioAdminPassword
	secrets.PortfolioAdminPassword = "integration-test-password-long"
	defer func() { secrets.PortfolioAdminPassword = old }()
	request := func(method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://localhost/api/admin/"+path, strings.NewReader(body))
		r.Header.Set("Origin", "http://localhost")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		adminHandler(w, r)
		return w
	}
	bad := request("POST", "login", `{"password":"wrong"}`, nil)
	if bad.Code != 401 {
		t.Fatalf("wrong password status: %d", bad.Code)
	}
	login := request("POST", "login", `{"password":"integration-test-password-long"}`, nil)
	if login.Code != 200 || len(login.Result().Cookies()) != 1 {
		t.Fatalf("login failed: %s", login.Body.String())
	}
	cookie := login.Result().Cookies()[0]
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode {
		t.Fatal("missing cookie protections")
	}
	c, err := load(httptest.NewRequest("GET", "http://localhost/api/portfolio", nil))
	if err != nil {
		t.Fatal(err)
	}
	c.Name = "Published test profile"
	c.Projects = []Project{{Title: "Project with image", ImageURL: "https://example.com/cover.jpg"}}
	data, _ := json.Marshal(c)
	saved := request("PUT", "content", string(data), cookie)
	if saved.Code != 200 {
		t.Fatalf("publish failed: %s", saved.Body.String())
	}
	published, err := load(httptest.NewRequest("GET", "http://localhost/api/portfolio", nil))
	if err != nil || published.Name != c.Name || published.Revision != c.Revision+1 {
		t.Fatalf("content was not persisted: %+v %v", published, err)
	}
	if len(published.Projects) != 1 || published.Projects[0].ImageURL != c.Projects[0].ImageURL {
		t.Fatal("project image was not persisted")
	}
	conflict := request("PUT", "content", string(data), cookie)
	if conflict.Code != 409 {
		t.Fatalf("stale revision accepted: %d", conflict.Code)
	}
	invalid := request("PUT", "content", `{"name":"","role":"Developer"}`, cookie)
	if invalid.Code != 400 {
		t.Fatalf("invalid content accepted: %d", invalid.Code)
	}
	logout := request("POST", "logout", `{}`, cookie)
	if logout.Code != 200 || logout.Result().Cookies()[0].MaxAge != -1 {
		t.Fatal("logout did not clear session cookie")
	}
}

func TestOptionalProjectImages(t *testing.T) {
	for _, tt := range []struct {
		url   string
		valid bool
	}{
		{"", true},
		{"https://example.com/cover.jpg", true},
		{"http://example.com/cover.png", true},
		{"javascript:alert(1)", false},
		{"data:image/png;base64,abc", false},
		{"/relative.jpg", false},
		{"https://example.com/" + strings.Repeat("a", 2048), false},
	} {
		c := defaultContent()
		c.Projects = []Project{{Title: "Project", ImageURL: tt.url}}
		if got := validate(c); got != tt.valid {
			t.Errorf("image validation got %v, want %v", got, tt.valid)
		}
	}
}

func TestOptionalAvatar(t *testing.T) {
	for _, tt := range []struct {
		url   string
		valid bool
	}{
		{"", true},
		{"https://example.com/me.jpg", true},
		{"/api/images/" + strings.Repeat("a", 64), true},
		{"javascript:alert(1)", false},
		{"/api/images/../profile", false},
		{"https://example.com/" + strings.Repeat("a", 2048), false},
	} {
		c := defaultContent()
		c.AvatarURL = tt.url
		if validate(c) != tt.valid {
			t.Errorf("avatar validation mismatch for %q", tt.url)
		}
	}
}
