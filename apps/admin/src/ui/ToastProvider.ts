// The toast and confirm context. The shared form renderer and shared hooks call
// `useToast` on it, so the admin mounts and reads the same instance; its toasts
// and confirm dialogs keep the shared look until sharedweb exposes the context.
export * from "@alliance/sharedweb/ui/ToastProvider";
