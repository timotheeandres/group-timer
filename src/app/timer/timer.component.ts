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
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-timer',
  imports: [
    AsyncPipe,
    ToTimePipe,
    MatButton,
    MatTableModule,
    MatFabButton,
    MatIconModule
  ],
  templateUrl: './timer.component.html',
  styleUrl: './timer.component.css'
})
export class TimerComponent implements OnInit, OnDestroy {
  private static readonly TICK_MS = 100;
  private static readonly SAVE_PERIOD_MS = 2000;
  private static readonly STORAGE_KEY = 'timer-data';

  private static readonly STORAGE: Storage = localStorage;

  protected readonly router = inject(Router);

  protected readonly inputNbGroups = input.required<number | string>({ alias: "groups" });
  protected readonly inputDeadline = input.required<Date | string>({ alias: "deadline" });

  protected readonly isPaused = signal(true);
  protected readonly groupIndex = signal(0);
  protected readonly previousGroupsData = computed(() => {
    return this.groups.map((group, index) => ({
      id: index + 1,
      duration: group.elapsedTimeMs
    })).slice(0, this.groupIndex()).reverse();
  });

  protected readonly previousGroupsColumns = [ 'id', 'duration' ] as const;

  protected groups: Array<Group> = [];
  protected nbGroups: number = 0;
  protected deadline: Date = new Date();

  protected wakeLock?: Promise<WakeLockSentinel>;

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
        this.groups.push(new Group(i + 1));
      }
    }

    this.saveInterval = setInterval(() => this.saveData(), TimerComponent.SAVE_PERIOD_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.saveInterval);
    void this.releaseWakeLock();
  }

  resume() {
    this.currentGroup.resume();
    this.isPaused.set(false);
    void this.requestWakeLock();
  }

  pause() {
    this.currentGroup.pause();
    this.isPaused.set(true);
    void this.releaseWakeLock();
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

  protected async backToLanding(ev: MouseEvent) {
    ev.preventDefault();

    const shouldClose = confirm("Are you sure you want to leave? Your timers will be lost.");
    if (!shouldClose) {
      return;
    }

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
    TimerComponent.STORAGE.setItem(TimerComponent.STORAGE_KEY, JSON.stringify(data));
  }

  private restoreData(): boolean {
    const rawData = TimerComponent.STORAGE.getItem(TimerComponent.STORAGE_KEY);
    if (rawData !== null) {
      const data: SaveData = JSON.parse(rawData);
      const deadline = parseJSON(data.deadline);
      if (data.groups.length === this.nbGroups && isEqual(deadline, this.deadline)) {
        this.groups = data.groups.map(groupData =>
          new Group(groupData.elapsedTimeMs, groupData.lastResume !== undefined ? parseJSON(groupData.lastResume) : undefined));
        this.deadline = deadline;
        this.isPaused.set(data.isPaused);
        this.groupIndex.set(data.groupIndex);

        return true;
      }
    }
    return false;
  }

  private clearData() {
    TimerComponent.STORAGE.clear();
  }

  private async requestWakeLock(): Promise<void> {
    this.wakeLock = navigator.wakeLock.request();

    try {
      await this.wakeLock;
    } catch (error) {
      console.warn("WakeLock failed:", error);
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      const release = (await this.wakeLock).release();
      this.wakeLock = undefined;
      await release;
    }
  }
}

class Group {
  constructor(public elapsedTimeMs: number = 0, public lastResume?: Date) {
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
  groups: Array<{ elapsedTimeMs: number, lastResume?: string }>,
  deadline: string,
  isPaused: boolean,
  groupIndex: number
};
