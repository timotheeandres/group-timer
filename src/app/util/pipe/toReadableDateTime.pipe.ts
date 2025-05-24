import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { intlFormat } from 'date-fns';


@Pipe({ name: 'toReadableDateTime' })
export class ToReadableDateTimePipe implements PipeTransform {
  protected localeCode = inject(LOCALE_ID);

  transform(value: Date): string {
    return intlFormat(value, { dateStyle: "long", timeStyle: "medium" }, { locale: this.localeCode });
  }
}
