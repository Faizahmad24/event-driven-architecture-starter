package portfolio

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"encore.dev/storage/sqldb"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

var db = sqldb.NewDatabase("portfolio", sqldb.DatabaseConfig{Migrations: "./migrations"})
var secrets struct{ PortfolioAdminPassword string }

type Project struct {
	ImageURL    string `json:"image_url,omitempty"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Stack       string `json:"stack"`
	URL         string `json:"url"`
}
type Experience struct {
	Role        string `json:"role"`
	Company     string `json:"company"`
	Period      string `json:"period"`
	Description string `json:"description"`
}
type Content struct {
	AvatarURL   string       `json:"avatar_url,omitempty"`
	Name        string       `json:"name"`
	Role        string       `json:"role"`
	Intro       string       `json:"intro"`
	About       string       `json:"about"`
	Location    string       `json:"location"`
	Email       string       `json:"email"`
	Github      string       `json:"github"`
	Linkedin    string       `json:"linkedin"`
	Available   bool         `json:"available"`
	Skills      []string     `json:"skills"`
	Projects    []Project    `json:"projects"`
	Experiences []Experience `json:"experiences"`
	Revision    int64        `json:"revision"`
}

func defaultContent() Content {
	return Content{Name: "Ahmad Faiz", Role: "Full Stack Developer", Intro: "Turning ideas into meaningful digital experiences.", About: "Welcome to my portfolio. I enjoy building simple, fast, and intuitive web applications. Explore my work and my journey here.", Location: "Indonesia", Available: true, Skills: []string{"React", "TypeScript", "Go", "PostgreSQL"}, Projects: []Project{}, Experiences: []Experience{}}
}
func load(r *http.Request) (Content, error) {
	var raw []byte
	var revision int64
	err := db.QueryRow(r.Context(), "SELECT document, revision FROM content WHERE id = 1").Scan(&raw, &revision)
	if errors.Is(err, sqldb.ErrNoRows) {
		return defaultContent(), nil
	}
	if err != nil {
		return Content{}, err
	}
	var c Content
	err = json.Unmarshal(raw, &c)
	c.Revision = revision
	return c, err
}
func reply(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, message string) {
	reply(w, status, map[string]string{"message": message})
}

// Public returns the published portfolio.
//
//encore:api public raw method=GET path=/api/portfolio
func Public(w http.ResponseWriter, r *http.Request) {
	c, err := load(r)
	if err != nil {
		fail(w, 500, "Unable to load content.")
		return
	}
	reply(w, 200, c)
}
func signature(value string) string {
	h := hmac.New(sha256.New, []byte(secrets.PortfolioAdminPassword))
	_, _ = h.Write([]byte("portfolio-session:" + value))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
func authenticated(r *http.Request) bool {
	if len(secrets.PortfolioAdminPassword) < 8 {
		return false
	}
	cookie, err := r.Cookie("portfolio_session")
	if err != nil {
		return false
	}
	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 3 {
		return false
	}
	expiry, err := strconv.ParseInt(parts[0], 10, 64)
	return err == nil && expiry > time.Now().Unix() && hmac.Equal([]byte(signature(parts[0]+"."+parts[1])), []byte(parts[2]))
}
func sessionCookie(r *http.Request, value string, maxAge int) *http.Cookie {
	host := strings.Split(r.Host, ":")[0]
	return &http.Cookie{Name: "portfolio_session", Value: value, Path: "/api/admin", HttpOnly: true, Secure: host != "localhost" && host != "127.0.0.1", SameSite: http.SameSiteStrictMode, MaxAge: maxAge}
}

// Limit attempts without trusting forwarded client IPs.
var attempts struct {
	sync.Mutex
	start time.Time
	count int
}

func allowLogin() bool {
	attempts.Lock()
	defer attempts.Unlock()
	if time.Since(attempts.start) > time.Minute {
		attempts.start = time.Now()
		attempts.count = 0
	}
	attempts.count++
	return attempts.count <= 10
}
func validURL(value string) bool {
	if value == "" {
		return true
	}
	u, err := url.Parse(value)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Hostname() != "" && u.User == nil
}
func validate(c Content) bool {
	if !validImageURL(c.AvatarURL) || len(c.AvatarURL) > 2048 {
		return false
	}
	if strings.TrimSpace(c.Name) == "" || strings.TrimSpace(c.Role) == "" || len(c.Name) > 120 || len(c.Role) > 160 || len(c.Intro) > 1000 || len(c.About) > 10000 || len(c.Location) > 200 || len(c.Email) > 254 || strings.ContainsAny(c.Email, "\r\n ?#") || !validURL(c.Github) || !validURL(c.Linkedin) {
		return false
	}
	if c.Email != "" && !strings.Contains(c.Email, "@") {
		return false
	}
	if len(c.Projects) > 50 || len(c.Experiences) > 50 || len(c.Skills) > 100 {
		return false
	}
	for _, p := range c.Projects {
		if !validImageURL(p.ImageURL) || len(p.ImageURL) > 2048 || strings.TrimSpace(p.Title) == "" || !validURL(p.URL) || len(p.Title) > 200 || len(p.Description) > 5000 || len(p.Stack) > 500 {
			return false
		}
	}
	for _, e := range c.Experiences {
		if strings.TrimSpace(e.Role) == "" || len(e.Role) > 200 || len(e.Company) > 200 || len(e.Period) > 100 || len(e.Description) > 5000 {
			return false
		}
	}
	for _, s := range c.Skills {
		if strings.TrimSpace(s) == "" || len(s) > 100 {
			return false
		}
	}
	return true
}

// Admin handles login, logout, session verification and publishing.
//
//encore:api public raw path=/api/admin/*path
func Admin(w http.ResponseWriter, r *http.Request) { adminHandler(w, r) }

func adminHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodGet {
		origin, err := url.Parse(r.Header.Get("Origin"))
		if err != nil || origin.Host != r.Host || (origin.Scheme != "http" && origin.Scheme != "https") {
			fail(w, 403, "Origin is not allowed.")
			return
		}
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/admin/")
	if path == "login" && r.Method == http.MethodPost {
		if !allowLogin() {
			fail(w, 429, "Too many attempts. Try again in one minute.")
			return
		}
		if len(secrets.PortfolioAdminPassword) < 8 {
			fail(w, 503, "Set the PortfolioAdminPassword secret to at least 8 characters first.")
			return
		}
		var input struct {
			Password string `json:"password"`
		}
		if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input) != nil {
			fail(w, 400, "Invalid sign-in data.")
			return
		}
		expected, actual := sha256.Sum256([]byte(secrets.PortfolioAdminPassword)), sha256.Sum256([]byte(input.Password))
		if subtle.ConstantTimeCompare(expected[:], actual[:]) != 1 {
			fail(w, 401, "Incorrect password.")
			return
		}
		nonce := make([]byte, 32)
		if _, err := rand.Read(nonce); err != nil {
			fail(w, 500, "Sign-in failed.")
			return
		}
		value := fmt.Sprintf("%d.%s", time.Now().Add(8*time.Hour).Unix(), base64.RawURLEncoding.EncodeToString(nonce))
		http.SetCookie(w, sessionCookie(r, value+"."+signature(value), 8*3600))
		reply(w, 200, map[string]bool{"authenticated": true})
		return
	}
	if !authenticated(r) {
		fail(w, 401, "Please sign in again.")
		return
	}
	switch {
	case path == "images" && r.Method == http.MethodPost:
		uploadImage(w, r)
	case path == "session" && r.Method == http.MethodGet:
		reply(w, 200, map[string]bool{"authenticated": true})
	case path == "logout" && r.Method == http.MethodPost:
		http.SetCookie(w, sessionCookie(r, "", -1))
		reply(w, 200, map[string]bool{"authenticated": false})
	case path == "content" && r.Method == http.MethodPut:
		var c Content
		if json.NewDecoder(http.MaxBytesReader(w, r.Body, 256*1024)).Decode(&c) != nil || !validate(c) {
			fail(w, 400, "Invalid content. Check required fields and HTTP/HTTPS URLs.")
			return
		}
		if c.Skills == nil {
			c.Skills = []string{}
		}
		if c.Projects == nil {
			c.Projects = []Project{}
		}
		if c.Experiences == nil {
			c.Experiences = []Experience{}
		}
		raw, err := json.Marshal(c)
		if err != nil {
			fail(w, 400, "Invalid content.")
			return
		}
		var revision int64
		if c.Revision == 0 {
			err = db.QueryRow(r.Context(), "INSERT INTO content (id,document) VALUES (1,$1) ON CONFLICT DO NOTHING RETURNING revision", raw).Scan(&revision)
		} else {
			err = db.QueryRow(r.Context(), "UPDATE content SET document=$1, revision=revision+1 WHERE id=1 AND revision=$2 RETURNING revision", raw, c.Revision).Scan(&revision)
		}
		if errors.Is(err, sqldb.ErrNoRows) {
			fail(w, 409, "Content was changed in another tab. Reload before editing again.")
			return
		}
		if err != nil {
			fail(w, 500, "Unable to save content.")
			return
		}
		c.Revision = revision
		reply(w, 200, c)
	default:
		fail(w, 404, "Endpoint not found.")
	}
}
