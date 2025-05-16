import * as Locales from 'date-fns/locale';
import { Locale } from 'date-fns';

export function getLocaleByCode(code: string): Locale | undefined {
  return Object.values(Locales).find((locale) => locale.code === code);
}
