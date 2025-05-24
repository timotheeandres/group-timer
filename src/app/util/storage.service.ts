import { inject, Injectable } from '@angular/core';
import { Tagged } from 'type-fest';
import { constructNow, formatISO, isBefore, parseISO } from 'date-fns';
import { Group } from '../model/group';
import { WithStringDate } from './util';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private static readonly STORAGE: Storage = localStorage;
  private static readonly ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
  private static readonly ID_LENGTH = 16;

  private readonly router = inject(Router);

  newTimerData(data: TimerData): TimerId {
    const newId = this.generateNewId();
    this.storeTimerData(newId, data);
    return newId;
  }

  storeTimerData(id: TimerId, data: TimerData): void {
    const rawData: RawTimerData = {
      groups: data.groups.map((group) => ({
        ...group,
        lastResume: group.lastResume ? formatISO(group.lastResume) : undefined
      })),
      deadline: formatISO(data.deadline),
      isPaused: data.isPaused,
      groupIndex: data.groupIndex
    };
    StorageService.STORAGE.setItem(id, JSON.stringify(rawData));
  }

  getTimerData(id: TimerId): TimerData | null {
    const value = StorageService.STORAGE.getItem(id);
    const rawData = value && JSON.parse(value) as RawTimerData;
    if (rawData) {
      try {
        return {
          groups: rawData.groups.map((group) => ({
            ...group,
            lastResume: group.lastResume ? parseISO(group.lastResume) : undefined
          })),
          deadline: parseISO(rawData.deadline),
          isPaused: rawData.isPaused,
          groupIndex: rawData.groupIndex
        };
      } catch (_) {
        console.error(`Could not parse JSON value of data for id ${id}, deleting:`, rawData);
        this.clearTimerData(id);
      }
    }
    return null;
  }

  clearTimerData(id: TimerId): void {
    StorageService.STORAGE.removeItem(id);
  }

  getAllTimerData(): Map<TimerId, TimerData> {
    const allTimerData = new Map<TimerId, TimerData>();

    for (const id of Object.keys(StorageService.STORAGE)) {
      const timerId = id as TimerId;
      const timerData = this.getTimerData(timerId);
      if (!timerData) {
        continue;
      }

      if (isBefore(timerData.deadline, constructNow(undefined))) {
        console.log("Cleaning old data", timerData);
        this.clearTimerData(timerId);
      } else {
        allTimerData.set(timerId, timerData);
      }
    }

    return allTimerData;
  }

  private generateNewId(): TimerId {
    let id: string = '';

    for (let i = 0; i < StorageService.ID_LENGTH; ++i) {
      id += StorageService.ID_CHARS[Math.floor(Math.random() * StorageService.ID_CHARS.length)];
    }

    return id as TimerId;
  }
}

export type TimerId = Tagged<string, 'TimerId'>;

export type TimerData = {
  groups: Array<Omit<Group, 'resume' | 'pause' | 'duration'>>,
  deadline: Date,
  isPaused: boolean,
  groupIndex: number
};

type RawTimerData = WithStringDate<TimerData>;
