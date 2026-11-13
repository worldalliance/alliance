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
