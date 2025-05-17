import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { combineLatest, distinctUntilChanged, interval, map, share, shareReplay, startWith } from 'rxjs';
import {
  constructNow,
  differenceInMilliseconds,
  formatISO,
  isEqual,
  parseISO,
  parseJSON,
  subMilliseconds
} from 'date-fns';
import { AsyncPipe } from '@angular/common';
import { ToTimePipe } from '../util/pipe/toTime.pipe';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

@Component({
  selector: 'app-timer',
  imports: [
    AsyncPipe,
    ToTimePipe
  ],
  templateUrl: './timer.component.html',
  styleUrl: './timer.component.css'
})
export class TimerComponent implements OnInit, OnDestroy {
  private static readonly TICK_MS = 100;
  private static readonly SAVE_PERIOD_MS = 2000;
  private static readonly LOCAL_STORAGE_KEY = 'timer-data';

  protected readonly router = inject(Router);

  protected readonly inputNbGroups = input.required<number | string>({ alias: "groups" });
  protected readonly inputDeadline = input.required<Date | string>({ alias: "deadline" });

  protected readonly isPaused = signal(false);
  protected readonly groupIndex = signal(0);
  protected readonly previousGroups = computed(() => this.groups.slice(0, this.groupIndex()).reverse());

  protected groups: Array<Group> = [];
  protected nbGroups: number = 0;
  protected deadline: Date = new Date();

  private readonly refresh$ = combineLatest([ toObservable(this.groupIndex), interval(TimerComponent.TICK_MS) ]).pipe(startWith(null), share());

  private saveInterval?: number;

  readonly currentGroupDuration$ = this.refresh$.pipe(
    map(() => this.currentGroup.duration),
    shareReplay(1)
  );
  readonly remainingDurationPerGroup$ = this.currentGroupDuration$.pipe(startWith(0))
    .pipe(
      map((currentDuration) => this.computeRemainingDurationForWaitingGroups(currentDuration)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  readonly isAllottedTimeReached$ =
    combineLatest([ this.currentGroupDuration$, this.remainingDurationPerGroup$ ])
      .pipe(
        map(([ duration, remaining ]) => duration >= remaining)
      );

  get currentGroup(): Group {
    return this.groups[this.groupIndex()];
  }

  ngOnInit(): void {
    const inputNbGroups = this.inputNbGroups();
    const inputDeadline = this.inputDeadline();
    this.nbGroups = +inputNbGroups;
    this.deadline = typeof inputDeadline === 'string' ? parseISO(inputDeadline) : inputDeadline;

    if (this.nbGroups <= 0) {
      throw new Error("The number of groups cannot be less than 1");
    }

    if (!this.restoreData()) {
      for (let i = 0; i < this.nbGroups; i++) {
        this.groups.push(new Group(i));
      }

      this.resume();
    }

    this.saveInterval = setInterval(() => this.saveData(), TimerComponent.SAVE_PERIOD_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.saveInterval);
  }

  resume() {
    this.currentGroup.resume();
    this.isPaused.set(false);
  }

  pause() {
    this.currentGroup.pause();
    this.isPaused.set(true);
  }

  updateGroup(delta: number) {
    const nextIndex = this.groupIndex() + delta;
    if (!(0 <= nextIndex && nextIndex <= this.nbGroups - 1)) {
      return;
    }
    const wasPaused = this.isPaused();
    this.pause();
    this.groupIndex.set(nextIndex);
    if (!wasPaused) {
      this.resume();
    }
  }

  protected async backToLanding() {
    this.clearData();
    return this.router.navigate([ '/' ]);
  }

  private computeRemainingDurationForWaitingGroups(currentGroupDuration: number): number {
    const now = constructNow(undefined);
    const nbGroupsWaiting = this.nbGroups - this.groupIndex() - 1;
    const currentGroupStart = subMilliseconds(now, currentGroupDuration);

    if (nbGroupsWaiting === 0) {
      return differenceInMilliseconds(this.deadline, now);
    }

    const theoreticalDurationPerGroup = differenceInMilliseconds(this.deadline, currentGroupStart) / (nbGroupsWaiting + 1);
    const remainingDurationPerWaitingGroup = differenceInMilliseconds(this.deadline, now) / nbGroupsWaiting;

    return Math.min(theoreticalDurationPerGroup, remainingDurationPerWaitingGroup);
  }

  private saveData() {
    const data: SaveData = {
      groups: this.groups.map(group => ({
        ...group,
        lastResume: group.lastResume !== undefined ? formatISO(group.lastResume) : undefined
      })),
      deadline: formatISO(this.deadline),
      isPaused: this.isPaused(),
      groupIndex: this.groupIndex(),
    };
    sessionStorage.setItem(TimerComponent.LOCAL_STORAGE_KEY, JSON.stringify(data));
  }

  private restoreData(): boolean {
    const rawData = sessionStorage.getItem(TimerComponent.LOCAL_STORAGE_KEY);
    if (rawData !== null) {
      const data: SaveData = JSON.parse(rawData);
      const deadline = parseJSON(data.deadline);
      if (data.groups.length === this.nbGroups && isEqual(deadline, this.deadline)) {
        this.groups = data.groups.map(groupData =>
          new Group(groupData.id, groupData.elapsedTimeMs, groupData.lastResume !== undefined ? parseJSON(groupData.lastResume) : undefined));
        this.deadline = deadline;
        this.isPaused.set(data.isPaused);
        this.groupIndex.set(data.groupIndex);

        return true;
      }
    }
    return false;
  }

  private clearData() {
    sessionStorage.clear();
  }
}

class Group {
  constructor(readonly id: number, public elapsedTimeMs: number = 0, public lastResume?: Date) {
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


type SaveData = {
  groups: Array<{ elapsedTimeMs: number, lastResume?: string, id: number }>,
  deadline: string,
  isPaused: boolean,
  groupIndex: number
};
