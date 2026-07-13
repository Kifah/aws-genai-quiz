import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseAnswer, answersCorrect } from '../src/utils/answers';

// ── parseAnswer ───────────────────────────────────────────────────────────────

describe('parseAnswer', () => {
  it('parses a single letter', () => {
    assert.deepEqual(parseAnswer('A'), ['A']);
  });

  it('upcases input', () => {
    assert.deepEqual(parseAnswer('b'), ['B']);
  });

  it('parses space-separated letters and sorts them', () => {
    assert.deepEqual(parseAnswer('C A'), ['A', 'C']);
  });

  it('parses comma-separated letters', () => {
    assert.deepEqual(parseAnswer('A,C'), ['A', 'C']);
  });

  it('parses comma-and-space-separated letters', () => {
    assert.deepEqual(parseAnswer('B, D'), ['B', 'D']);
  });

  it('returns empty array for blank input', () => {
    assert.deepEqual(parseAnswer(''), []);
  });

  it('returns empty array for whitespace-only input', () => {
    assert.deepEqual(parseAnswer('   '), []);
  });

  it('deduplication is NOT performed — duplicates pass through sorted', () => {
    assert.deepEqual(parseAnswer('A A'), ['A', 'A']);
  });

  it('handles three choices', () => {
    assert.deepEqual(parseAnswer('C B A'), ['A', 'B', 'C']);
  });
});

// ── answersCorrect ────────────────────────────────────────────────────────────

describe('answersCorrect', () => {
  it('returns true when single answers match', () => {
    assert.equal(answersCorrect(['A'], ['A']), true);
  });

  it('returns false when single answer does not match', () => {
    assert.equal(answersCorrect(['B'], ['A']), false);
  });

  it('returns true when multi-answers match regardless of input order', () => {
    assert.equal(answersCorrect(['C', 'A'], ['A', 'C']), true);
  });

  it('returns false when one of the multi-answers is wrong', () => {
    assert.equal(answersCorrect(['A', 'D'], ['A', 'C']), false);
  });

  it('returns false when lengths differ', () => {
    assert.equal(answersCorrect(['A'], ['A', 'C']), false);
  });

  it('does NOT mutate the userAnswers argument', () => {
    const user    = ['C', 'A'];
    const correct = ['A', 'C'];
    answersCorrect(user, correct);
    assert.deepEqual(user,    ['C', 'A']);
    assert.deepEqual(correct, ['A', 'C']);
  });

  it('does NOT mutate the correctAnswers argument', () => {
    const correct = ['B', 'A'];
    answersCorrect(['A', 'B'], correct);
    assert.deepEqual(correct, ['B', 'A']);
  });

  it('returns true for three-way match', () => {
    assert.equal(answersCorrect(['B', 'C', 'A'], ['A', 'B', 'C']), true);
  });

  it('returns false for empty vs non-empty', () => {
    assert.equal(answersCorrect([], ['A']), false);
  });

  it('returns true for two empty arrays', () => {
    assert.equal(answersCorrect([], []), true);
  });
});
