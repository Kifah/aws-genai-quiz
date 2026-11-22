import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AttemptRecord,
  masteryFromAttempts,
  computeQuestionStats,
  rollUpByTopic,
  rollUpByDomain,
  weakestGroups,
  priorityCoverageGaps,
} from '../src/history';
import { Question } from '../src/loader';

function attempt(qid: string, ts: string, correct: boolean): AttemptRecord {
  return { exam_id: 'aws', question_id: qid, timestamp: ts, was_correct: correct, selected: ['A'], mode: 'practice', session_id: 's1' };
}

function q(id: string, domain: number, topic: string): Question {
  return {
    id, domain, task_statement: `${domain}.1`, topic, difficulty: 'easy',
    question_text: 'x', question_type: 'single',
    options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
    correct_answers: ['A'], explanation: 'because',
  };
}

describe('masteryFromAttempts', () => {
  it('returns null for no attempts', () => {
    assert.equal(masteryFromAttempts([]), null);
  });

  it('returns 1 for a single correct attempt', () => {
    assert.equal(masteryFromAttempts([attempt('q1', '2026-01-01T00:00:00Z', true)]), 1);
  });

  it('returns 0 for a single wrong attempt', () => {
    assert.equal(masteryFromAttempts([attempt('q1', '2026-01-01T00:00:00Z', false)]), 0);
  });

  it('a recent wrong pulls mastery below 0.5 even after an old correct', () => {
    const m = masteryFromAttempts([
      attempt('q1', '2026-01-01T00:00:00Z', true),
      attempt('q1', '2026-02-01T00:00:00Z', false),
    ]);
    assert.ok(m !== null && m < 0.5, `expected < 0.5, got ${m}`);
  });

  it('a recent correct after an old wrong scores above 0.5 (recency favors recent)', () => {
    const m = masteryFromAttempts([
      attempt('q1', '2026-01-01T00:00:00Z', false),
      attempt('q1', '2026-02-01T00:00:00Z', true),
    ]);
    assert.ok(m !== null && m > 0.5, `expected > 0.5, got ${m}`);
  });

  it('is order-weighted: recent result dominates symmetric history', () => {
    const recentWrong = masteryFromAttempts([
      attempt('q1', '2026-01-01T00:00:00Z', true),
      attempt('q1', '2026-01-02T00:00:00Z', false),
    ]);
    const recentCorrect = masteryFromAttempts([
      attempt('q1', '2026-01-01T00:00:00Z', false),
      attempt('q1', '2026-01-02T00:00:00Z', true),
    ]);
    assert.ok(recentWrong! < recentCorrect!);
  });
});

describe('computeQuestionStats', () => {
  it('aggregates seen/correct/wrong and last_result', () => {
    const stats = computeQuestionStats([
      attempt('q1', '2026-01-01T00:00:00Z', true),
      attempt('q1', '2026-01-02T00:00:00Z', false),
      attempt('q1', '2026-01-03T00:00:00Z', false),
    ]);
    const s = stats.get('q1')!;
    assert.equal(s.times_seen, 3);
    assert.equal(s.times_correct, 1);
    assert.equal(s.times_wrong, 2);
    assert.equal(s.last_result, 'wrong');
    assert.equal(s.last_attempted_at, '2026-01-03T00:00:00Z');
  });

  it('sorts chronologically regardless of input order', () => {
    const stats = computeQuestionStats([
      attempt('q1', '2026-01-03T00:00:00Z', true),
      attempt('q1', '2026-01-01T00:00:00Z', false),
    ]);
    assert.equal(stats.get('q1')!.last_result, 'correct');
    assert.equal(stats.get('q1')!.last_attempted_at, '2026-01-03T00:00:00Z');
  });

  it('separates distinct question ids', () => {
    const stats = computeQuestionStats([
      attempt('q1', '2026-01-01T00:00:00Z', true),
      attempt('q2', '2026-01-01T00:00:00Z', false),
    ]);
    assert.equal(stats.size, 2);
    assert.equal(stats.get('q2')!.times_wrong, 1);
  });
});

describe('rollUp by topic and domain', () => {
  const questions = [q('q1', 1, 'RAG'), q('q2', 1, 'RAG'), q('q3', 2, 'Agents')];

  it('rolls up attempts by topic and counts never-attempted', () => {
    const stats = computeQuestionStats([attempt('q1', '2026-01-01T00:00:00Z', true)]);
    const byTopic = rollUpByTopic(questions, stats);
    const rag = byTopic.get('RAG')!;
    assert.equal(rag.questionIds.length, 2);
    assert.equal(rag.neverAttempted, 1);
    assert.equal(rag.times_correct, 1);
    assert.equal(rag.times_seen, 1);
  });

  it('rolls up by domain with accuracy', () => {
    const stats = computeQuestionStats([
      attempt('q1', '2026-01-01T00:00:00Z', true),
      attempt('q2', '2026-01-01T00:00:00Z', false),
    ]);
    const byDomain = rollUpByDomain(questions, stats);
    const d1 = byDomain.get('1')!;
    assert.equal(d1.times_seen, 2);
    assert.equal(d1.accuracy, 0.5);
    assert.equal(byDomain.get('2')!.accuracy, null);
  });
});

describe('weakestGroups', () => {
  const questions = [q('q1', 1, 'RAG'), q('q2', 2, 'Agents'), q('q3', 3, 'Safety')];

  it('ranks attempted groups by lowest mastery first', () => {
    const stats = computeQuestionStats([
      attempt('q1', '2026-01-01T00:00:00Z', false), // RAG mastery 0
      attempt('q2', '2026-01-01T00:00:00Z', true),  // Agents mastery 1
    ]);
    const byTopic = rollUpByTopic(questions, stats);
    const weak = weakestGroups(byTopic, 5, false);
    assert.equal(weak[0].key, 'RAG');
  });

  it('excludes never-attempted unless requested', () => {
    const stats = computeQuestionStats([attempt('q1', '2026-01-01T00:00:00Z', true)]);
    const byTopic = rollUpByTopic(questions, stats);
    const withoutNever = weakestGroups(byTopic, 5, false);
    assert.ok(!withoutNever.some(g => g.key === 'Safety'));
    const withNever = weakestGroups(byTopic, 5, true);
    assert.ok(withNever.some(g => g.key === 'Safety'));
  });
});

describe('priorityCoverageGaps', () => {
  it('flags thin AND weak topics', () => {
    const questions = [q('q1', 1, 'ThinWeak'), q('q2', 2, 'ThinStrong')];
    const stats = computeQuestionStats([
      attempt('q1', '2026-01-01T00:00:00Z', false),
      attempt('q2', '2026-01-01T00:00:00Z', true),
    ]);
    const byTopic = rollUpByTopic(questions, stats);
    const gaps = priorityCoverageGaps(byTopic, 5, 0.6);
    assert.ok(gaps.some(g => g.topic === 'ThinWeak'));
    assert.ok(!gaps.some(g => g.topic === 'ThinStrong'));
  });
});
