#!/usr/bin/env ts-node
import * as readline from 'readline';
import { runPractice } from './practice';
import { runExam }     from './exam';
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
    console.log('');

    await new Promise<void>(resolve => {
      rl.question('  Enter 1 or 2: ', answer => {
        if (answer.trim() === '1')      mode = 'practice';
        else if (answer.trim() === '2') mode = 'exam';
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
  } else {
    console.error(display.color(`\nUnknown mode: "${mode}". Use --mode practice or --mode exam\n`, 'red'));
    process.exit(1);
  }

  rl.close();
}

main().catch(err => {
  console.error(display.color('\nFatal error: ' + (err as Error).message, 'red'));
  process.exit(1);
});
