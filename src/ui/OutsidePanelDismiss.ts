/** A completed primary click dismisses a panel; drags and cancelled gestures do not. */
export function activeDesktopPanel(root: HTMLElement): HTMLElement | null {
  return root.querySelector(".overlay-panel")
    ?? root.querySelector(".dialogue-panel, .synthesis-panel, .chapter-panel");
}

export class OutsidePanelDismiss {
  private gesture?: {
    id: number; panel: HTMLElement; outside: boolean; x: number; y: number;
    travel: number; released: boolean;
  };

  constructor(private root: HTMLElement, private enabled: () => boolean, private dismiss: () => void,
    private passThrough: (event: MouseEvent) => boolean = () => false) {
    document.addEventListener("pointerdown", event => {
      this.gesture = undefined;
      const panel = activeDesktopPanel(this.root);
      if (!this.enabled() || !panel || event.button !== 0 || !event.isPrimary) return;
      this.gesture = { id: event.pointerId, panel, outside: !this.inside(panel, event),
        x: event.clientX, y: event.clientY, travel: 0, released: false };
    }, true);
    document.addEventListener("pointermove", event => this.move(event), true);
    document.addEventListener("pointerup", event => {
      this.move(event);
      if (this.gesture?.id === event.pointerId) this.gesture.released = true;
    }, true);
    document.addEventListener("pointercancel", () => { this.gesture = undefined; }, true);
    document.addEventListener("visibilitychange", () => { this.gesture = undefined; });
    window.addEventListener("blur", () => { this.gesture = undefined; });
    document.addEventListener("click", event => {
      const gesture = this.gesture;
      this.gesture = undefined;
      if (!gesture || !gesture.released || !this.enabled() || event.button !== 0 || event.detail === 0
        || ("pointerId" in event && event.pointerId !== gesture.id)
        || activeDesktopPanel(this.root) !== gesture.panel || this.inside(gesture.panel, event)) return;
      // Nonmodal conversations let the scene distinguish props, people and ground.
      if (gesture.outside && gesture.travel <= 6 && this.passThrough(event)) return;
      // Consume the click even after a drag out of a panel. It must never reach
      // a background travel target, reset button, or a newly exposed dialog.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (gesture.outside && gesture.travel <= 6) this.dismiss();
    }, true);
  }

  private move(event: PointerEvent): void {
    const gesture = this.gesture;
    if (!gesture || gesture.id !== event.pointerId || gesture.released) return;
    gesture.travel += Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    gesture.x = event.clientX; gesture.y = event.clientY;
  }

  private inside(panel: HTMLElement, event: MouseEvent): boolean {
    const bounds = panel.getBoundingClientRect();
    // Coordinates also handle touch's implicit pointer capture, which can keep
    // the canvas as event.target after the finger has moved onto the panel.
    return event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  }
}
