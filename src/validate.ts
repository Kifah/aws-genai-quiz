#!/usr/bin/env ts-node
/**
 * CLI entry-point for question-bank validation.
 * All validation logic lives in ./validator.ts (pure library).
 * Validates both exam banks: questions/aws/ and questions/claude/
 */

import * as path from 'path';
import { validateAll } from './validator';

const EXAM_DIRS: Array<{ label: string; dir: string }> = [
  { label: 'AWS (AIP-C01)',    dir: path.join(__dirname, '..', 'questions', 'aws')    },
  { label: 'Claude (CCAR-P)',  dir: path.join(__dirname, '..', 'questions', 'claude') },
];

const E = '\x1b[31m';   // red
const W = '\x1b[33m';   // yellow
const G = '\x1b[32m';   // green
const B = '\x1b[1m';    // bold
const C = '\x1b[36m';   // cyan
const R = '\x1b[0m';    // reset

let combinedErrors   = 0;
let combinedWarnings = 0;
let combinedQuestions = 0;

for (const { label, dir } of EXAM_DIRS) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${B}${C}${label}${R}`);
  console.log('═'.repeat(60));

  const { fileResults, totalQuestions, domainCounts, totalErrors, totalWarnings }
    = validateAll(dir);

  if (fileResults.length === 0) {
    console.error(`${E}No question files found in ${dir}${R}`);
    combinedErrors += 1;
    continue;
  }

  // ── Per-file report ─────────────────────────────────────────────────────────

  for (const { filename, errors, warnings, count } of fileResults) {
    console.log(`\n${B}${C}Validating ${filename}...${R}`);
    for (const msg of errors)   console.error(`${E}  ✗ ${msg}${R}`);
    for (const msg of warnings) console.warn(`${W}  ⚠ ${msg}${R}`);
    if (errors.length === 0) {
      console.log(`${G}  ✓ ${filename}: ${count} questions — all valid${R}`);
    } else {
      console.error(`${E}  ✗ ${filename}: ${errors.length} error(s) found${R}`);
    }
  }

  // ── Per-exam summary ────────────────────────────────────────────────────────

  console.log(`\n${B}${label} Summary${R}`);
  console.log(`Total questions: ${totalQuestions}`);
  for (const [d, count] of Object.entries(domainCounts).sort()) {
    console.log(`  Domain ${d}: ${count} questions`);
  }
  console.log(`Errors:   ${totalErrors   > 0 ? E + totalErrors   + R : G + '0' + R}`);
  console.log(`Warnings: ${totalWarnings > 0 ? W + totalWarnings + R : G + '0' + R}`);

  combinedErrors   += totalErrors;
  combinedWarnings += totalWarnings;
  combinedQuestions += totalQuestions;
}

// ── Combined summary ──────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log(`${B}Combined Summary — All Exam Banks${R}`);
console.log('═'.repeat(60));
console.log(`Total questions: ${combinedQuestions}`);
console.log(`Errors:   ${combinedErrors   > 0 ? E + combinedErrors   + R : G + '0' + R}`);
console.log(`Warnings: ${combinedWarnings > 0 ? W + combinedWarnings + R : G + '0' + R}`);

if (combinedErrors > 0) {
  console.error(`\n${E}✗ Validation FAILED${R}\n`);
  process.exit(1);
} else {
  console.log(`\n${G}✓ All questions valid${R}\n`);
}
