package portfolio

import (
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestAdminOriginBehindProxy(t *testing.T) {
	staging, _ := url.Parse("https://staging-example.encr.app")
	for _, tt := range []struct {
		name, origin, host string
		local, want        bool
	}{
		{"public origin with internal host", "https://staging-example.encr.app", "portfolio.internal:8080", false, true},
		{"foreign origin", "https://evil.test", "portfolio.internal:8080", false, false},
		{"forged request host", "https://evil.test", "evil.test", false, false},
		{"HTTP downgrade", "http://staging-example.encr.app", "portfolio.internal:8080", false, false},
		{"domain suffix", "https://staging-example.encr.app.evil.test", "portfolio.internal:8080", false, false},
		{"missing origin", "", "portfolio.internal:8080", false, false},
		{"null origin", "null", "portfolio.internal:8080", false, false},
		{"credentials", "https://user@staging-example.encr.app", "portfolio.internal:8080", false, false},
		{"path", "https://staging-example.encr.app/path", "portfolio.internal:8080", false, false},
		{"query", "https://staging-example.encr.app?x=1", "portfolio.internal:8080", false, false},
		{"localhost", "http://localhost:4000", "localhost:4000", true, true},
		{"loopback IP", "http://127.0.0.1:4000", "127.0.0.1:4000", true, true},
		{"Vite proxy", "http://localhost:5173", "localhost:5173", true, true},
		{"IPv6 loopback", "http://[::1]:5173", "[::1]:5173", true, true},
		{"foreign local origin", "http://evil.test", "evil.test", true, false},
		{"local port mismatch", "http://localhost:5173", "localhost:4000", true, false},
		{"no localhost bypass in cloud", "http://localhost:4000", "localhost:4000", false, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "http://internal/api/admin/login", nil)
			r.Host = tt.host
			if tt.origin != "" {
				r.Header.Set("Origin", tt.origin)
			}
			r.Header.Set("X-Forwarded-Host", "evil.test")
			if got := matchesAdminOrigin(r, *staging, tt.local); got != tt.want {
				t.Fatalf("allowed=%v, want %v", got, tt.want)
			}
		})
	}
	r := httptest.NewRequest("POST", "http://internal/api/admin/login", nil)
	r.Header.Add("Origin", staging.String())
	r.Header.Add("Origin", "https://evil.test")
	if matchesAdminOrigin(r, *staging, false) {
		t.Fatal("multiple origins accepted")
	}
}
