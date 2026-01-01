import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEasterDate(year: number): Date {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);

  return new Date(year, month - 1, day);
}

export function isItalianHoliday(date: Date): boolean {
  const d = date.getDate();
  const m = date.getMonth(); // 0-indexed
  const y = date.getFullYear();

  const fixedHolidays = [
    { d: 1, m: 0 },   // Capodanno
    { d: 6, m: 0 },   // Epifania
    { d: 25, m: 3 },  // Liberazione
    { d: 1, m: 4 },   // Lavoratori
    { d: 2, m: 5 },   // Repubblica
    { d: 15, m: 7 },  // Assunzione
    { d: 1, m: 10 },  // Tutti i Santi
    { d: 8, m: 11 },  // Immacolata
    { d: 25, m: 11 }, // Natale
    { d: 26, m: 11 }, // S. Stefano
  ];

  if (fixedHolidays.some(h => h.d === d && h.m === m)) return true;

  const easter = getEasterDate(y);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  if (date.getDate() === easterMonday.getDate() && date.getMonth() === easterMonday.getMonth()) return true;

  return false;
}
