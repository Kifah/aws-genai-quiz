/**
 * Adaptive-learning statistics library — pure functions, no I/O.
 *
 * Given a flat log of attempt records, derive per-question / per-topic /
 * per-domain performance stats and a recency-weighted "mastery" score used
 * by Focus Mode to bias practice toward weak areas.
 *
 * Design notes:
 *  - A recent WRONG answer should pull mastery down more than an old CORRECT
 *    answer pulls it up. We achieve this with exponential recency weighting:
 *    each attempt's weight decays by `DECAY` per position back from the most
 *    recent attempt, so the latest result dominates.
 *  - masteryScore is in [0, 1]; higher = better mastered. Never-attempted
 *    questions have masteryScore = null (callers treat as "unknown/weak").
 */

import { Question } from './loader';

export interface AttemptRecord {
  question_id: string;
  timestamp:   string;   // ISO 8601
  was_correct: boolean;
  selected:    string[]; // option keys the user chose
  mode:        'practice' | 'exam' | 'focus';
  session_id:  string;
}

export interface QuestionStats {
  question_id:       string;
  times_seen:        number;
  times_correct:     number;
  times_wrong:       number;
  last_result:       'correct' | 'wrong' | null;
  last_attempted_at: string | null;
  masteryScore:      number | null; // [0,1] recency-weighted; null if never seen
}

export interface GroupStats {
  key:            string; // topic name or domain number (as string)
  times_seen:     number;
  times_correct:  number;
  times_wrong:    number;
  accuracy:       number | null;      // times_correct / times_seen, or null
  masteryScore:   number | null;      // mean of member question mastery, or null
  questionIds:    string[];           // distinct question ids in this group
  neverAttempted: number;             // count of group questions with no attempts
}

/** Recency decay factor per attempt-step back from the most recent. */
const DECAY = 0.6;

/**
 * Compute recency-weighted mastery from a question's attempts in chronological
 * order. Returns a value in [0,1], or null when there are no attempts.
 *
 * The most recent attempt gets weight 1, the next-oldest DECAY, then DECAY^2…
 * so a fresh wrong answer heavily outweighs older correct ones.
 */
export function masteryFromAttempts(attemptsChrono: AttemptRecord[]): number | null {
  if (attemptsChrono.length === 0) return null;
  // Walk from most-recent to oldest, applying decaying weights.
  let weighted = 0;
  let weightSum = 0;
  let w = 1;
  for (let i = attemptsChrono.length - 1; i >= 0; i--) {
    weighted += w * (attemptsChrono[i].was_correct ? 1 : 0);
    weightSum += w;
    w *= DECAY;
  }
  return weightSum === 0 ? null : weighted / weightSum;
}

/**
 * Build per-question stats from a flat attempt log.
 * Attempts are grouped by question_id and sorted chronologically per question.
 */
export function computeQuestionStats(attempts: AttemptRecord[]): Map<string, QuestionStats> {
  const byQuestion = new Map<string, AttemptRecord[]>();
  for (const a of attempts) {
    const list = byQuestion.get(a.question_id);
    if (list) list.push(a);
    else byQuestion.set(a.question_id, [a]);
  }

  const out = new Map<string, QuestionStats>();
  for (const [qid, list] of byQuestion) {
    const chrono = [...list].sort((x, y) => x.timestamp.localeCompare(y.timestamp));
    const timesCorrect = chrono.filter(a => a.was_correct).length;
    const last = chrono[chrono.length - 1];
    out.set(qid, {
      question_id:       qid,
      times_seen:        chrono.length,
      times_correct:     timesCorrect,
      times_wrong:       chrono.length - timesCorrect,
      last_result:       last.was_correct ? 'correct' : 'wrong',
      last_attempted_at: last.timestamp,
      masteryScore:      masteryFromAttempts(chrono),
    });
  }
  return out;
}

/**
 * Roll question stats up to an arbitrary grouping key derived from each
 * Question (e.g. its topic or its domain). Questions with no attempts still
 * count toward `neverAttempted` and the group's question list.
 */
