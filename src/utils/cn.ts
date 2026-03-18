import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility per unire classi Tailwind in modo sicuro, risolvendo i conflitti.
 * Implementa il pattern raccomandato per la gestione delle classi condizionali.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
