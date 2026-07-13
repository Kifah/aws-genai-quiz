import * as fs   from 'fs';
import * as path from 'path';
import { DomainConfig } from './config';

const QUESTIONS_DIR = path.join(__dirname, '..', 'questions');

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
}

/**
 * Load questions for one or more domains.
 * @param domainFilter - array of domain numbers to include, or null for all
 */
export function loadQuestions(domainFilter: number[] | null = null): Question[] {
  const allQuestions: Question[] = [];
  // Accept both legacy domain-N.json and split domain-N-task-X.Y.json files
  const files = fs.readdirSync(QUESTIONS_DIR)
    .filter(f => /^domain-\d+(?:-task-[\d.]+)?\.json$/.test(f))
    .sort();

  for (const file of files) {
    const match = file.match(/^domain-(\d+)/);
    if (!match) continue;
    const domainNum = parseInt(match[1], 10);
    if (domainFilter && !domainFilter.includes(domainNum)) continue;

    const raw       = fs.readFileSync(path.join(QUESTIONS_DIR, file), 'utf8');
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
 */
export function sampleProportional(
  allQuestions: Question[],
  total: number,
  domains: Record<number, DomainConfig>,
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
    const pool = (byDomain[domain] ?? []).slice();
    shuffle(pool);
    selected.push(...pool.slice(0, count));
  }

  shuffle(selected);
  return selected;
}

/** Fisher-Yates in-place shuffle. Returns the same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
