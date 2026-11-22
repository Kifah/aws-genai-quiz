import * as fs   from 'fs';
import * as path from 'path';
import { DomainConfig } from './config';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface Question {
  id:             string;
  domain:         number;
  task_statement: string;
  topic:          string;
  difficulty:     'easy' | 'medium' | 'hard';
  question_text:  string;
  question_type:  'single' | 'multi';
  options:        QuestionOption[];
  correct_answers: string[];
  explanation:    string;
  source_topic?:  string;
  /** 1 (default) to 5. Unattempted questions with priority > 1 are served first. */
  priority?:      number;
  source?:        string;
  seminar_id?:    number;
}

export const DEFAULT_PRIORITY = 1;

export function priorityOf(q: Question): number {
  return q.priority ?? DEFAULT_PRIORITY;
}

/** True for a priority question the user has not attempted yet. */
export function isPendingPriority(q: Question, attemptedIds: ReadonlySet<string>): boolean {
  return priorityOf(q) > DEFAULT_PRIORITY && !attemptedIds.has(q.id);
}

/**
 * Unattempted priority questions, highest priority first. The sort is stable,
 * so callers shuffle beforehand to randomise order within a priority level.
 */
export function pendingPriority(questions: Question[], attemptedIds: ReadonlySet<string>): Question[] {
  return questions
    .filter(q => isPendingPriority(q, attemptedIds))
    .sort((a, b) => priorityOf(b) - priorityOf(a));
}

/** Pending priority questions first, then everything else in its given order. */
export function prioritizeFirst(questions: Question[], attemptedIds: ReadonlySet<string>): Question[] {
  const pending = pendingPriority(questions, attemptedIds);
  const pendingIds = new Set(pending.map(q => q.id));
  return [...pending, ...questions.filter(q => !pendingIds.has(q.id))];
}

/**
 * Load questions for one or more domains.
 * @param questionsDir - path to the directory containing question JSON files
 * @param domainFilter - array of domain numbers to include, or null for all
 */
export function loadQuestions(questionsDir: string, domainFilter: number[] | null = null): Question[] {
  const allQuestions: Question[] = [];
  // Accept both legacy domain-N.json and split domain-N-task-X.Y.json files
  const files = fs.readdirSync(questionsDir)
    .filter(f => /^domain-\d+(?:-task-[\d.]+|-seminar)?\.json$/.test(f))
    .sort();

  for (const file of files) {
    const match = file.match(/^domain-(\d+)/);
    if (!match) continue;
    const domainNum = parseInt(match[1], 10);
    if (domainFilter && !domainFilter.includes(domainNum)) continue;

    const raw       = fs.readFileSync(path.join(questionsDir, file), 'utf8');
    const questions = JSON.parse(raw) as Question[];
    allQuestions.push(...questions);
  }

  return allQuestions;
}

interface DomainEntry {
  domain: number;
  weight: number;
}

/**
 * Sample questions proportional to domain weights for exam mode.
 * Within each domain, unattempted priority questions are picked before the rest.
 */
export function sampleProportional(
  allQuestions: Question[],
  total: number,
  domains: Record<number, DomainConfig>,
  attemptedIds: ReadonlySet<string> = new Set(),
): Question[] {
  const byDomain: Record<number, Question[]> = {};
  for (const q of allQuestions) {
    if (!byDomain[q.domain]) byDomain[q.domain] = [];
    byDomain[q.domain].push(q);
  }

  const domainEntries: DomainEntry[] = Object.entries(domains).map(([k, v]) => ({
    domain: parseInt(k, 10),
    weight: v.weight,
  }));

  // Compute target counts, ensuring they sum exactly to `total`
  const targets: Array<{ domain: number; count: number }> = [];
  let allocated = 0;
  for (let i = 0; i < domainEntries.length; i++) {
    const { domain, weight } = domainEntries[i];
    const count = i === domainEntries.length - 1
      ? total - allocated
      : Math.round(weight * total);
    targets.push({ domain, count: Math.max(1, count) });
    allocated += count;
  }

  const selected: Question[] = [];
  for (const { domain, count } of targets) {
    const pool = prioritizeFirst(shuffle((byDomain[domain] ?? []).slice()), attemptedIds);
    selected.push(...pool.slice(0, count));
  }

  shuffle(selected);
  return prioritizeFirst(selected, attemptedIds);
}

/** Fisher-Yates in-place shuffle. Returns the same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
