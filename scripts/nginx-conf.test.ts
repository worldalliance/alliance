import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const conf = readFileSync(
  join(import.meta.dir, "../deploy/nginx/alliance.conf"),
  "utf8",
);

it("moves every page-serving location off the legacy domain", () => {
  const pages = ["/", "/docs/"];
  const notPages = [
    "^~ /assets/",
    "/api/",
    "~* ^/api/health/",
    "~ ^/api/videos/\\d+/[^/]+\\.(m3u8|ts|vtt)$",
    "^~ /.well-known/",
    "/socket.io/",
    "/events/",
  ];
  const https = conf.slice(0, conf.indexOf("listen 80 default_server"));
  const locations = [...https.matchAll(/^ {4}location (.+) \{$/gm)].map(
    (m) => m[1],
  );
  expect(locations.sort()).toEqual([...pages, ...notPages].sort());
  for (const location of pages) {
    expect(conf).toContain(
      `location ${location} {\n        if ($moved_host) {\n            return 302 https://$moved_host$request_uri;`,
    );
  }
});

it("moves only navigations off the legacy domain", () => {
  expect(conf).toContain(
    `map "$http_sec_fetch_mode:$http_accept" $moved_host {\n    default            "";\n    "~^navigate:"      $new_host;\n    "~^:.*text/html"   $new_host;\n}`,
  );
});

it("retires the API, analytics and socket on the legacy domain, except image reads", () => {
  expect(conf).toContain(
    `map "$request_method $new_host$uri" $legacy_backend {\n    default                                         "";\n    "~^(GET|HEAD) [^/]+/api/images/"                moved;\n    "~^[A-Z]+ [^/]+/(api|events|socket\\.io)(/|$)"   gone;\n}`,
  );
  const https = conf.slice(0, conf.indexOf("listen 80 default_server"));
  const beforeLocations = https.slice(
    https.indexOf("server {"),
    https.indexOf("    location "),
  );
  expect(beforeLocations).toContain(
    "    if ($legacy_backend = gone) {\n        return 410;\n    }\n    if ($legacy_backend = moved) {\n        return 301 https://$new_host$request_uri;\n    }",
  );
});
