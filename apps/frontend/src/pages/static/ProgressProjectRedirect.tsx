import { href, redirect } from "react-router";

export function loader({ params }: { params: { slug: string } }) {
  return redirect(href("/projects/:slug", { slug: params.slug }));
}

export default function ProgressProjectRedirect() {
  return null;
}
