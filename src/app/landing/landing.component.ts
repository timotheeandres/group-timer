import { Component, inject, OnInit } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { addDays, addMinutes, constructNow, formatRelative, isBefore, roundToNearestMinutes } from 'date-fns';
import { StorageService, TimerData, TimerId } from '../util/storage.service';
import { Group } from '../model/group';

@Component({
  selector: 'app-landing',
  imports: [
    MatInputModule,
    MatButtonModule,
    MatSliderModule,
    MatTimepickerModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit {
  protected readonly minGroups = 1;
  protected readonly maxGroups = 15;

  private readonly router = inject(Router);
  private readonly storageService = inject(StorageService);

  protected existingTimers: Array<[TimerId, TimerData]> = [];

  get nextClosestQuarter(): Date {
    return roundToNearestMinutes(addMinutes(constructNow(undefined), 5), {
      nearestTo: 15,
      roundingMethod: "ceil"
    });
  }

  protected readonly formGroup = new FormGroup(
    {
      nbGroups: new FormControl(5, { validators: [ Validators.required, Validators.min(this.minGroups), Validators.max(this.maxGroups) ] }),
      deadline: new FormControl(this.nextClosestQuarter, { validators: [ Validators.required ] })
    }
  );

  ngOnInit(): void {
    this.existingTimers = [ ...this.storageService.getAllTimerData().entries() ];
  }

  async createTimer() {
    let deadline = this.formGroup.value.deadline;
    const nbGroups = this.formGroup.value.nbGroups;
    if (this.formGroup.invalid || !deadline || !nbGroups) {
      return;
    }

    if (isBefore(deadline, constructNow(undefined))) {
      deadline = addDays(deadline, 1);
    }

    const groups = [];
    for (let i = 0; i < nbGroups; ++i) {
      groups.push(new Group());
    }

    const timerId = this.storageService.newTimerData({
      groups: groups,
      deadline: deadline,
      groupIndex: 0,
      isPaused: true
    });

    await this.router.navigate([ 'timer', timerId ]);
  }

  protected toReadableTime(datetime: Date): string {
    return formatRelative(datetime, constructNow(undefined));
  }
}
