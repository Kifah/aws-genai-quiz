#!/usr/bin/env ts-node
import * as readline from 'readline';
import { runPractice } from './practice';
import { runExam }     from './exam';
import { runFocus }    from './focus';
import { runStats }    from './stats';
import * as display    from './display';
import { EXAMS, ExamDefinition } from './exams';
import { migrateHistory }        from './store';

const rl = readline.createInterface({
  input:    process.stdin,
  output:   process.stdout,
  terminal: process.stdin.isTTY,
});

async function main(): Promise<void> {
  migrateHistory();

  const args      = process.argv.slice(2);

  // ── Exam flag ──────────────────────────────────────────────────────────────
  const examFlag  = args.find(a => a.startsWith('--exam=') || a === '--exam');
  let examId: string | null = null;

  if (examFlag === '--exam') {
    examId = args[args.indexOf('--exam') + 1] ?? null;
  } else if (examFlag) {
    examId = examFlag.split('=')[1] ?? null;
  }

  let exam: ExamDefinition;

  if (examId !== null) {
    if (!EXAMS[examId]) {
      console.error(display.color(`\nUnknown exam: "${examId}". Use --exam aws | claude\n`, 'red'));
      process.exit(1);
    }
    exam = EXAMS[examId];
  } else {
    display.clearScreen();
    display.printHeader('AWS Generative AI Quiz');
    console.log('');
    console.log(display.color('  Select an exam:', 'bold'));
    console.log('  ' + display.color('1', 'cyan') + ' = AWS AIP-C01   (Certified Generative AI Developer – Professional)');
    console.log('  ' + display.color('2', 'cyan') + ' = Claude CCAR-P (Certified Architect – Professional)');
    console.log('');

    await new Promise<void>(resolve => {
      rl.question('  Enter 1-2: ', answer => {
        const choice = answer.trim();
        if (choice === '1') {
          exam = EXAMS['aws'];
        } else if (choice === '2') {
          exam = EXAMS['claude'];
        } else {
          console.log(display.color('  Invalid choice. Defaulting to AWS.\n', 'yellow'));
          exam = EXAMS['aws'];
        }
        resolve();
      });
    });
  }

  // ── Mode flag ──────────────────────────────────────────────────────────────
  const modeFlag  = args.find(a => a.startsWith('--mode=') || a === '--mode');
  let mode: string | null = null;

  if (modeFlag === '--mode') {
    mode = args[args.indexOf('--mode') + 1] ?? null;
  } else if (modeFlag) {
    mode = modeFlag.split('=')[1] ?? null;
  }

  if (!mode) {
    display.clearScreen();
    display.printHeader(`${exam!.shortName} ${exam!.displayName}`);
    console.log('');
    console.log('  Select a mode:');
    console.log('  ' + display.color('1', 'cyan') + ' = Practice Mode  (study with immediate feedback)');
    console.log('  ' + display.color('2', 'cyan') + ' = Exam Mode      (simulate the real exam, timed)');
    console.log('  ' + display.color('3', 'cyan') + ' = Focus Mode     (adaptive review of your weak spots)');
    console.log('  ' + display.color('4', 'cyan') + ' = Stats          (view your progress and weak topics)');
    console.log('');

    await new Promise<void>(resolve => {
      rl.question('  Enter 1-4: ', answer => {
        const choice = answer.trim();
        if (choice === '1')      mode = 'practice';
        else if (choice === '2') mode = 'exam';
        else if (choice === '3') mode = 'focus';
        else if (choice === '4') mode = 'stats';
        else {
          console.log(display.color('  Invalid choice. Defaulting to practice mode.\n', 'yellow'));
          mode = 'practice';
        }
        resolve();
      });
    });
  }

  if (mode === 'practice') {
    await runPractice(rl, exam!);
  } else if (mode === 'exam') {
    await runExam(rl, exam!);
  } else if (mode === 'focus') {
    await runFocus(rl, exam!);
  } else if (mode === 'stats') {
    await runStats(rl, exam!);
  } else {
    console.error(display.color(`\nUnknown mode: "${mode}". Use --mode practice | exam | focus | stats\n`, 'red'));
    process.exit(1);
  }

  rl.close();
}

main().catch(err => {
  console.error(display.color('\nFatal error: ' + (err as Error).message, 'red'));
  process.exit(1);
});
