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

const follow = () => loader({ params: { customLinkSlug: "100k" } });

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
