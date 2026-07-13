/**
 * Console output module — all terminal rendering lives here.
 * Pure formatting helpers (color, progressBar, etc.) are in utils/format.ts.
 */

import { DOMAINS } from './config';
import { color, progressBar, formatTimer, wrapText } from './utils/format';
import { Question } from './loader';

export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[0f');
}

export function printHeader(title: string): void {
  const line = '═'.repeat(72);
  console.log(color(line, 'cyan'));
  console.log(color(`  ${title}`, 'bold', 'cyan'));
  console.log(color(line, 'cyan'));
}

/**
 * @param index     1-based position within the current session
 * @param showDomain  hide domain/task info in exam mode to mimic the real exam
 */
export function printQuestion(
  question: Question,
  index: number,
  total: number,
  showDomain = true,
): void {
  console.log('');
  if (showDomain) {
    const domainName = DOMAINS[question.domain]?.name ?? `Domain ${question.domain}`;
    console.log(color(`  Domain ${question.domain}: ${domainName}`, 'dim'));
    console.log(color(`  Task ${question.task_statement} · ${question.topic}`, 'dim'));
  }

  const multiLabel = question.question_type === 'multi'
    ? color('[MULTI-SELECT] ', 'yellow')
    : '';
  console.log(
    color(`  [${index}/${total}]`, 'dim') + ' ' + multiLabel + color(question.question_text, 'bold'),
  );
  console.log('');

  for (const opt of question.options) {
    console.log(`    ${color(opt.key + '.', 'cyan')} ${opt.text}`);
  }

  if (question.question_type === 'multi') {
    console.log('');
    console.log(color(
      `  (Select ${question.correct_answers.length} answers — enter letters separated by space or comma, e.g. "A C")`,
      'yellow',
    ));
  }
  console.log('');
}

/** Print the correct answer(s) and explanation after a question is answered. */
export function printCorrect(question: Question): void {
  const keys  = question.correct_answers.join(', ');
  const texts = question.correct_answers
    .map(k => question.options.find(o => o.key === k)?.text)
    .filter(Boolean)
    .join(' / ');

  console.log(color('  ✓ Correct: ', 'green', 'bold') + color(keys, 'green') + color(` — ${texts}`, 'green'));
  console.log('');
  console.log(color('  Explanation:', 'yellow', 'bold'));
  for (const line of wrapText(question.explanation, 68)) {
    console.log('    ' + line);
  }
  console.log('');
}

/** Print feedback for a wrong answer. */
export function printWrong(question: Question, userAnswers: string[]): void {
  const userKeys    = userAnswers.join(', ');
  const correctKeys = question.correct_answers.join(', ');
  console.log(color(`  ✗ Your answer: ${userKeys}`, 'red', 'bold'));
  console.log(color(`  ✓ Correct:     ${correctKeys}`, 'green'));
  console.log('');
  console.log(color('  Explanation:', 'yellow', 'bold'));
  for (const line of wrapText(question.explanation, 68)) {
    console.log('    ' + line);
  }
  console.log('');
}

/** Print overall score bar. */
export function printScore(correct: number, total: number, mode: 'practice' | 'exam' = 'practice'): void {
  const pct  = total > 0 ? Math.round((correct / total) * 100) : 0;
  const pass = pct >= 75;
  const bar  = progressBar(correct, total, 40);

  console.log('');
  printHeader('Results');
  console.log('');
  console.log(`  Score: ${color(`${correct}/${total}`, 'bold')} (${color(`${pct}%`, pass ? 'green' : 'red', 'bold')})`);
  console.log('  ' + bar);

  if (mode === 'exam') {
    const verdict = pass
      ? color(' PASS ', 'bgGreen', 'bold')
      : color(' FAIL ', 'bgRed', 'bold');
    console.log('');
    console.log(`  Verdict: ${verdict}`);
    console.log(color('  (Pass threshold: 75% · scaled 750/1000)', 'dim'));
  }
  console.log('');
}

export interface DomainStat {
  correct: number;
  total: number;
  questions: Array<{ q: Question; userAnswer: string[] | null }>;
}

/** Print per-domain breakdown table after an exam. */
export function printDomainBreakdown(domainStats: Record<number, DomainStat>): void {
  console.log(color('  Per-Domain Breakdown:', 'bold', 'yellow'));
  console.log('  ' + '─'.repeat(68));
  for (const [domainNum, stats] of Object.entries(domainStats)) {
    const name = DOMAINS[Number(domainNum)]?.name ?? `Domain ${domainNum}`;
    const pct  = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const bar  = progressBar(stats.correct, stats.total, 20);
    const indicator = pct >= 75 ? color('✓', 'green') : color('✗', 'red');
    console.log(`  ${indicator} D${domainNum}: ${color(name, 'cyan')}`);
    console.log(`     ${bar} ${color(`${stats.correct}/${stats.total}`, 'bold')} (${pct}%)`);
  }
  console.log('');
}

/**
 * Return a coloured HH:MM:SS timer string.
 * Thin wrapper around formatTimer so callers don't need to import utils/format.
 */
export function printTimer(remaining: number): string {
  return formatTimer(remaining);
}

// Re-export color so callers can do display.color(...) without importing utils/format.
export { color };
