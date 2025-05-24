import { constructNow, differenceInMilliseconds } from "date-fns";

export class Group {
  constructor(public elapsedTimeMs: number = 0, public lastResume?: Date, public name?: string) {
  }

  get duration(): number {
    let duration = this.elapsedTimeMs;
    if (this.lastResume) {
      duration += differenceInMilliseconds(constructNow(undefined), this.lastResume);
    }
    return duration;
  }

  resume() {
    if (!this.lastResume) {
      this.lastResume = constructNow(undefined);
    }
  }

  pause() {
    if (this.lastResume) {
      this.elapsedTimeMs += differenceInMilliseconds(constructNow(undefined), this.lastResume);
      this.lastResume = undefined;
    }
  }
}
