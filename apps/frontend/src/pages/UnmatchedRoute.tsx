// React Router skips the root loader when no route matches, which would leave
// the client without the runtime config the root loader hands it.
export function loader(): never {
  throw new Response(null, { status: 404 });
}

// Without an action, React Router answers a POST here with 405.
export const action = loader;

// Without a default export, React Router serves this as a resource route,
// whose 404 has an empty body in place of the not-found page.
export default function UnmatchedRoute() {
  return null;
}
