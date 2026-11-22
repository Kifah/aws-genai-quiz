# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack & Commands
TypeScript (strict, CommonJS, ES2020), Node ≥ 18, run via `tsx` (no compile step). Tests use `node:test` + `node:assert/strict`. There is no linter/formatter config.
```
npm test                   # runs ONLY the files hard-listed in package.json "test" script
npm run validate           # validates questions/aws AND questions/claude
npx tsc --noEmit           # typecheck (tsconfig includes src/ only, not tests/)
npm run practice|exam|focus|stats   # modes; add `-- --exam aws|claude` to skip the exam menu
node --test --require tsx/cjs tests/loader.test.ts   # single test file
```
- **A new `tests/*.test.ts` file is NOT picked up by `npm test`** until you add it to the explicit file list in `package.json`.

## Multi-exam layout
- Two exams: `aws` (AIP-C01) and `claude` (CCAR-P), registered in `src/exams.ts` (`EXAMS`). AWS domains/exam config live in `src/config.ts`; Claude's are inline in `exams.ts`. Domain weights per exam must sum to 1.0 (consumed by `sampleProportional` in `src/loader.ts`).
- Adding an exam requires touching `src/exams.ts`, the hard-coded menu in `src/app.ts`, and the hard-coded dir list in `src/validate.ts`.
- Mode runners resolve questions via `path.join(__dirname, '..', exam.questionsDir)`; `loadQuestions(dir)` itself takes a dir argument and does not use `cwd`/`__dirname`.
- Every `AttemptRecord` in `.quiz-history.json` carries `exam_id`; read with `readHistoryForExam(exam.exam_id)`. `migrateHistory()` back-fills `exam_id: 'aws'` on legacy records.

## Question Bank
- Files: `questions/<exam>/domain-N[-task-X.Y.Z].json`, each a JSON **array** (`FILE_PATTERN` in `src/validator.ts`).
- IDs: AWS `dN-qNNNN`, Claude `cN-qNNNN`; must be unique across both banks. Wrong prefix is only a validator *warning*; a duplicate is an error. IDs are referenced by history — never rename/remove existing ones.
- `options` ≥ 4; `single` → exactly 1 correct answer; `multi` → ≥ 2.
- Run `npm run validate` after any question edit.

## Priority questions (seminar bank)
- Optional `priority` field (integer 1-5, default 1). A question with `priority > 1` that has **no attempt in history** is served before all others in practice, exam (within each domain's quota) and focus. Once attempted, it falls back to normal selection. Helpers live in `src/loader.ts` (`priorityOf`, `pendingPriority`, `prioritizeFirst`).
- The 126 trusted seminar questions are `questions/aws/domain-N-seminar.json` (IDs `dN-q09xx`, `priority: 5`, `source: "seminar"`, `seminar_id`). Question text, options and correct answers are verbatim from `questions/sources/aws-aip-c01-seminar.json` (enforced by `tests/priority.test.ts`); only `domain`, `task_statement`, `topic`, `difficulty` and `explanation` were added. Do not edit the verbatim fields.
- `FILE_PATTERN` / loader accept `domain-N-seminar.json` in addition to `domain-N[-task-X.Y.Z].json`.

## Architecture rules
- Pure modules (no I/O, no `console`, no `process.exit`): `history.ts`, `validator.ts`, `sampler.ts`, `utils/*`. I/O only in `store.ts` (history file), `display.ts` (console), mode runners, and CLI wrappers (`validate.ts`, `app.ts`).
- `Question` type is defined in `src/loader.ts`; import it from there.
- `masteryScore` is `null` (never attempted), not `0` — treat as maximally weak, never conflate with 0. Mastery decay constant `DECAY = 0.6` lives only in `history.ts`.
- `sampleFocus` caps the 'correct' bucket at `REINFORCE_FRACTION = 0.12`; preserve it in any sampling change.

## Code style
- Match the existing vertical alignment of `=`, `:` and `import … from` columns in the block you edit.
- Imports: Node stdlib (`import * as fs from 'fs'`) first, then local relative modules.
- JSON writes: `JSON.stringify(x, null, 2) + '\n'` (trailing newline).
- Tests: never `Math.random` — use `seededRng(seed)` from `src/sampler.ts` (note `shuffle`/`sampleProportional` in `loader.ts` still use `Math.random`, so assert only on sizes/membership). Define local `q()`/`stat()`/`attempt()` factories per test file; no shared fixtures module.
