/**
 * Pure validation library — no console output, no process.exit.
 * Returns structured result objects so callers can decide how to report.
 */

import * as fs   from 'fs';
import * as path from 'path';

export const REQUIRED_FIELDS: ReadonlyArray<string> = [
  'id', 'domain', 'task_statement', 'topic', 'difficulty',
  'question_text', 'question_type', 'options', 'correct_answers', 'explanation',
];

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const VALID_TYPES        = new Set(['single', 'multi']);
export const FILE_PATTERN = /^domain-\d+(?:-task-[\d.]+|-seminar)?\.json$/;

export interface QuestionResult {
  errors:   string[];
  warnings: string[];
}

export interface FileResult {
  filename: string;
  errors:   string[];
  warnings: string[];
  count:    number;
}

export interface ValidationResult {
  fileResults:    FileResult[];
  totalQuestions: number;
  domainCounts:   Record<number, number>;
  totalErrors:    number;
  totalWarnings:  number;
}

// ── Single-question validation ────────────────────────────────────────────────

/**
 * Validate one question object.
 *
 * @param q          — the question object (unknown shape from JSON)
 * @param index      — 0-based position within its file
 * @param domainNum  — domain number extracted from the filename
 * @param filename   — filename (for error messages only)
 * @param seenIds    — global set of already-seen IDs (mutated in place)
 */
export function validateQuestion(
  q: Record<string, unknown>,
  index: number,
  domainNum: number,
  filename: string,
  seenIds: Set<string>,
): QuestionResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const id     = typeof q['id'] === 'string' ? q['id'] : 'MISSING';
  const prefix = `${filename} Q[${index}] id=${id}`;

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (q[field] === undefined || q[field] === null || q[field] === '') {
      errors.push(`${prefix}: missing required field "${field}"`);
    }
  }

  // ID format and uniqueness
  if (typeof q['id'] === 'string') {
    const awsPrefix    = `d${domainNum}-q`;
    const claudePrefix = `c${domainNum}-q`;
    if (!q['id'].startsWith(awsPrefix) && !q['id'].startsWith(claudePrefix)) {
      warnings.push(`${prefix}: id should start with "${awsPrefix}" or "${claudePrefix}"`);
    }
    if (seenIds.has(q['id'])) {
      errors.push(`${prefix}: duplicate id "${q['id']}" across files`);
    }
    seenIds.add(q['id']);
  }

  // Domain field matches filename domain
  if (q['domain'] !== undefined && q['domain'] !== domainNum) {
    warnings.push(`${prefix}: domain field (${String(q['domain'])}) doesn't match file domain (${domainNum})`);
  }

  // Difficulty
  if (typeof q['difficulty'] === 'string' && !VALID_DIFFICULTIES.has(q['difficulty'])) {
    errors.push(`${prefix}: invalid difficulty "${q['difficulty']}" (must be easy|medium|hard)`);
  }

  // Question type
  if (typeof q['question_type'] === 'string' && !VALID_TYPES.has(q['question_type'])) {
    errors.push(`${prefix}: invalid question_type "${q['question_type']}" (must be single|multi)`);
  }

  // Priority (optional; 1 = default, 5 = highest)
  const priority = q['priority'];
  if (priority !== undefined && (!Number.isInteger(priority) || (priority as number) < 1 || (priority as number) > 5)) {
    errors.push(`${prefix}: invalid priority "${String(priority)}" (must be an integer 1-5)`);
  }

  // Options
  const options = q['options'];
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 4) {
      errors.push(`${prefix}: options must be an array with at least 4 items`);
    } else {
      const optionKeys = new Set((options as Array<Record<string, unknown>>).map(o => o['key']));
      const correctAnswers = q['correct_answers'];

      if (Array.isArray(correctAnswers)) {
        for (const key of correctAnswers) {
          if (!optionKeys.has(key)) {
            errors.push(`${prefix}: correct_answer key "${String(key)}" not found in options`);
          }
        }
        if (q['question_type'] === 'single' && correctAnswers.length !== 1) {
          errors.push(`${prefix}: question_type=single but correct_answers has ${correctAnswers.length} items`);
        }
        if (q['question_type'] === 'multi' && correctAnswers.length < 2) {
          errors.push(`${prefix}: question_type=multi but correct_answers has only ${correctAnswers.length} item(s)`);
        }
      }
    }
  }

  // Explanation sanity check
  if (typeof q['explanation'] === 'string' && q['explanation'].length < 30) {
    warnings.push(`${prefix}: explanation seems very short (${q['explanation'].length} chars)`);
  }

  return { errors, warnings };
}

// ── Single-file validation ────────────────────────────────────────────────────

/**
 * Validate one question-bank JSON file.
 *
 * @param filePath — absolute path to the file
 * @param seenIds  — global set of already-seen IDs (mutated in place)
 */
export function validateFile(filePath: string, seenIds: Set<string>): FileResult {
  const filename  = path.basename(filePath);
  const match     = filename.match(/domain-(\d+)/);
  const domainNum = match ? parseInt(match[1], 10) : 0;
  const result: FileResult = { filename, errors: [], warnings: [], count: 0 };

  let questions: unknown;
  try {
    questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    result.errors.push(`JSON parse error in ${filename}: ${(e as Error).message}`);
    return result;
  }

  if (!Array.isArray(questions)) {
    result.errors.push(`${filename}: root must be a JSON array`);
    return result;
  }

  result.count = questions.length;

  for (let i = 0; i < questions.length; i++) {
    const { errors, warnings } = validateQuestion(
      questions[i] as Record<string, unknown>,
      i,
      domainNum,
      filename,
      seenIds,
    );
    result.errors.push(...errors);
    result.warnings.push(...warnings);
  }

  return result;
}

// ── Full-bank validation ──────────────────────────────────────────────────────

/**
 * Validate every question file in `questionsDir`.
 */
export function validateAll(questionsDir: string): ValidationResult {
  const files = fs.readdirSync(questionsDir)
    .filter(f => FILE_PATTERN.test(f))
    .sort();

  const seenIds:      Set<string>             = new Set();
  const fileResults:  FileResult[]            = [];
  let   totalQuestions = 0;
  const domainCounts:  Record<number, number> = {};

  for (const filename of files) {
    const filePath   = path.join(questionsDir, filename);
    const fileResult = validateFile(filePath, seenIds);
    fileResults.push(fileResult);

    totalQuestions += fileResult.count;
    const domainNum  = parseInt((filename.match(/domain-(\d+)/) ?? ['', '0'])[1], 10);
    domainCounts[domainNum] = (domainCounts[domainNum] ?? 0) + fileResult.count;
  }

  const totalErrors   = fileResults.reduce((n, r) => n + r.errors.length,   0);
  const totalWarnings = fileResults.reduce((n, r) => n + r.warnings.length, 0);

  return { fileResults, totalQuestions, domainCounts, totalErrors, totalWarnings };
}
