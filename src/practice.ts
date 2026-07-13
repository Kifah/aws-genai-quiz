import * as readline from 'readline';
import { loadQuestions, shuffle } from './loader';
import { DOMAINS } from './config';
import * as display from './display';
import { parseAnswer, answersCorrect } from './utils/answers';

export async function runPractice(rl: readline.Interface): Promise<void> {
  display.clearScreen();
  display.printHeader('AIP-C01 Practice Mode');

  // Domain selection
  console.log('\n  Select domains to practice:');
  console.log('  ' + display.color('0', 'cyan') + ' = All domains');
  for (const [num, d] of Object.entries(DOMAINS)) {
    console.log(`  ${display.color(num, 'cyan')} = Domain ${num}: ${d.name} (${Math.round(d.weight * 100)}%)`);
  }
  console.log('');

  const domainInput = await ask(rl, '  Enter domain numbers (e.g. "1 3") or 0 for all: ');
  let domainFilter: number[] | null = null;
  if (domainInput.trim() !== '0' && domainInput.trim() !== '') {
    domainFilter = domainInput.split(/[\s,]+/).map(Number).filter(n => n >= 1 && n <= 5);
    if (domainFilter.length === 0) domainFilter = null;
  }

  const allQuestions = loadQuestions(domainFilter);
  if (allQuestions.length === 0) {
    console.log(display.color('\n  No questions found for selected domains.\n', 'red'));
    rl.close();
    return;
  }

  const countInput = await ask(rl, `  How many questions? (1-${allQuestions.length}, or press Enter for 20): `);
  const count = Math.min(parseInt(countInput, 10) || 20, allQuestions.length);

  const selected = shuffle(allQuestions.slice()).slice(0, count);

  let correct  = 0;
  let answered = 0;

  for (let i = 0; i < selected.length; i++) {
    const q = selected[i];
    display.clearScreen();
    display.printHeader('Practice Mode');
    display.printQuestion(q, i + 1, selected.length);

    const answer = await ask(rl, '  Your answer: ');
    const parsed = parseAnswer(answer);

    if (parsed.length === 0) {
      console.log(display.color('  Skipped.\n', 'dim'));
    } else {
      answered++;
      const isCorrect = answersCorrect(parsed, q.correct_answers);
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

  display.printScore(correct, answered || 1, 'practice');
  console.log(`  ${display.color('Session complete.', 'bold')} ${answered} answered, ${correct} correct.\n`);
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}
