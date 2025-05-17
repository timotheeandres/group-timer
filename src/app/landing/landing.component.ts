import { Component, inject } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { constructNow, formatISO, roundToNearestMinutes } from 'date-fns';

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
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  protected readonly minGroups = 1;
  protected readonly maxGroups = 15;

  protected router = inject(Router);

  protected readonly formGroup = new FormGroup(
    {
      nbGroups: new FormControl(5, { validators: [ Validators.required, Validators.min(this.minGroups), Validators.max(this.maxGroups) ] }),
      deadline: new FormControl(roundToNearestMinutes(constructNow(undefined), {
        nearestTo: 15,
        roundingMethod: "ceil"
      }), { validators: [ Validators.required ] })
    }
  );

  async createTimer() {
    await this.router.navigate([ 'timer' ], {
      queryParams: {
        groups: this.formGroup.value.nbGroups,
        deadline: formatISO(this.formGroup.value.deadline)
      }
    });
  }
}
