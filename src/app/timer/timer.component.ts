import { Component, computed, HostListener, inject, input, OnInit, signal } from '@angular/core';
import { combineLatest, distinctUntilChanged, interval, map, share, shareReplay, startWith } from 'rxjs';
import { constructNow, differenceInMilliseconds, subMilliseconds } from 'date-fns';
import { AsyncPipe } from '@angular/common';
import { ToTimePipe } from '../util/pipe/toTime.pipe';
import { StorageService, TimerData, TimerId } from '../util/storage.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { Group } from '../model/group';

@Component({
  selector: 'app-timer',
  imports: [
    AsyncPipe,
    ToTimePipe,
    MatButton,
    MatTableModule,
    MatFabButton,
    MatIconModule,
    RouterLink
  ],
  templateUrl: './timer.component.html',
  styleUrl: './timer.component.css'
})
export class TimerComponent implements OnInit {
  private static readonly TICK_MS = 100;

  private readonly router = inject(Router);
  private readonly storageService = inject(StorageService);

  private lockWasTakenBeforeVisibilityChange: boolean = false;

  @HostListener('document:visibilitychange')
  protected visibilitychange() {
    if (document.visibilityState === 'hidden') {
      this.lockWasTakenBeforeVisibilityChange = this.wakeLock !== undefined;
    } else if (document.visibilityState === 'visible' && this.lockWasTakenBeforeVisibilityChange) {
      void this.requestWakeLock();
    }
  }

  protected readonly timerId = input.required<TimerId>();

  protected readonly isPaused = signal(true);
  protected readonly groupIndex = signal(0);
  protected readonly groups = signal<Group[]>([]);
  protected readonly currentGroup = computed(() => this.groups()[this.groupIndex()]);

  protected readonly previousGroupsColumns = [ 'id', 'duration', 'actions' ] as const;

  protected deadline: Date = new Date();

  private wakeLock?: Promise<WakeLockSentinel>;

  private readonly refresh$ = combineLatest([ toObservable(this.currentGroup), interval(TimerComponent.TICK_MS) ]).pipe(startWith(null), share());

  readonly currentGroupDuration$ = this.refresh$.pipe(
    map(() => this.currentGroup().duration),
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

  ngOnInit(): void {
    if (!this.restoreData()) {
      console.error(`Could not restore timer data for id ${this.timerId()}`);
      void this.router.navigate([ '/' ], { replaceUrl: true });
    }
  }

  resume() {
    this.currentGroup().resume();
    this.isPaused.set(false);
    void this.requestWakeLock();
    this.saveData();
  }

  pause() {
    this.currentGroup().pause();
    this.isPaused.set(true);
    void this.releaseWakeLock();
    this.saveData();
  }

  selectGroup(index: number) {
    if (!(0 <= index && index <= this.groups().length - 1)) {
      return;
    }
    const wasPaused = this.isPaused();
    this.pause();
    this.groupIndex.set(index);
    if (!wasPaused) {
      this.resume();
    }
    this.saveData();
  }

  nextGroup() {
    this.selectGroup(this.groupIndex() + 1);
  }

  previousGroup() {
    this.selectGroup(this.groupIndex() - 1);
  }

  protected renameGroup(group: Group, index: number): void {
    const newName = prompt(`New group name for group ${group.name ? `"${group.name}"` : index + 1}:`);
    group.name = (newName ?? group.name) || undefined;
    this.saveData();
  }

  private computeRemainingDurationForWaitingGroups(currentGroupDuration: number): number {
    const now = constructNow(undefined);
    const nbGroupsWaiting = this.groups().length - this.groupIndex() - 1;
    const currentGroupStart = subMilliseconds(now, currentGroupDuration);

    if (nbGroupsWaiting === 0) {
      return differenceInMilliseconds(this.deadline, now);
    }

    const theoreticalDurationPerGroup = differenceInMilliseconds(this.deadline, currentGroupStart) / (nbGroupsWaiting + 1);
    const remainingDurationPerWaitingGroup = differenceInMilliseconds(this.deadline, now) / nbGroupsWaiting;

    return Math.min(theoreticalDurationPerGroup, remainingDurationPerWaitingGroup);
  }

  private saveData() {
    const data: TimerData = {
      groups: this.groups(),
      deadline: this.deadline,
      isPaused: this.isPaused(),
      groupIndex: this.groupIndex(),
    };
    this.storageService.storeTimerData(this.timerId(), data);
  }

  private restoreData(): boolean {
    const data = this.storageService.getTimerData(this.timerId());
    if (data) {
      const deadline = data.deadline;
      const groups = data.groups.map(groupData => {
        const elapsedTime = groupData.elapsedTimeMs;
        const lastResume = groupData.lastResume;
        const name = groupData.name;
        return new Group(elapsedTime, lastResume, name);
      });
      this.groups.set(groups);
      this.deadline = deadline;
      this.isPaused.set(data.isPaused);
      this.groupIndex.set(data.groupIndex);

      return true;
    }
    return false;
  }

  private async requestWakeLock(): Promise<void> {
    if (this.wakeLock && !(await this.wakeLock).released) {
      return;
    }

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
