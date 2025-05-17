import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { intervalToDuration, Locale } from 'date-fns';
import { fr, frCH } from 'date-fns/locale';


@Pipe({ name: 'toTime' })
export class ToTimePipe implements PipeTransform {
  protected localeCode = inject(LOCALE_ID);

  get locale(): Locale | undefined {
    switch (this.localeCode.toLowerCase()) {
      case 'fr':
        return fr;
      case 'fr-ch':
        return frCH;
      default:
        return undefined;
    }
  }

  transform(value: number | null): string {
    const clampedValue = (value && value > 0) ? value : 0;
    const duration = intervalToDuration({ start: 0, end: clampedValue });
    duration.seconds ??= 0;

    // return formatDuration(duration, { zero: true, locale: this.locale });

    let str = `${this.pad(duration.minutes)}:${this.pad(duration.seconds)}`;

    const hours = duration.hours;
    if (hours) {
      str = `${this.pad(hours)}:${str}`;
    }

    return str;
  }

  pad(value?: number): string {
    return String(value ?? 0).padStart(2, '0');
  }
}
