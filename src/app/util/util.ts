import * as Locales from 'date-fns/locale';
import { Locale } from 'date-fns';

export function getLocaleByCode(code: string): Locale | undefined {
  return Object.values(Locales).find((locale) => locale.code === code);
}

export type WithStringDate<T> = T extends Date ? string : T extends object ? { [P in keyof T]: WithStringDate<T[P]> } : T;
