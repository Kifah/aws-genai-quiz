import * as readline from 'readline';
import { loadQuestions, sampleProportional, Question } from './loader';
import { DOMAINS, EXAM_CONFIG } from './config';
import * as display from './display';
import { DomainStat } from './display';
import { parseAnswer, answersCorrect } from './utils/answers';

export async function runExam(rl: readline.Interface): Promise<void> {
  display.clearScreen();
  display.printHeader('AIP-C01 Exam Simulation Mode');

  console.log(`\n  ${display.color('Exam Rules:', 'bold', 'yellow')}`);
  console.log(`  • ${EXAM_CONFIG.totalScoredQuestions} questions, ${EXAM_CONFIG.durationMinutes} minutes`);
  console.log(`  • No answer reveal until the exam ends`);
  console.log(`  • Pass = ${Math.round(EXAM_CONFIG.passingThreshold * 100)}%+ correct (scaled 750/1000)`);
  console.log(`  • Questions sampled proportionally by domain weight\n`);

  const durationInput = await ask(
    rl,
    `  Timer in minutes? (Enter for ${EXAM_CONFIG.durationMinutes} min, or e.g. "60" for quick run): `,
  );
  const durationMin = parseInt(durationInput, 10) || EXAM_CONFIG.durationMinutes;

  const allQuestions = loadQuestions();
  if (allQuestions.length < EXAM_CONFIG.totalScoredQuestions) {
    console.log(display.color(
      `\n  Warning: only ${allQuestions.length} questions in the pool (need ${EXAM_CONFIG.totalScoredQuestions}). Using all available.\n`,
      'yellow',
    ));
  }

  const examQuestions = sampleProportional(
    allQuestions,
    Math.min(EXAM_CONFIG.totalScoredQuestions, allQuestions.length),
    DOMAINS,
  );

  const userAnswers: (string[] | null)[] = new Array(examQuestions.length).fill(null);
  const startTime = Date.now();

  // Tick the remaining-seconds counter once per second.
  let remainingSeconds = durationMin * 60;
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    remainingSeconds = Math.max(0, durationMin * 60 - elapsed);
    if (remainingSeconds === 0) clearInterval(timerInterval);
  }, 1000);

  let currentIndex = 0;
  let forceEnd     = false;

  while (currentIndex < examQuestions.length && !forceEnd) {
    if (remainingSeconds <= 0) {
      console.log(display.color('\n  ⏱ Time is up! Ending exam.\n', 'red', 'bold'));
      forceEnd = true;
      break;
    }

    const q = examQuestions[currentIndex];
    display.clearScreen();
    display.printHeader('Exam Mode · ' + display.printTimer(remainingSeconds));

    // Hide domain info in exam mode to match the real exam experience.
    display.printQuestion(q, currentIndex + 1, examQuestions.length, false);

    console.log(display.color(
      '  Commands: answer (e.g. "A"), "s" to skip, "r" to review/jump, "end" to end exam early',
      'dim',
    ));
    const input = await ask(rl, '  Answer: ');

    if (input.trim().toLowerCase() === 'end') {
      const confirm = await ask(rl, display.color('  End exam now? All unanswered = incorrect. (y/n): ', 'yellow'));
      if (confirm.trim().toLowerCase() === 'y') { forceEnd = true; break; }
    } else if (input.trim().toLowerCase() === 's') {
      currentIndex++;
    } else if (input.trim().toLowerCase() === 'r') {
      const jumpInput = await ask(rl, `  Jump to question # (1-${examQuestions.length}): `);
      const jumpTo = parseInt(jumpInput, 10);
      if (jumpTo >= 1 && jumpTo <= examQuestions.length) {
        currentIndex = jumpTo - 1;
      }
    } else {
      const parsed = parseAnswer(input);
      if (parsed.length > 0) {
        userAnswers[currentIndex] = parsed;
        currentIndex++;
      } else {
        console.log(display.color('  Invalid input. Try again.\n', 'red'));
        await new Promise<void>(r => setTimeout(r, 800));
      }
    }
  }

  clearInterval(timerInterval);

  // ── Score ──────────────────────────────────────────────────────────────────

  const domainStats: Record<number, DomainStat> = {};
  for (let d = 1; d <= 5; d++) {
    domainStats[d] = { correct: 0, total: 0, questions: [] };
  }

  let totalCorrect = 0;
  const reviewItems: Array<{ q: Question; userAnswer: string[] | null; correct: boolean }> = [];

  for (let i = 0; i < examQuestions.length; i++) {
    const q  = examQuestions[i];
    const ua = userAnswers[i];
    const d  = q.domain;
    domainStats[d].total++;
    domainStats[d].questions.push({ q, userAnswer: ua });

    const isCorrect = ua !== null && answersCorrect(ua, q.correct_answers);
    if (isCorrect) {
      totalCorrect++;
      domainStats[d].correct++;
    }
    reviewItems.push({ q, userAnswer: ua, correct: isCorrect });
  }

  // ── Results ────────────────────────────────────────────────────────────────

  display.clearScreen();
  display.printScore(totalCorrect, examQuestions.length, 'exam');
  display.printDomainBreakdown(domainStats);

  const showReview = await ask(rl, '  Would you like to review answers with explanations? (y/n): ');
  if (showReview.trim().toLowerCase() === 'y') {
    for (let i = 0; i < reviewItems.length; i++) {
      const { q, userAnswer, correct } = reviewItems[i];
      display.clearScreen();
      display.printHeader(`Review: Question ${i + 1}/${reviewItems.length}`);
      display.printQuestion(q, i + 1, reviewItems.length);

      if (correct) {
        console.log(display.color('\n  ✓ You answered correctly!\n', 'green', 'bold'));
        display.printCorrect(q);
      } else if (userAnswer) {
        display.printWrong(q, userAnswer);
      } else {
        console.log(display.color('  (Not answered)\n', 'dim'));
        display.printCorrect(q);
      }

      const next = await ask(rl, '  Press Enter to continue (or "q" to exit review): ');
      if (next.trim().toLowerCase() === 'q') break;
    }
  }

  console.log(display.color('\n  Exam complete. Good luck with the real thing!\n', 'bold'));
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}
