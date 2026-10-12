export type ChartContext = ReturnType<typeof createChartContext>;

export function createChartContext(signal: AbortSignal) {
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const tip = $("ir-tip");
  const live = $("ir-live");

  function showTip(html: string, cx: number, cy: number) {
    tip.innerHTML = html;
    tip.style.display = "block";
    const r = tip.getBoundingClientRect();
    let x = cx + 14;
    let y = cy + 16;
    if (x + r.width > innerWidth - 8) x = cx - r.width - 12;
    if (y + r.height > innerHeight - 8) y = cy - r.height - 14;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  function hideTip() {
    tip.style.display = "none";
  }
  function vbPoint(svg: SVGSVGElement, ev: PointerEvent, w: number) {
    const r = svg.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) * w) / r.width,
      y: ((ev.clientY - r.top) * w) / r.width,
    };
  }
  function wireRadios(
    containerId: string,
    onPick: (b: HTMLButtonElement) => void,
  ) {
    const btns = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        `#${containerId} button.chip`,
      ),
    );
    btns.forEach((b) =>
      b.addEventListener(
        "click",
        () => {
          btns.forEach((o) => {
            const on = String(o === b);
            o.setAttribute("aria-pressed", on);
            o.setAttribute("aria-checked", on);
          });
          onPick(b);
        },
        { signal },
      ),
    );
  }

  return { signal, $, live, showTip, hideTip, vbPoint, wireRadios };
}
