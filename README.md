# AWS Certified Generative AI Developer – Professional (AIP-C01) Practice Quiz

A TypeScript CLI quiz app with **157 original questions** covering all five exam domains.

---

## Project layout

```
aws-genai-quiz/
├── questions/                        # Question bank — one JSON file per task statement
│   ├── domain-1-task-1.1.json        # Task 1.1: Analyse requirements and design GenAI solutions
│   ├── domain-1-task-1.2.json        # Task 1.2: Select and configure FMs
│   ├── domain-1-task-1.3.json        # Task 1.3: Implement data validation and processing pipelines
│   ├── domain-1-task-1.4.json        # Task 1.4: Design and implement vector store solutions
│   ├── domain-1-task-1.5.json        # Task 1.5: Design retrieval mechanisms for FM augmentation
│   ├── domain-1-task-1.6.json        # Task 1.6: Implement prompt engineering strategies
│   ├── domain-2-task-2.1.json        # Task 2.1: Agentic AI solutions and tool integrations
│   ├── domain-2-task-2.2.json        # Task 2.2: Model deployment strategies
│   ├── domain-2-task-2.3.json        # Task 2.3: Enterprise integration architectures
│   ├── domain-2-task-2.4.json        # Task 2.4: FM API integrations
│   ├── domain-2-task-2.5.json        # Task 2.5: Application integration and development tools
│   ├── domain-3-task-3.1.json        # Task 3.1: Input and output safety controls
│   ├── domain-3-task-3.2.json        # Task 3.2: Data security and privacy controls
│   ├── domain-3-task-3.3.json        # Task 3.3: AI governance and compliance mechanisms
│   ├── domain-3-task-3.4.json        # Task 3.4: Responsible AI principles
│   ├── domain-4-task-4.1.json        # Task 4.1: Cost optimisation and resource efficiency
│   ├── domain-4-task-4.2.json        # Task 4.2: Application performance optimisation
│   ├── domain-4-task-4.3.json        # Task 4.3: Monitoring systems for GenAI applications
│   ├── domain-5-task-5.1.json        # Task 5.1: Evaluation systems for GenAI
│   └── domain-5-task-5.2.json        # Task 5.2: Troubleshoot GenAI applications
├── src/
│   ├── app.ts                        # Entry point — mode selection
│   ├── config.ts                     # Domain weights, exam parameters
│   ├── loader.ts                     # Question loading and proportional sampling
│   ├── display.ts                    # ANSI terminal rendering
│   ├── practice.ts                   # Practice mode engine
│   ├── exam.ts                       # Exam simulation engine
│   ├── validate.ts                   # CLI entry — question bank validator
│   ├── validator.ts                  # Pure validation library (no I/O)
│   └── utils/
│       ├── answers.ts                # parseAnswer(), answersCorrect() — shared pure helpers
│       └── format.ts                 # color(), progressBar(), formatTimer(), wrapText()
├── tests/
│   ├── loader.test.ts                # Tests for loader.ts
│   ├── answers.test.ts               # Tests for utils/answers.ts
│   └── validator.test.ts             # Tests for validator.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js ≥ 18**
- **npm ≥ 9**

```bash
node --version   # must be v18+
npm --version
```

---

## Installation

```bash
cd aws-genai-quiz
npm install
```

This installs:
- `typescript` — TypeScript compiler (`tsc`)
- `tsx` — zero-config TypeScript runner (replaces `ts-node`; supports TypeScript 5+/7+)
- `@types/node` — Node.js type definitions

No separate compilation step is needed to run or test — `tsx` executes `.ts` files directly.

---

## Running Practice Mode

Practice mode lets you study at your own pace. After each question you can reveal the correct answer and full explanation before moving on.

```bash
# Interactive mode selector
npm start

# Jump straight to practice
npm run practice

# Equivalent direct invocation
npx tsx src/app.ts --mode practice
```

**Practice mode workflow:**
1. Select domains — e.g. `1 3` for Domains 1 and 3, or `0` for all
2. Enter how many questions (default: 20)
3. Answer each question — single choice: `A`, multi-select: `A C`
4. After answering, the correct answer(s) and explanation are shown automatically
5. Press **Enter** to advance, `q` to quit early
6. A running score is shown at the end

---

## Running Exam Mode

Exam mode simulates the real AIP-C01 exam: 65 questions sampled proportionally by domain weight, a countdown timer, and no answer reveals until the exam ends.

```bash
npm run exam

