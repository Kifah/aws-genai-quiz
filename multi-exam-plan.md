# Multi-Exam Refactor Plan: AWS + CCAR-P Claude Certification

## Overview

Extend the quiz app to support two independent exam subjects — the existing **AWS AIP-C01** and the new **CCAR-P Claude Certified Architect – Professional**. At startup the user picks a subject; that selection scopes all subsequent mode selection, question loading, history, and statistics. All existing modes (practice / exam / focus / stats) remain fully functional for both exams.

**Key decisions:**
- Question files for Claude live in `questions/claude/` (mirroring AWS structure under `questions/aws/`)
- A new `src/exams.ts` registry holds per-exam config (domains, weights, question dir, exam rules)
- `AttemptRecord` gains an `exam_id` field; the old `.quiz-history.json` is renamed to `.quiz-history.aws.json` as a one-time migration
- All mode runners receive an `ExamDefinition` parameter instead of hardcoded globals
- History store filters by `exam_id` so stats/focus never mix exams

---

## CCAR-P Exam Facts (from official exam guide)

| Field | Value |
|---|---|
| Exam code | CCAR-P |
| Items | 63 (multiple-choice + multiple-response) |
| Time limit | 120 minutes |
| Passing score | 720 / 1000 |
| Scale | 100–1000 |

**Domains & weights:**
| # | Domain | Weight |
|---|---|---|
| 1 | Solution Design & Architecture | 17% |
| 2 | Claude Models, Prompting & Context Engineering | 13% |
| 3 | Integration | 19% |
| 4 | Evaluation, Testing & Optimization | 16% |
| 5 | Governance, Safety & Risk Management | 14% |
| 6 | Stakeholder Communication & Lifecycle Management | 14% |
| 7 | Developer Productivity & Operational Enablement | 7% |

---

## Sub-Tasks

---

### Sub-Task 1 — Reorganise AWS question files
**Status:** [x] done

**Intent:** Move all existing `questions/domain-*.json` files into `questions/aws/` so the loader can distinguish exam-scoped question directories.

**Expected Outcomes:**
- `questions/aws/` contains all current question JSON files
- `questions/claude/` directory exists (empty, ready for Sub-Task 3)
- `questions/` root is otherwise empty
- `npm run validate` still passes after the move (validator path updated)
- `npm test` still passes

**Todo List:**
1. Create `questions/aws/` and `questions/claude/` directories
2. Move all `questions/domain-*.json` files into `questions/aws/`
3. Update `src/loader.ts` — remove the hardcoded `QUESTIONS_DIR` constant; instead accept a `questionsDir: string` parameter in `loadQuestions()` and `sampleProportional()` (no other logic changes)
4. Update `src/validate.ts` — pass the correct directory path when calling the validator
5. Update `tests/loader.test.ts` — update the `process.chdir` and any path references
6. Run `npm test` and `npm run validate` to confirm all green

**Relevant Context:**
- `src/loader.ts` line 5: `const QUESTIONS_DIR = path.join(__dirname, '..', 'questions')`
- `src/validate.ts` calls `validateAll(questionsDir)` — update path to `questions/aws`
- `tests/loader.test.ts` line 6: `process.chdir(path.join(__dirname, '..'))` — still correct since tests now need to pass the aws dir explicitly

---

### Sub-Task 2 — Create exam registry (`src/exams.ts`)
**Status:** [x] done

**Intent:** Centralise all per-exam configuration (domains, weights, exam rules, question directory, display name, exam_id) so mode runners never import hardcoded AWS constants directly.

**Expected Outcomes:**
- New file `src/exams.ts` exports `ExamDefinition` interface and `EXAMS` registry
- AWS exam definition wraps the existing `DOMAINS` and `EXAM_CONFIG` from `src/config.ts`
- CCAR-P exam definition contains 7 domains with correct weights and exam rules
- All existing tests still pass (config.ts untouched for now — exams.ts imports from it)

