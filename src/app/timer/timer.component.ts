import { Component, computed, input, OnInit, signal } from '@angular/core';
import { Group } from './group';
import { combineLatest, distinctUntilChanged, interval, map, share, shareReplay, startWith } from 'rxjs';
import { constructNow, differenceInMilliseconds, subMilliseconds } from 'date-fns';
import { AsyncPipe } from '@angular/common';
import { ToTimePipe } from '../util/pipe/toTime.pipe';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-timer',
  imports: [
    AsyncPipe,
    ToTimePipe
  ],
  templateUrl: './timer.component.html',
  styleUrl: './timer.component.css'
})
export class TimerComponent implements OnInit {
  private static readonly TICK_MS = 100;

  protected readonly inputNbGroups = input.required<number>({ alias: "groups" });
  protected readonly inputDeadline = input.required<Date>({ alias: "deadline" });

  protected readonly isPaused = signal(false);
  protected readonly groupIndex = signal(0);
  protected readonly previousGroups = computed(() => this.computePreviousGroups());

  protected groups: Array<Group> = [];
  protected nbGroups: number = 0;
  protected deadline: Date = new Date();

  private readonly refresh$ = combineLatest([ toObservable(this.groupIndex), interval(TimerComponent.TICK_MS) ]).pipe(startWith(null), share());

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
    this.nbGroups = this.inputNbGroups();
    this.deadline = this.inputDeadline();

    if (this.nbGroups <= 0) {
      throw new Error("The number of groups cannot be less than 1");
    }

    for (let i = 0; i < this.nbGroups; i++) {
      this.groups.push(new Group(i));
    }

    this.resume();
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
    if (0 <= nextIndex && nextIndex <= this.nbGroups - 1) {
      this.pause();
      this.groupIndex.set(nextIndex);
      this.resume();
    }
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

  private computePreviousGroups(): Array<Group> {
    return this.groups.slice(0, this.groupIndex()).reverse();
  }
}
