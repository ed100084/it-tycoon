import type { GameDate } from '../game/core/types';

export function compareGameDate(a: GameDate, b: GameDate): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function gameDateLte(a: GameDate, b: GameDate): boolean {
  return compareGameDate(a, b) <= 0;
}

export function gameDateEquals(a: GameDate, b: GameDate): boolean {
  return a.year === b.year && a.month === b.month;
}

export function monthsBetween(a: GameDate, b: GameDate): number {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function addMonths(date: GameDate, n: number): GameDate {
  const totalMonths = (date.year - 1) * 12 + (date.month - 1) + n;
  const year = Math.floor(totalMonths / 12) + 1;
  const month = (totalMonths % 12) + 1;
  return { year, month };
}

export function isQuarterEnd(date: GameDate): boolean {
  return date.month % 3 === 0;
}

export function getQuarter(date: GameDate): 1 | 2 | 3 | 4 {
  return Math.ceil(date.month / 3) as 1 | 2 | 3 | 4;
}

export function formatGameDate(date: GameDate): string {
  return `${date.year}/${String(date.month).padStart(2, '0')}`;
}
