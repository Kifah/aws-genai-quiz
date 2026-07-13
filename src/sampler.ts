/**
 * Focus Mode question sampler — pure, deterministic given an RNG.
 *
 * Selection biases practice toward weak spots using three buckets:
 *   a) never-attempted questions in weak topics/domains
 *   b) previously-wrong questions, prioritised by recency + miss frequency
 *      (missed twice ranks above missed-once-then-corrected)
 *   c) ~10-15% previously-correct questions for spaced reinforcement
 *
 * Weighting is applied per candidate question, then we draw without
 * replacement via weighted random selection. An injectable RNG (default
 * Math.random) makes the selection testable and reproducible.
 */

import { Question } from './loader';
import { QuestionStats } from './history';

export type Rng = () => number;

/** Fraction of the session reserved for reinforcement (previously-correct). */
const REINFORCE_FRACTION = 0.12;

export interface WeightedQuestion {
  question: Question;
  weight:   number;
  bucket:   'never' | 'wrong' | 'correct';
}

/**
 * Compute a selection weight for a single question given its stats and whether
 * its topic is currently "weak". Higher weight = more likely to be drawn.
 *
 * - never-attempted: base weight, boosted when in a weak topic
 * - previously-wrong: high weight scaled by miss count and recency of last miss
 * - previously-correct: low weight (reinforcement only)
 */
export function weightForQuestion(
  q: Question,
  stats: QuestionStats | undefined,
  weakTopics: Set<string>,
): WeightedQuestion {
  // Never attempted.
  if (!stats || stats.times_seen === 0) {
    const inWeak = weakTopics.has(q.topic);
    return { question: q, weight: inWeak ? 6 : 3, bucket: 'never' };
  }

  // Previously wrong on the most recent attempt → highest priority.
  if (stats.last_result === 'wrong') {
    // More misses → higher weight. Each prior wrong adds to urgency.
    const missBoost = 1 + stats.times_wrong; // missed twice > missed once
    return { question: q, weight: 8 * missBoost, bucket: 'wrong' };
  }

  // Previously wrong at some point but last attempt correct → moderate.
  if (stats.times_wrong > 0) {
    return { question: q, weight: 3 + stats.times_wrong, bucket: 'wrong' };
  }

  // Consistently correct → low reinforcement weight (mastery pulls it lower).
  const mastery = stats.masteryScore ?? 1;
  const reinforce = Math.max(0.5, 2 * (1 - mastery));
  return { question: q, weight: reinforce, bucket: 'correct' };
}

/** Build the weighted candidate list for all questions. */
export function buildCandidates(
  questions: Question[],
  qStats: Map<string, QuestionStats>,
  weakTopics: Set<string>,
): WeightedQuestion[] {
  return questions.map(q => weightForQuestion(q, qStats.get(q.id), weakTopics));
}

/** Draw one index from a weight array using the RNG; returns -1 if all zero. */
function drawWeightedIndex(weights: number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1; // floating-point safety
}

/**
 * Sample `count` questions for a Focus session.
 *
 * We enforce the reinforcement cap: at most ~REINFORCE_FRACTION of the session
 * comes from the 'correct' bucket, so most of the time is spent on weak/never
 * material. Drawing is weighted-random without replacement.
 */
export function sampleFocus(
  candidates: WeightedQuestion[],
  count: number,
  rng: Rng = Math.random,
): Question[] {
  const target = Math.min(count, candidates.length);
  const maxReinforce = Math.round(target * REINFORCE_FRACTION);

  const pool = candidates.map((c, i) => ({ c, i, active: true }));
  const weights = candidates.map(c => c.weight);
  const selected: Question[] = [];
  let reinforceUsed = 0;

  while (selected.length < target) {
    // Effective weights: zero out inactive picks and, once the reinforcement
    // budget is spent, zero out remaining 'correct' bucket questions.
    const eff = pool.map(p => {
      if (!p.active) return 0;
      if (p.c.bucket === 'correct' && reinforceUsed >= maxReinforce) return 0;
      return weights[p.i];
    });

    let idx = drawWeightedIndex(eff, rng);

    // If everything eligible is exhausted (e.g. only correct-bucket left but
    // budget spent), relax the reinforcement cap to still fill the session.
    if (idx === -1) {
      const relaxed = pool.map(p => (p.active ? weights[p.i] : 0));
      idx = drawWeightedIndex(relaxed, rng);
      if (idx === -1) break; // truly nothing left
    }

    const pick = pool[idx];
    pick.active = false;
    if (pick.c.bucket === 'correct') reinforceUsed++;
    selected.push(pick.c.question);
  }

  return selected;
}

/** Deterministic mulberry32 RNG — used by tests for reproducible sampling. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
