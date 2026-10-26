import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { loader } from "./CustomLinkRedirect";

let destination = "/projects/democratic-grantmaking-26?link=flyer#join";
let status = 200;
let unavailable = false;
let arrivals = 0;

serveApi(
  routes({
    "POST /custom-links/resolve/:slug": ({ params }) => {
      if (unavailable) throw new Error("Offline");
      expect(params.slug).toBe("100k");
      arrivals++;
      return status === 200
        ? Response.json({ destination })
        : Response.json({ message: "Missing" }, { status });
    },
  }),
);

beforeEach(() => {
  destination = "/projects/democratic-grantmaking-26?link=flyer#join";
  status = 200;
  unavailable = false;
  arrivals = 0;
});

const follow = (query = "") =>
  loader({
    params: { customLinkSlug: "100k" },
    request: new Request(`https://thealliance.org/100k${query}`),
  });

test("preserves incoming parameters on a site redirect", async () => {
  destination = "/projects/democratic-grantmaking-26";
  expect((await follow("?link=BLABBITY")).headers.get("Location")).toBe(
    `${destination}?link=BLABBITY`,
  );
  expect(arrivals).toBe(1);
});

test("merges parameters with incoming values taking precedence", async () => {
  destination = "/projects/democratic-grantmaking-26?link=saved&tab=about#join";
  const response = await follow(
    "?link=BLABBITY&tag=one&tag=two&empty=&q=a%26b",
  );
  expect(response.headers.get("Location")).toBe(
    "/projects/democratic-grantmaking-26?tab=about&link=BLABBITY&tag=one&tag=two&empty=&q=a%26b#join",
  );
});

test.each([
  "https://thealliance.org",
  "https://www.thealliance.org",
  "https://worldalliance.org",
  "https://staging.thealliance.org",
])("preserves parameters for an absolute site URL on %s", async (origin) => {
  destination = `${origin}/projects/democratic-grantmaking-26#join`;
  expect((await follow("?link=BLABBITY")).headers.get("Location")).toBe(
    "/projects/democratic-grantmaking-26?link=BLABBITY#join",
  );
});

test.each([
  "https://example.com/page?ref=saved#join",
  "https://thealliance.org.example.com/page",
  "https://admin.thealliance.org/page",
])("does not forward parameters to %s", async (url) => {
  destination = url;
  expect((await follow("?link=BLABBITY")).headers.get("Location")).toBe(url);
});

test("keeps a normalized double-slash path on our origin", async () => {
  destination = "/projects/..//example.com/page";
  expect((await follow("?link=BLABBITY")).headers.get("Location")).toBe(
    "https://thealliance.org//example.com/page?link=BLABBITY",
  );
});

test("returns an uncached HTTP redirect with saved attribution", async () => {
  const response = await follow();
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe(destination);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(arrivals).toBe(1);
});

test("uses an edited destination on the next visit", async () => {
  await follow();
  destination = "https://example.com/new?ref=flyer";
  expect((await follow()).headers.get("Location")).toBe(destination);
  expect(arrivals).toBe(2);
});

test("returns 404 for an unknown custom link", async () => {
  status = 404;
  await expect(follow()).rejects.toMatchObject({ status: 404 });
});

test("fails visibly when the resolver cannot be reached", async () => {
  unavailable = true;
  await expect(follow()).rejects.toMatchObject({ status: 503 });
});
