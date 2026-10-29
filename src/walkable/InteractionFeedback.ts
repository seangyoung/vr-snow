/** Optional WebXR vibration; unsupported or disconnected devices remain usable. */
export class InteractionFeedback {
  enabled = true;
  private readonly last = new WeakMap<Gamepad, number>();
  pulse(source: XRInputSource | undefined, kind: 'grab' | 'transfer' | 'teleport' | 'pump'): void {
    const pad = source?.gamepad;
    if (!this.enabled || !pad || source?.hand) return;
    const actuator = (pad as Gamepad & {hapticActuators?: {pulse(value:number,duration:number):Promise<boolean>}[]}).hapticActuators?.[0];
    if (!actuator?.pulse) return;
    const now = performance.now();
    if (now - (this.last.get(pad) ?? -Infinity) < 80) return;
    this.last.set(pad, now);
    const [strength, duration] = kind === 'pump' ? [.28, 65] : kind === 'teleport' ? [.22, 45] : [.16, 28];
    try { void Promise.resolve(actuator.pulse(strength, duration)).catch(() => {}); } catch { /* Device disappeared. */ }
  }
}
export const interactionFeedback = new InteractionFeedback();
