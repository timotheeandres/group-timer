import { Component, inject } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { constructNow, roundToNearestMinutes } from 'date-fns';

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
  protected router = inject(Router);

  protected readonly formGroup = new FormGroup(
    {
      nbGroups: new FormControl(5),
      deadline: new FormControl(roundToNearestMinutes(constructNow(undefined), { nearestTo: 15, roundingMethod: "ceil" }))
    }
  );

  async createTimer() {
    await this.router.navigate([ 'timer' ], {
      queryParams: {
        groups: this.formGroup.value.nbGroups,
        deadline: this.formGroup.value.deadline
      }
    });
  }
}
