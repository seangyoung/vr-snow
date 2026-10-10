/** Keyboard access to the DOM panels; game actions still use the existing buttons. */
export class DesktopKeyboard {
  private previousPanel?: string;
  private focusedKey?: string;
  private focusedInUi = false;

  constructor(private root: HTMLElement, private scene: HTMLElement | null, private transitioning: () => boolean) {
    window.addEventListener("keydown", event => this.onKey(event), true);
  }

  private panel(): HTMLElement | null {
    return this.root.querySelector(".overlay-panel")
      ?? this.root.querySelector(".dialogue-panel, .synthesis-panel, .chapter-panel");
  }

  private buttons(scope: HTMLElement): HTMLButtonElement[] {
    return [...scope.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
      .filter(button => button.getClientRects().length > 0);
  }

  private key(element: HTMLElement): string {
    return JSON.stringify([element.dataset.action, element.dataset.questionId, element.dataset.locationId,
      element.dataset.hypothesisId]);
  }

  beforeRender(): void {
    const active = document.activeElement;
    this.focusedInUi = active instanceof HTMLElement && this.root.contains(active);
    this.focusedKey = this.focusedInUi ? this.key(active as HTMLElement) : undefined;
  }

  afterRender(): void {
    if (document.body.dataset.xrPresenting === "true" || this.transitioning()) return;
    const panel = this.panel();
    const panelKey = panel?.getAttribute("aria-label") ?? undefined;
    if (this.scene) this.scene.inert = Boolean(panel);
    for (const child of this.root.querySelector(".hud")?.children ?? []) {
      if (child instanceof HTMLElement) child.inert = Boolean(panel && child !== panel);
    }
    if (panel) {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.tabIndex = -1;
      const buttons = this.buttons(panel);
      const preserved = panelKey === this.previousPanel && this.focusedKey
        ? buttons.find(button => this.key(button) === this.focusedKey) : undefined;
      const primary = buttons.find(button => ["ask", "travel", "begin", "finish-board", "select-hypothesis"].includes(button.dataset.action ?? ""));
      // A redraw resets scrolling; keep the selected control visible as well as focused.
      (preserved ?? primary ?? buttons[0] ?? panel).focus();
    } else if (this.previousPanel) {
      this.scene?.focus({ preventScroll: true });
    } else if (this.focusedInUi && this.focusedKey) {
      this.buttons(this.root).find(button => this.key(button) === this.focusedKey)?.focus({ preventScroll: true });
    }
    this.previousPanel = panelKey;
  }

  private onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || document.body.dataset.xrPresenting === "true") return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) return;
    if (this.transitioning()) {
      if ([" ", "Enter", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "m", "n"].includes(event.key)) event.preventDefault();
      return;
    }
    const panel = this.panel();
    if (event.repeat && [" ", "enter", "escape", "m", "n"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      const close = panel?.querySelector<HTMLButtonElement>('[data-action="close"], [data-action="close-dialogue"], [data-action="close-snow-review"]');
      if (close) close.click();
      else if (!panel) this.scene?.focus({ preventScroll: true });
      return;
    }
    const tool = event.key.toLowerCase() === "m" ? "map" : event.key.toLowerCase() === "n" ? "notebook" : undefined;
    if (tool && !["briefing", "board"].includes(document.body.dataset.stage ?? "")) {
      event.preventDefault();
      this.root.querySelector<HTMLButtonElement>(`.tool-rail [data-action="${tool}"]`)?.click();
      return;
    }
    if (!panel) return;
    const buttons = this.buttons(panel);
    if (event.key === "Tab") {
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
      (buttons[next] ?? panel).focus();
    } else if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key) && buttons.length > 1) {
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
      buttons[(index + step + buttons.length) % buttons.length]?.focus();
    } else if (["PageDown", "PageUp"].includes(event.key) || (buttons.length <= 1 && ["ArrowDown", "ArrowUp"].includes(event.key))) {
      const scroll = [panel, ...panel.querySelectorAll<HTMLElement>("*")].find(element =>
        element.scrollHeight > element.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(element).overflowY));
      if (scroll) {
        event.preventDefault();
        scroll.scrollTop += (event.key.endsWith("Down") ? 1 : -1) * scroll.clientHeight * .8;
      }
    }
  }
}
