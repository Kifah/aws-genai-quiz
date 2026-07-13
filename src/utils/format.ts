/**
 * Pure formatting utilities — no console output, no side effects.
 * All functions return strings; callers decide how to display them.
 */

type AnsiCode = keyof typeof ANSI;

const ANSI = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed:   '\x1b[41m',
} as const;

/**
 * Wrap text in one or more ANSI colour/style codes.
 * Unknown codes are silently ignored.
 */
export function color(text: string, ...codes: AnsiCode[]): string {
  return codes.map(c => ANSI[c] ?? '').join('') + text + ANSI.reset;
}

/**
 * Render an ASCII progress bar.
 * Returns a string like  [████░░░░░░]
 */
export function progressBar(value: number, total: number, width = 30): string {
  if (total === 0) return '[' + ' '.repeat(width) + ']';
  const filled = Math.round((value / total) * width);
  const empty  = width - filled;
  const bar    = color('█'.repeat(filled), 'green') + color('░'.repeat(empty), 'dim');
  return `[${bar}]`;
}

/**
 * Format a countdown in seconds as HH:MM:SS, coloured by urgency.
 *   < 5 min  → red
 *   < 15 min → yellow
 *   otherwise → green
 */
export function formatTimer(remaining: number): string {
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const col: AnsiCode = remaining < 300 ? 'red' : remaining < 900 ? 'yellow' : 'green';
  return color(`⏱  ${label}`, col, 'bold');
}

/**
 * Word-wrap `text` to at most `maxLen` characters per line.
 */
export function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > maxLen) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