**Todo List:**
1. Create `src/exams.ts` with:
   - `ExamDefinition` interface: `{ exam_id, displayName, shortName, questionsDir, domains: Record<number, DomainConfig>, examConfig: ExamConfig }`
   - `EXAMS` registry: `Record<string, ExamDefinition>` with keys `'aws'` and `'claude'`
   - AWS entry: wraps `DOMAINS` and `EXAM_CONFIG` from `src/config.ts`, `questionsDir = 'questions/aws'`
   - CCAR-P entry: 7 domains (weights 0.17, 0.13, 0.19, 0.16, 0.14, 0.14, 0.07), `totalScoredQuestions: 63`, `totalQuestions: 63`, `durationMinutes: 120`, `passingScore: 720`, `questionsDir = 'questions/claude'`
2. No changes to `src/config.ts` — it remains the source of truth for the AWS definition that `src/exams.ts` imports

**Relevant Context:**
- `src/config.ts` exports `DOMAINS`, `EXAM_CONFIG`, `DomainConfig`, `ExamConfig`
- CCAR-P: 63 total items (all scored — no unscored items mentioned), 120 min, score 720/1000

---

### Sub-Task 3 — Add `exam_id` to `AttemptRecord` + migrate history
**Status:** [x] done

**Intent:** History records must carry the exam they belong to so focus/stats can be scoped per-exam. Old history file is renamed as a one-time migration.

**Expected Outcomes:**
- `AttemptRecord` in `src/history.ts` has `exam_id: string` field
- `src/store.ts` `readHistory()` filters by exam when given an `exam_id`; new `readHistoryForExam(exam_id)` helper exported
- `recordAttempts()` continues to append; callers are responsible for setting `exam_id` on each record
- `.quiz-history.json` is renamed to `.quiz-history.aws.json` (handled at runtime by a one-time migration function in `store.ts`, not manually)
- `.gitignore` updated to cover the new filename pattern
- All existing tests still pass (update fixture `AttemptRecord` objects to include `exam_id`)

**Todo List:**
1. In `src/history.ts`: add `exam_id: string` to `AttemptRecord`
2. In `src/store.ts`:
   - Change `HISTORY_PATH` to `.quiz-history.json` → keep as-is, but add a `migrateHistory()` function that: checks if `.quiz-history.json` exists, renames it to `.quiz-history.aws.json`, adds `exam_id: 'aws'` to each record, writes to the new path
   - Change `HISTORY_PATH` constant to `.quiz-history.json` (master file going forward — all exams in one file, with `exam_id` field)
   - Add `readHistoryForExam(exam_id: string): AttemptRecord[]` that calls `readHistory()` then filters
   - Call `migrateHistory()` at the top of `readHistory()` so migration happens transparently on first run
3. In `.gitignore`: ensure `.quiz-history.json` (and `.quiz-history.aws.json` if it were to exist temporarily) are both covered
4. Update all test fixtures in `tests/history.test.ts` and `tests/validator.test.ts` to include `exam_id: 'aws'` in `AttemptRecord` objects

**Relevant Context:**
- `src/history.ts` line 19–26: `AttemptRecord` interface
- `src/store.ts` line 14: `const HISTORY_PATH = path.join(__dirname, '..', '.quiz-history.json')`
- `tests/history.test.ts` line 15: `attempt()` factory must add `exam_id`

---

### Sub-Task 4 — Thread `ExamDefinition` through mode runners
**Status:** [x] done

**Intent:** Every mode runner currently hardcodes AWS config. Pass the selected `ExamDefinition` as a parameter so the same runners work for both exams.

