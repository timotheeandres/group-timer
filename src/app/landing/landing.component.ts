import { Component, inject } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { addDays, addMinutes, constructNow, formatISO, isBefore, roundToNearestMinutes } from 'date-fns';

@Component({
  selector: 'app-landing',
  imports: [
    MatInputModule,
    MatButtonModule,
    MatSliderModule,
    MatTimepickerModule,
    ReactiveFormsModule
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  protected readonly minGroups = 1;
  protected readonly maxGroups = 15;

  protected router = inject(Router);

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

  async createTimer() {
    let deadline = this.formGroup.value.deadline;
    const nbGroups = this.formGroup.value.nbGroups;
    if (this.formGroup.invalid || !deadline || !nbGroups) {
      return;
    }

    if (isBefore(deadline, constructNow(undefined))) {
      deadline = addDays(deadline, 1);
    }

    await this.router.navigate([ 'timer' ], {
      queryParams: {
        groups: nbGroups,
        deadline: formatISO(deadline)
      }
    });
  }
}
