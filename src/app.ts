#!/usr/bin/env ts-node
import * as readline from 'readline';
import { runPractice } from './practice';
import { runExam }     from './exam';
import { runFocus }    from './focus';
import { runStats }    from './stats';
import * as display    from './display';

const rl = readline.createInterface({
  input:    process.stdin,
  output:   process.stdout,
  terminal: process.stdin.isTTY,
});

async function main(): Promise<void> {
  const args      = process.argv.slice(2);
  const modeFlag  = args.find(a => a.startsWith('--mode=') || a === '--mode');
  let mode: string | null = null;

  if (modeFlag === '--mode') {
    mode = args[args.indexOf('--mode') + 1] ?? null;
  } else if (modeFlag) {
    mode = modeFlag.split('=')[1] ?? null;
  }

  if (!mode) {
    display.clearScreen();
    display.printHeader('AIP-C01 AWS Certified Generative AI Developer - Professional');
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
    await runPractice(rl);
  } else if (mode === 'exam') {
    await runExam(rl);
  } else if (mode === 'focus') {
    await runFocus(rl);
  } else if (mode === 'stats') {
    await runStats(rl);
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
