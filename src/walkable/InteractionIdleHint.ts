/** One brief reminder per idle spell; activity starts a fresh quiet interval. */
export class InteractionIdleHint {
  private idleSince?: number;
  private shownAt?: number;
  reset(time?: number): void { this.idleSince=time; this.shownAt=undefined; }
  update(time: number, busy: boolean): boolean {
    if (busy) { this.reset(time); return false; }
    if (this.idleSince===undefined || time<this.idleSince) this.reset(time);
    if (time-this.idleSince!<30) return false;
    this.shownAt ??= time;
    return time-this.shownAt<4;
  }
}