**Expected Outcomes:**
- `runPractice(rl, exam)`, `runExam(rl, exam)`, `runFocus(rl, exam, seedWrongIds?)`, `runStats(rl, exam)` all accept `ExamDefinition`
- Each runner uses `exam.questionsDir` for `loadQuestions()`, `exam.domains` for domain menus, `exam.examConfig` for timing/scoring, `exam.displayName` in headers
- Each runner stamps `exam_id: exam.exam_id` on every `AttemptRecord` it creates
- Each runner calls `readHistoryForExam(exam.exam_id)` instead of `readHistory()`
- All hardcoded `'AIP-C01'` / `DOMAINS` / `EXAM_CONFIG` references removed from runners
- Existing behaviour (AWS path) is identical to today when `exam = EXAMS['aws']`

**Todo List:**
1. Update `src/practice.ts` — add `exam: ExamDefinition` parameter; replace all hardcoded refs
2. Update `src/exam.ts` — same pattern
3. Update `src/focus.ts` — same pattern
4. Update `src/stats.ts` — same pattern
5. In each runner, replace `loadQuestions(domainFilter)` with `loadQuestions(exam.questionsDir, domainFilter)` (signature updated in Sub-Task 1)
6. In each runner, replace `readHistory()` with `readHistoryForExam(exam.exam_id)`
7. In each runner, add `exam_id: exam.exam_id` when constructing `AttemptRecord` objects
8. Verify `src/display.ts` domain rendering uses the passed-in `exam.domains` (not the global `DOMAINS` import) — update if needed

**Relevant Context:**
- `src/practice.ts` line 11: hardcoded header; line 24: domain range 1–5
- `src/exam.ts` line 13: hardcoded header; line 103: domain loop 1–5
- `src/focus.ts` line 29: hardcoded header
- `src/stats.ts` line 16: hardcoded header; uses global `DOMAINS`
- `src/display.ts` imports `DOMAINS` from `./config` — may need to accept it as a parameter or be updated

---

### Sub-Task 5 — Add exam selection menu to `src/app.ts`
**Status:** [x] done

**Intent:** The entry point presents an exam-selection screen before the mode-selection menu. The selected exam is passed into all mode runners.

**Expected Outcomes:**
- On startup: `AWS (AIP-C01)` vs `Claude (CCAR-P)` choice appears first
- After selecting an exam, the existing 4-mode menu appears unchanged
- `--exam aws` / `--exam claude` CLI flags bypass the interactive prompt (mirrors existing `--mode` pattern)
- Passing an unknown exam prints an error and exits
- All existing `--mode` flags continue to work; combined `--exam aws --mode practice` skips both prompts

**Todo List:**
1. Add exam selection logic in `main()` before mode selection, mirroring the `--mode` flag pattern
2. Support `--exam <id>` CLI flag
3. Display exam-selection menu with colours matching existing style
4. Call `migrateHistory()` early in `main()` (before any history read) to ensure migration runs once
5. Pass the resolved `ExamDefinition` to each mode runner call

**Relevant Context:**
- `src/app.ts` lines 16–24: `--mode` flag parsing pattern to mirror for `--exam`
- `src/exams.ts` `EXAMS` registry (created in Sub-Task 2)

---

### Sub-Task 6 — Write 100+ CCAR-P question bank
**Status:** [x] done

**Intent:** Populate `questions/claude/` with at least 100 high-quality multiple-choice and multiple-response questions covering all 7 CCAR-P domains, proportional to domain weights (17/13/19/16/14/14/7 → approx 17/13/19/16/14/14/7 questions minimum).

**Expected Outcomes:**
- At least these counts per domain (≥107 total):
  - Domain 1 (Solution Design & Architecture): ≥17 questions
  - Domain 2 (Models, Prompting & Context): ≥13 questions
  - Domain 3 (Integration): ≥19 questions
  - Domain 4 (Evaluation, Testing & Optimization): ≥16 questions
  - Domain 5 (Governance, Safety & Risk): ≥14 questions
  - Domain 6 (Stakeholder Communication): ≥14 questions
  - Domain 7 (Developer Productivity): ≥7 questions
