type Frame = { parent: unknown; url: string } | null | undefined;

/** Whether an IPC message comes from the app's own page: a top-level frame at the scheme and host of the URL the window loads. */
export function isRendererFrame(params: {
  frame: Frame;
  rendererUrl: string;
}): boolean {
  const { frame, rendererUrl } = params;
  if (!frame || frame.parent !== null || !URL.canParse(frame.url)) return false;
  const sender = new URL(frame.url);
  const renderer = new URL(rendererUrl);
  // Origins don't serve here, since Node gives app:// URLs the opaque origin "null".
  return sender.protocol === renderer.protocol && sender.host === renderer.host;
}

export const fromRendererOnly =
  <E extends { senderFrame: Frame }, A, T>(params: {
    rendererUrl: string;
    listener: (event: E, arg: A) => T;
    refuse: () => T;
  }) =>
  (event: E, arg: A): T =>
    isRendererFrame({
      frame: event.senderFrame,
      rendererUrl: params.rendererUrl,
    })
      ? params.listener(event, arg)
      : params.refuse();