# Equivalent direct invocation
npx tsx src/app.ts --mode exam
```

**Exam mode workflow:**
1. Optionally enter a shorter timer in minutes (default: **205 minutes**)
2. Answer questions — type the option key(s); `s` to skip, `r` to jump to a question number, `end` to submit early
3. At completion: overall score, PASS/FAIL verdict (≥ 75% = PASS, scaled 750/1000), per-domain breakdown
4. Optionally review all questions with explanations

**Domain weights used for exam sampling:**

| Domain | Topic | Weight |
|--------|-------|--------|
| 1 | Foundation Model Integration, Data Management, and Compliance | 31% |
| 2 | Implementation and Integration | 26% |
| 3 | AI Safety, Security, and Governance | 20% |
| 4 | Operational Efficiency and Optimization for GenAI Apps | 12% |
| 5 | Testing, Validation, and Troubleshooting | 11% |

**Real exam structure:** 85 total questions (65 scored + 20 unscored/unlabeled), 205 minutes, passing score 750/1000 (≈ 75%).

---

## Validating the Question Bank

Run the validator before committing new questions:

```bash
npm run validate

# Equivalent direct invocation
npx tsx src/validate.ts
```

The validator checks every question in the pool and reports:
- All required fields present (`id`, `domain`, `task_statement`, `topic`, `difficulty`, `question_text`, `question_type`, `options`, `correct_answers`, `explanation`)
- `correct_answers` keys exist in `options`
- `question_type` matches `correct_answers` length (`single` → exactly 1, `multi` → 2+)
- IDs are globally unique across all files
- ID format matches `d{domain}-q{4-digit-sequence}`
- Difficulty is `easy`, `medium`, or `hard`
- Per-domain question counts

Exit code **0** = all valid. Exit code **1** = errors found (safe to commit only when exit code is 0).

---

## Running Tests

```bash
npm test
```

This runs the full test suite (54 tests) using Node.js's built-in `node:test` runner with `tsx` for TypeScript transpilation:

```
tests/loader.test.ts     — loadQuestions, sampleProportional, shuffle
tests/answers.test.ts    — parseAnswer, answersCorrect
tests/validator.test.ts  — validateQuestion (unit), validateAll (integration against real question bank)
```

To type-check without running (no output = no errors):

```bash
npx tsc --noEmit
```

To compile to JavaScript (output goes to `dist/`):

```bash
npm run build
```

---

## Question Bank Structure

Each question file is a JSON array. File naming: `domain-{N}-task-{X.Y}.json`.

### Schema

```json
{
  "id": "d1-q0001",
  "domain": 1,
  "task_statement": "1.3",
  "topic": "RAG architecture",
  "difficulty": "medium",
  "question_text": "A company needs to retrieve relevant passages from millions of internal documents with sub-second latency for a RAG pipeline. Which solution best meets this requirement?",
  "question_type": "single",
  "options": [
    { "key": "A", "text": "Amazon Aurora with pgvector extension" },
    { "key": "B", "text": "Amazon OpenSearch Serverless vector engine" },
    { "key": "C", "text": "Amazon Kendra GenAI Index" },
    { "key": "D", "text": "Amazon DynamoDB with a custom similarity function" }
  ],
  "correct_answers": ["B"],
  "explanation": "OpenSearch Serverless's vector engine is purpose-built for high-scale, low-latency vector similarity search. Aurora pgvector suits smaller/mid-scale relational-adjacent use cases. Kendra is closing to new customers (July 2026). DynamoDB has no native vector search.",
  "source_topic": "Bedrock Knowledge Bases + OpenSearch integration"
}
```

### Field rules

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique; format `d{domain}-q{4-digit-seq}` |
| `domain` | integer | 1–5, must match filename domain |
| `task_statement` | string | Matches exam guide numbering, e.g. `"1.3"` |
| `difficulty` | string | `"easy"` \| `"medium"` \| `"hard"` |
| `question_type` | string | `"single"` (1 correct) or `"multi"` (2+ correct) |
| `correct_answers` | string[] | Keys from `options`; length must match `question_type` |
| `options` | object[] | 4–5 items, each `{ "key": "A"–"E", "text": "..." }` |
| `explanation` | string | Must explain why the correct answer(s) are right AND why at least one distractor is wrong |
| `source_topic` | string | Optional — AWS service or concept area for traceability |

---

## Adding or Regenerating Questions

1. Add new question objects to the appropriate `questions/domain-{N}-task-{X.Y}.json` file (or create a new file for a new task).
2. Follow the ID sequence — check existing max ID in the file to avoid collisions.
3. Run `npm run validate` — fix any reported errors before committing.
4. The loader picks up all files matching `domain-{N}(-task-{X.Y})?.json` automatically — no registration needed.

### Proportional targets for a 500-question pool

| Domain | Weight | Target Qs |
|--------|--------|-----------|
| D1 | 31% | 155 |
| D2 | 26% | 130 |
| D3 | 20% | 100 |
| D4 | 12% | 60 |
| D5 | 11% | 55 |

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| **TypeScript 7** | Language |
| **tsx 4** | Zero-config TS runner (no separate `tsc` step needed to run) |
| **node:test** | Built-in Node.js test runner (no extra test framework) |
| **tsc** | Type-checking and production build (`npm run build` → `dist/`) |

---

## Exam Guide Reference

Official exam guide: <https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.html>

All questions are **original works** synthesised from the official exam guide task statements and skills. No questions have been reproduced from exam dumps or leaked question banks.
