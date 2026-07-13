import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  weightForQuestion,
  buildCandidates,
  sampleFocus,
  seededRng,
} from '../src/sampler';
import { QuestionStats } from '../src/history';
import { Question } from '../src/loader';

function q(id: string, topic: string): Question {
  return {
    id, domain: 1, task_statement: '1.1', topic, difficulty: 'easy',
    question_text: 'x', question_type: 'single',
    options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
    correct_answers: ['A'], explanation: 'because',
  };
}

function stat(overrides: Partial<QuestionStats>): QuestionStats {
  return {
    question_id: 'q', times_seen: 1, times_correct: 0, times_wrong: 0,
    last_result: null, last_attempted_at: null, masteryScore: null, ...overrides,
  };
}

describe('weightForQuestion', () => {
  it('never-attempted in a weak topic outweighs never-attempted elsewhere', () => {
    const weak = weightForQuestion(q('q1', 'RAG'), undefined, new Set(['RAG']));
    const other = weightForQuestion(q('q2', 'Agents'), undefined, new Set(['RAG']));
    assert.equal(weak.bucket, 'never');
    assert.ok(weak.weight > other.weight);
  });

  it('a recent wrong answer gets a high weight, scaled by miss count', () => {
    const onceWrong = weightForQuestion(q('q1', 'RAG'), stat({ times_seen: 1, times_wrong: 1, last_result: 'wrong', masteryScore: 0 }), new Set());
    const twiceWrong = weightForQuestion(q('q2', 'RAG'), stat({ times_seen: 2, times_wrong: 2, last_result: 'wrong', masteryScore: 0 }), new Set());
    assert.equal(onceWrong.bucket, 'wrong');
    assert.ok(twiceWrong.weight > onceWrong.weight, 'missed twice should outrank missed once');
  });

  it('consistently correct questions get a low reinforcement weight', () => {
    const mastered = weightForQuestion(q('q1', 'RAG'), stat({ times_seen: 3, times_correct: 3, last_result: 'correct', masteryScore: 1 }), new Set());
    assert.equal(mastered.bucket, 'correct');
    assert.ok(mastered.weight <= 1);
  });

  it('previously wrong but now correct is moderate (below fresh-wrong, above mastered)', () => {
    const recovered = weightForQuestion(q('q1', 'RAG'), stat({ times_seen: 2, times_correct: 1, times_wrong: 1, last_result: 'correct', masteryScore: 0.6 }), new Set());
    assert.equal(recovered.bucket, 'wrong');
    assert.ok(recovered.weight > 1);
  });
});

describe('sampleFocus', () => {
  it('is deterministic given a seeded RNG', () => {
    const questions = Array.from({ length: 20 }, (_, i) => q(`q${i}`, i < 10 ? 'RAG' : 'Agents'));
    const stats = new Map<string, QuestionStats>();
    const cands1 = buildCandidates(questions, stats, new Set(['RAG']));
    const cands2 = buildCandidates(questions, stats, new Set(['RAG']));
    const a = sampleFocus(cands1, 8, seededRng(42)).map(x => x.id);
    const b = sampleFocus(cands2, 8, seededRng(42)).map(x => x.id);
    assert.deepEqual(a, b);
  });

  it('returns the requested count without duplicates', () => {
    const questions = Array.from({ length: 30 }, (_, i) => q(`q${i}`, 'RAG'));
    const cands = buildCandidates(questions, new Map(), new Set(['RAG']));
    const picked = sampleFocus(cands, 10, seededRng(7));
    assert.equal(picked.length, 10);
    assert.equal(new Set(picked.map(p => p.id)).size, 10);
  });

  it('caps reinforcement (previously-correct) to a small fraction of the session', () => {
    // 40 mastered questions + 10 fresh-wrong. A 10-question session should be
    // dominated by the wrong bucket, with at most ~2 reinforcement picks.
    const questions = [
      ...Array.from({ length: 40 }, (_, i) => q(`c${i}`, 'RAG')),
      ...Array.from({ length: 10 }, (_, i) => q(`w${i}`, 'RAG')),
    ];
    const stats = new Map<string, QuestionStats>();
    for (let i = 0; i < 40; i++) stats.set(`c${i}`, stat({ times_seen: 3, times_correct: 3, last_result: 'correct', masteryScore: 1 }));
    for (let i = 0; i < 10; i++) stats.set(`w${i}`, stat({ times_seen: 1, times_wrong: 1, last_result: 'wrong', masteryScore: 0 }));

    const cands = buildCandidates(questions, stats, new Set(['RAG']));
    const picked = sampleFocus(cands, 10, seededRng(99));
    const reinforced = picked.filter(p => p.id.startsWith('c')).length;
    assert.ok(reinforced <= 2, `expected <=2 reinforcement picks, got ${reinforced}`);
  });

  it('fills the session even when only reinforcement questions remain', () => {
    const questions = Array.from({ length: 5 }, (_, i) => q(`c${i}`, 'RAG'));
    const stats = new Map<string, QuestionStats>();
    for (let i = 0; i < 5; i++) stats.set(`c${i}`, stat({ times_seen: 3, times_correct: 3, last_result: 'correct', masteryScore: 1 }));
    const cands = buildCandidates(questions, stats, new Set());
    const picked = sampleFocus(cands, 5, seededRng(3));
    assert.equal(picked.length, 5);
  });
});
