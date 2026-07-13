#!/usr/bin/env ts-node
/**
 * CLI entry-point for question-bank validation.
 * All validation logic lives in ./validator.ts (pure library).
 */

import * as path from 'path';
import { validateAll } from './validator';

const QUESTIONS_DIR = path.join(__dirname, '..', 'questions');

const E = '\x1b[31m';   // red
const W = '\x1b[33m';   // yellow
const G = '\x1b[32m';   // green
const B = '\x1b[1m';    // bold
const C = '\x1b[36m';   // cyan
const R = '\x1b[0m';    // reset

const { fileResults, totalQuestions, domainCounts, totalErrors, totalWarnings }
  = validateAll(QUESTIONS_DIR);

if (fileResults.length === 0) {
  console.error(`${E}No question files found in ./questions/${R}`);
  process.exit(1);
}

// ── Per-file report ───────────────────────────────────────────────────────────

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

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log(`${B}Validation Summary${R}`);
console.log('═'.repeat(60));
console.log(`Total questions: ${totalQuestions}`);

for (const [d, count] of Object.entries(domainCounts).sort()) {
  console.log(`  Domain ${d}: ${count} questions`);
}

console.log(`\nErrors:   ${totalErrors   > 0 ? E + totalErrors   + R : G + '0' + R}`);
console.log(`Warnings: ${totalWarnings > 0 ? W + totalWarnings + R : G + '0' + R}`);

if (totalErrors > 0) {
  console.error(`\n${E}✗ Validation FAILED${R}\n`);
  process.exit(1);
} else {
  console.log(`\n${G}✓ All questions valid${R}\n`);
}
