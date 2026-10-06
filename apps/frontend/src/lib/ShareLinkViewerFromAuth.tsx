import {
  ShareLinkViewer,
  ShareLinkViewerProvider,
} from "@alliance/sharedweb/forms/BigLinkDisplay";
import React from "react";
import { useAuth } from "./AuthContext";

export function ShareLinkViewerFromAuth({ children }: React.PropsWithChildren) {
  const { isAuthenticated, loading } = useAuth();
  const viewer = loading
    ? ShareLinkViewer.Pending
    : isAuthenticated
      ? ShareLinkViewer.Member
      : ShareLinkViewer.Anonymous;
  return (
    <ShareLinkViewerProvider value={viewer}>{children}</ShareLinkViewerProvider>
  );
}