- Each domain split into task-level files matching the blueprint objectives (e.g. `domain-1-task-1.1.json`, `domain-1-task-1.2.json`, ...)
- All files pass `npm run validate`
- Question IDs follow `cN-qNNNN` prefix (e.g. `c1-q0001`) to be globally unique from AWS `dN-qNNNN` IDs
- Mix of `single` and `multi` question types; difficulty spread across easy/medium/hard

**Todo List:**
1. Design the task-file breakdown per domain based on CCAR-P blueprint objectives
2. Write questions for Domain 1 (≥17)
3. Write questions for Domain 2 (≥13)
4. Write questions for Domain 3 (≥19, the heaviest domain)
5. Write questions for Domain 4 (≥16)
6. Write questions for Domain 5 (≥14)
7. Write questions for Domain 6 (≥14)
8. Write questions for Domain 7 (≥7)
9. Run `npm run validate` against `questions/claude/` to confirm zero errors

**Relevant Context:**
- Question JSON schema: see any `questions/aws/domain-1-task-1.1.json` after Sub-Task 1 move
- Required fields: `id`, `domain`, `task_statement`, `topic`, `difficulty`, `question_text`, `question_type`, `options` (≥4), `correct_answers`, `explanation`
- CCAR-P blueprint objectives (Section 6 of exam guide) are the authoritative source for question topics
- Sample questions from exam guide (Section 8) show the expected cognitive level

---

### Sub-Task 7 — Update `src/validate.ts` for multi-exam and update tests
**Status:** [x] done

**Intent:** The validate CLI should be able to validate either or both question banks, and all tests should pass end-to-end with the refactored code.

**Expected Outcomes:**
- `npm run validate` validates both `questions/aws/` and `questions/claude/` and reports counts per exam
- `npm test` passes with zero failures
- AGENTS.md updated with any new non-obvious patterns discovered during implementation

**Todo List:**
1. Update `src/validate.ts` to iterate over both exam directories
2. Run `npm test` — fix any remaining failures from the refactor
3. Run `npm run validate` — confirm clean
4. Update `AGENTS.md` with any new patterns (e.g. `cN-qNNNN` ID prefix for Claude questions)

**Relevant Context:**
- `src/validate.ts` currently calls `validateAll(questionsDir)` with a single path
- `src/validator.ts` is pure — no changes needed beyond possibly updating `FILE_PATTERN` if Claude files use a different prefix (they don't — same `domain-N-task-X.Y.json` naming)

---

### Sub-Task 8 — Git commit
**Status:** [ ] pending

**Intent:** Commit all changes cleanly after the user has confirmed correct behaviour.

**Expected Outcomes:**
- Single well-scoped commit (or two: one for refactor, one for question bank)
- `npm test` and `npm run validate` both green at the committed state
- Commit message follows project convention: `feat: add CCAR-P multi-exam support with 100+ Claude questions`

**Todo List:**
1. Run `npm test` and `npm run validate` one final time
2. Stage all changes: new files in `questions/claude/`, moved `questions/aws/`, `src/exams.ts`, updated `src/*.ts`, updated `tests/`
3. Commit with descriptive message
4. Confirm to user

---

## Architecture After Refactor

```
startup
  └─ exam selection (AWS | Claude)
       └─ mode selection (practice | exam | focus | stats)
            └─ mode runner receives ExamDefinition
                 ├─ loadQuestions(exam.questionsDir, domainFilter)
                 ├─ readHistoryForExam(exam.exam_id)
                 ├─ AttemptRecord { exam_id, ... }
                 └─ recordAttempts(records)
```

```
questions/
  aws/      ← moved from questions/
  claude/   ← new, 100+ CCAR-P questions

src/
  exams.ts  ← NEW: ExamDefinition, EXAMS registry
  config.ts ← unchanged (AWS source of truth)
  app.ts    ← exam selection menu added
  loader.ts ← questionsDir param replaces hardcoded constant
  history.ts← exam_id added to AttemptRecord
  store.ts  ← readHistoryForExam(), migrateHistory()
  practice/exam/focus/stats.ts ← all accept ExamDefinition
```
