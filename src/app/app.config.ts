import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { enUS } from 'date-fns/locale';
import { routes } from './app.routes';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { getLocaleByCode } from './util/util';


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideDateFnsAdapter(),
    { provide: MAT_DATE_LOCALE, useFactory: (localeId: string) => getLocaleByCode(localeId) ?? enUS, deps: [ LOCALE_ID ] },
  ]
};
