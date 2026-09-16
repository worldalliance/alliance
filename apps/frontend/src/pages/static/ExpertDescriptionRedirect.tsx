import { href, redirect } from "react-router";

export function loader() {
  return redirect(href("/guide"));
}

export default function ExpertDescriptionRedirect() {
  return null;
}
