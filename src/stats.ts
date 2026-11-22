import * as path     from 'path';
import * as readline from 'readline';
import { loadQuestions, priorityOf, DEFAULT_PRIORITY } from './loader';
import { ExamDefinition } from './exams';
import * as display from './display';
import { color, progressBar } from './utils/format';
import { readHistoryForExam, historyPath } from './store';
import {
  computeQuestionStats,
  rollUpByDomain,
  rollUpByTopic,
  weakestGroups,
} from './history';

export async function runStats(rl: readline.Interface, exam: ExamDefinition): Promise<void> {
  display.clearScreen();
  display.printHeader(exam.shortName + ' Progress & Statistics');

  const allQuestions = loadQuestions(path.join(__dirname, '..', exam.questionsDir));
  const history = readHistoryForExam(exam.exam_id);

  if (history.length === 0) {
    console.log(color(
      '\n  No attempt history yet.\n' +
      '  Complete some Practice, Exam, or Focus sessions to build your stats.\n',
      'yellow',
    ));
    console.log(color(`  (History will be saved to ${historyPath()})\n`, 'dim'));
    return;
  }

  const qStats = computeQuestionStats(history);

  const totalAttempts = history.length;
  const totalCorrect = history.filter(a => a.was_correct).length;
  const overallPct = Math.round((totalCorrect / totalAttempts) * 100);

  console.log('');
  console.log(`  Total attempts recorded: ${color(String(totalAttempts), 'bold')}`);
  console.log(`  Overall accuracy: ${color(`${totalCorrect}/${totalAttempts}`, 'bold')} (${color(`${overallPct}%`, overallPct >= 75 ? 'green' : 'red', 'bold')})`);
  console.log('  ' + progressBar(totalCorrect, totalAttempts, 40));
  console.log('');

  renderTrend(history);
  renderDomainAccuracy(allQuestions, qStats, exam);
  renderWeakestTopics(allQuestions, qStats);

  const priorityQs = allQuestions.filter(q => priorityOf(q) > DEFAULT_PRIORITY);
  if (priorityQs.length > 0) {
    const covered = priorityQs.filter(q => qStats.has(q.id)).length;
    console.log(`  ${color('★ Priority questions covered:', 'bold', 'yellow')} ${color(`${covered}/${priorityQs.length}`, 'bold')}`);
    console.log('  ' + progressBar(covered, priorityQs.length, 40));
  }
  const neverAttempted = allQuestions.filter(q => !qStats.has(q.id)).length;
  console.log(`  Never-attempted questions: ${color(String(neverAttempted), 'bold')} of ${allQuestions.length}`);
  console.log(color(`\n  History file: ${historyPath()}\n`, 'dim'));
}

function renderTrend(history: ReturnType<typeof readHistoryForExam>): void {
  const chrono = [...history].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const half = Math.floor(chrono.length / 2);
  if (half === 0) return;
  const firstHalf = chrono.slice(0, half);
  const secondHalf = chrono.slice(half);
  const pct = (arr: typeof chrono): number =>
    Math.round((arr.filter(a => a.was_correct).length / arr.length) * 100);
  const early = pct(firstHalf);
  const recent = pct(secondHalf);
  const arrow = recent > early ? color('▲ improving', 'green')
    : recent < early ? color('▼ declining', 'red')
    : color('▬ steady', 'dim');
  console.log(color('  Accuracy trend:', 'bold', 'yellow'));
  console.log(`    Earlier half: ${early}%   Recent half: ${recent}%   ${arrow}`);
  console.log('');
}

function renderDomainAccuracy(
  allQuestions: ReturnType<typeof loadQuestions>,
  qStats: ReturnType<typeof computeQuestionStats>,
  exam: ExamDefinition,
): void {
  const byDomain = rollUpByDomain(allQuestions, qStats);
  const domainKeys = Object.keys(exam.domains).map(Number);
  console.log(color('  Per-domain accuracy:', 'bold', 'yellow'));
  for (const d of domainKeys) {
    const g = byDomain.get(String(d));
    const name = exam.domains[d]?.name ?? `Domain ${d}`;
    if (!g || g.times_seen === 0) {
      console.log(`    D${d} ${color(name, 'cyan')}: ${color('no attempts', 'dim')}`);
      continue;
    }
    const pct = Math.round((g.accuracy ?? 0) * 100);
    const bar = progressBar(g.times_correct, g.times_seen, 20);
    const mark = pct >= 75 ? color('✓', 'green') : color('✗', 'red');
    console.log(`    ${mark} D${d} ${color(name, 'cyan')}`);
    console.log(`       ${bar} ${g.times_correct}/${g.times_seen} (${pct}%)`);
  }
  console.log('');
}

function renderWeakestTopics(
  allQuestions: ReturnType<typeof loadQuestions>,
  qStats: ReturnType<typeof computeQuestionStats>,
): void {
  const topics = rollUpByTopic(allQuestions, qStats);
  const weakest = weakestGroups(topics, 5, false);
  console.log(color('  Top 5 weakest topics (attempted):', 'bold', 'yellow'));
  if (weakest.length === 0) {
    console.log(color('    (not enough attempts yet)', 'dim'));
  } else {
    for (const g of weakest) {
      const pct = g.masteryScore === null ? 0 : Math.round(g.masteryScore * 100);
      const col = pct < 60 ? 'red' : pct < 80 ? 'yellow' : 'green';
      console.log(`    • ${color(g.key, 'cyan')} — ${color(`${pct}% mastery`, col)} (${g.times_correct}/${g.times_seen} correct)`);
    }
  }
  console.log('');
}
