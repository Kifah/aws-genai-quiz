import * as readline from 'readline';
import { loadQuestions, Question } from './loader';
import { DOMAINS } from './config';
import * as display from './display';
import { parseAnswer, answersCorrect } from './utils/answers';
import { readHistory, recordAttempts, newSessionId } from './store';
import {
  AttemptRecord,
  computeQuestionStats,
  rollUpByTopic,
  weakestGroups,
} from './history';
import { buildCandidates, sampleFocus } from './sampler';

/**
 * Focus Mode — adaptive review. Biases question selection toward weak spots
 * using accumulated attempt history, then runs the same reveal-after-each UX
 * as practice mode and records new attempts.
 *
 * @param seedWrongIds  optional question ids to prioritise (e.g. an exam's
 *                      missed questions). When provided, these are guaranteed
 *                      to appear first in the session.
 */
export async function runFocus(
  rl: readline.Interface,
  seedWrongIds: string[] = [],
): Promise<void> {
  display.clearScreen();
  display.printHeader('AIP-C01 Focus Mode · Adaptive Review');

  const allQuestions = loadQuestions();
  const history = readHistory();
  const qStats = computeQuestionStats(history);

  // Determine weak topics (include never-attempted so brand-new topics surface).
  const topicGroups = rollUpByTopic(allQuestions, qStats);
  const weakest = weakestGroups(topicGroups, 5, true);
  const weakTopicSet = new Set(weakest.map(g => g.key));

  // Pre-session summary.
  const neverAttempted = allQuestions.filter(q => !qStats.has(q.id)).length;
  const missedTwicePlus = [...qStats.values()].filter(s => s.times_wrong >= 2).length;

  console.log('');
  if (history.length === 0) {
    console.log(display.color(
      '  No attempt history yet — Focus Mode will start with a broad sample.\n' +
      '  Answer some Practice or Exam questions first for sharper targeting.\n',
      'yellow',
    ));
  }

  console.log(display.color('  Your weakest topics:', 'bold', 'yellow'));
  if (weakest.length === 0) {
    console.log(display.color('    (none yet — no history)', 'dim'));
  } else {
    for (const g of weakest) {
      const m = g.masteryScore === null
        ? display.color('never attempted', 'dim')
        : display.color(`${Math.round(g.masteryScore * 100)}% mastery`, g.masteryScore < 0.6 ? 'red' : 'green');
      console.log(`    • ${display.color(g.key, 'cyan')} — ${m} (${g.questionIds.length} qs)`);
    }
  }
  console.log('');
  console.log(`  Never-attempted questions: ${display.color(String(neverAttempted), 'bold')}`);
  console.log(`  Questions missed 2+ times:  ${display.color(String(missedTwicePlus), 'bold', missedTwicePlus > 0 ? 'red' : 'green')}`);
  console.log('');

  const countInput = await ask(rl, `  How many questions? (1-${allQuestions.length}, or Enter for 20): `);
  const count = Math.min(parseInt(countInput, 10) || 20, allQuestions.length);

  // Build weighted candidates and sample.
  const candidates = buildCandidates(allQuestions, qStats, weakTopicSet);
  let selected = sampleFocus(candidates, count);

  // If seeded with exam misses, hoist those to the front (deduped, capped).
  if (seedWrongIds.length > 0) {
    const seedSet = new Set(seedWrongIds);
    const seedQs = allQuestions.filter(q => seedSet.has(q.id));
    const rest = selected.filter(q => !seedSet.has(q.id));
    selected = [...seedQs, ...rest].slice(0, count);
  }

  if (selected.length === 0) {
    console.log(display.color('\n  No questions available.\n', 'red'));
    return;
  }

  const sessionId = newSessionId();
  const attempts: AttemptRecord[] = [];
  let correct  = 0;
  let answered = 0;

  for (let i = 0; i < selected.length; i++) {
    const q = selected[i];
    display.clearScreen();
    display.printHeader('Focus Mode · Adaptive Review');
    display.printQuestion(q, i + 1, selected.length);

    const answer = await ask(rl, '  Your answer: ');
    const parsed = parseAnswer(answer);

    if (parsed.length === 0) {
      console.log(display.color('  Skipped.\n', 'dim'));
    } else {
      answered++;
      const isCorrect = answersCorrect(parsed, q.correct_answers);
      attempts.push({
        question_id: q.id,
        timestamp:   new Date().toISOString(),
        was_correct: isCorrect,
        selected:    parsed,
        mode:        'focus',
        session_id:  sessionId,
      });
      if (isCorrect) {
        correct++;
        console.log(display.color('\n  ✓ Correct!\n', 'green', 'bold'));
        display.printCorrect(q);
      } else {
        console.log('');
        display.printWrong(q, parsed);
      }
    }

    const next = await ask(rl, '  Press Enter to continue (or "q" to quit): ');
    if (next.trim().toLowerCase() === 'q') break;
  }

  // Persist attempts → updates mastery for next time.
  recordAttempts(attempts);

  display.printScore(correct, answered || 1, 'practice');
  console.log(`  ${display.color('Focus session complete.', 'bold')} ${answered} answered, ${correct} correct.`);
  console.log(display.color('  Mastery scores updated — weak topics will resurface next time.\n', 'dim'));
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}