export function rollUp(
  questions: Question[],
  qStats: Map<string, QuestionStats>,
  keyOf: (q: Question) => string,
): Map<string, GroupStats> {
  const groups = new Map<string, GroupStats>();

  for (const q of questions) {
    const key = keyOf(q);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        times_seen: 0,
        times_correct: 0,
        times_wrong: 0,
        accuracy: null,
        masteryScore: null,
        questionIds: [],
        neverAttempted: 0,
      };
      groups.set(key, g);
    }
    g.questionIds.push(q.id);

    const s = qStats.get(q.id);
    if (!s) {
      g.neverAttempted++;
    } else {
      g.times_seen += s.times_seen;
      g.times_correct += s.times_correct;
      g.times_wrong += s.times_wrong;
    }
  }

  // Finalise derived fields: accuracy and mean mastery over attempted questions.
  for (const g of groups.values()) {
    g.accuracy = g.times_seen > 0 ? g.times_correct / g.times_seen : null;
    const masteries = g.questionIds
      .map(id => qStats.get(id)?.masteryScore)
      .filter((m): m is number => typeof m === 'number');
    g.masteryScore = masteries.length > 0
      ? masteries.reduce((a, b) => a + b, 0) / masteries.length
      : null;
  }

  return groups;
}

/** Convenience: roll up by topic. */
export function rollUpByTopic(
  questions: Question[],
  qStats: Map<string, QuestionStats>,
): Map<string, GroupStats> {
  return rollUp(questions, qStats, q => q.topic);
}

/** Convenience: roll up by domain (key is the domain number as a string). */
export function rollUpByDomain(
  questions: Question[],
  qStats: Map<string, QuestionStats>,
): Map<string, GroupStats> {
  return rollUp(questions, qStats, q => String(q.domain));
}

/**
 * Return the N weakest groups, worst first. "Weakest" ranks by lowest mastery;
 * groups that have been attempted but scored low outrank never-attempted ones
 * only when includeNeverAttempted is false. When includeNeverAttempted is true,
 * a group with NO attempts is treated as mastery 0 (maximally weak) so brand-new
 * topics surface as review priorities.
 */
export function weakestGroups(
  groups: Map<string, GroupStats>,
  n: number,
  includeNeverAttempted = false,
): GroupStats[] {
  const arr = [...groups.values()].filter(g => {
    if (g.masteryScore !== null) return true;
    return includeNeverAttempted; // only include unattempted groups if asked
  });
  const effective = (g: GroupStats): number => g.masteryScore ?? 0;
  return arr.sort((a, b) => effective(a) - effective(b)).slice(0, n);
}

/**
 * Question-generation loop-back helper: flag topics that are BOTH thin
 * (few questions) AND low-mastery, marking them as priority coverage gaps for
 * future question authoring.
 *
 * @param topicGroups  output of rollUpByTopic
 * @param minQuestions topics with fewer than this many questions are "thin"
 * @param masteryCeil  topics with mastery <= this (or null) are "weak"
 */
export interface CoverageGap {
  topic:        string;
  questionCount: number;
  masteryScore: number | null;
}

export function priorityCoverageGaps(
  topicGroups: Map<string, GroupStats>,
  minQuestions = 5,
  masteryCeil = 0.6,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const g of topicGroups.values()) {
    const thin = g.questionIds.length < minQuestions;
    const weak = g.masteryScore === null || g.masteryScore <= masteryCeil;
    if (thin && weak) {
      gaps.push({
        topic: g.key,
        questionCount: g.questionIds.length,
        masteryScore: g.masteryScore,
      });
    }
  }
  // Weakest + thinnest first.
  return gaps.sort((a, b) => {
    const ma = a.masteryScore ?? 0;
    const mb = b.masteryScore ?? 0;
    if (ma !== mb) return ma - mb;
    return a.questionCount - b.questionCount;
  });
}
