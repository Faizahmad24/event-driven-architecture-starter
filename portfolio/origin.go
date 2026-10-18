package portfolio

import (
	"net"
	"net/http"
	"net/url"
	"strings"

	"encore.dev"
)

func allowedAdminOrigin(r *http.Request) bool {
	meta := encore.Meta()
	return matchesAdminOrigin(r, meta.APIBaseURL, meta.Environment.Cloud == encore.CloudLocal)
}

// Compare with deployment metadata: a cloud proxy may replace the request Host.
// Forwarded headers are deliberately not used as an origin allowlist.
func matchesAdminOrigin(r *http.Request, expected url.URL, local bool) bool {
	values := r.Header.Values("Origin")
	if len(values) != 1 {
		return false
	}
	origin, err := url.Parse(values[0])
	if err != nil || origin.Host == "" || origin.User != nil || origin.Opaque != "" || origin.Path != "" || origin.RawQuery != "" || origin.ForceQuery || origin.Fragment != "" {
		return false
	}
	if origin.Scheme != "http" && origin.Scheme != "https" {
		return false
	}
	if origin.Scheme == expected.Scheme && strings.EqualFold(origin.Host, expected.Host) {
		return true
	}
	if !local {
		return false
	}
	// Keep localhost/127.0.0.1 and Vite's same-origin development proxy working.
	requestURL := url.URL{Host: r.Host}
	return loopbackHost(origin.Hostname()) && loopbackHost(requestURL.Hostname()) && strings.EqualFold(origin.Host, r.Host)
}

func loopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
