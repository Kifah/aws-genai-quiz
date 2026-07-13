import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';

// Point loader at the real questions directory
process.chdir(path.join(__dirname, '..'));

import { loadQuestions, sampleProportional, shuffle } from '../src/loader';
import { DOMAINS } from '../src/config';

const REQUIRED = [
  'id', 'domain', 'task_statement', 'topic', 'difficulty',
  'question_text', 'question_type', 'options', 'correct_answers', 'explanation',
] as const;

// ── loadQuestions ────────────────────────────────────────────────────────────

describe('loadQuestions', () => {
  it('loads all questions when no filter is applied', () => {
    const qs = loadQuestions();
    assert.ok(qs.length > 0, 'should return at least one question');
  });

  it('loads only domain-1 questions when filtered', () => {
    const qs = loadQuestions([1]);
    assert.ok(qs.length > 0, 'should return questions');
    assert.ok(qs.every(q => q.domain === 1), 'all questions should be domain 1');
  });

  it('loads only domain-3 and domain-5 questions when filtered', () => {
    const qs = loadQuestions([3, 5]);
    assert.ok(qs.length > 0);
    assert.ok(qs.every(q => q.domain === 3 || q.domain === 5));
  });

  it('returns empty array for a domain filter with no matching files', () => {
    const qs = loadQuestions([99]);
    assert.equal(qs.length, 0);
  });

  it('every question has required fields', () => {
    const qs = loadQuestions();
    for (const q of qs) {
      for (const field of REQUIRED) {
        assert.ok(
          q[field] !== undefined && q[field] !== null && q[field] !== '',
          `Question ${q.id} missing field: ${field}`,
        );
      }
    }
  });

  it('correct_answers keys exist in options for every question', () => {
    const qs = loadQuestions();
    for (const q of qs) {
      const optionKeys = new Set(q.options.map(o => o.key));
      for (const key of q.correct_answers) {
        assert.ok(optionKeys.has(key),
          `Question ${q.id}: correct_answer key "${key}" not in options`);
      }
    }
  });

  it('single questions have exactly 1 correct answer', () => {
    const qs = loadQuestions().filter(q => q.question_type === 'single');
    for (const q of qs) {
      assert.equal(q.correct_answers.length, 1,
        `Single question ${q.id} must have exactly 1 correct answer`);
    }
  });

  it('multi questions have 2 or more correct answers', () => {
    const qs = loadQuestions().filter(q => q.question_type === 'multi');
    for (const q of qs) {
      assert.ok(q.correct_answers.length >= 2,
        `Multi question ${q.id} must have at least 2 correct answers`);
    }
  });

  it('all question IDs are unique', () => {
    const qs = loadQuestions();
    const ids = qs.map(q => q.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, 'Duplicate question IDs found');
  });
});

// ── sampleProportional ───────────────────────────────────────────────────────

describe('sampleProportional', () => {
  it('returns exactly the requested number of questions', () => {
    const qs      = loadQuestions();
    const sampled = sampleProportional(qs, 65, DOMAINS);
    assert.equal(sampled.length, 65);
  });

  it('includes questions from all 5 domains', () => {
    const qs      = loadQuestions();
    const sampled = sampleProportional(qs, 65, DOMAINS);
    const domains = new Set(sampled.map(q => q.domain));
    assert.ok(domains.size === 5, `Expected 5 domains, got ${domains.size}`);
  });

  it('does not return more questions per domain than are available', () => {
    const qs      = loadQuestions();
    const sampled = sampleProportional(qs, 10, DOMAINS);
    assert.ok(sampled.length <= 10);
  });

  it('handles small pool gracefully — fewer questions than requested', () => {
    const tiny    = loadQuestions([5]); // smallest domain
    const sampled = sampleProportional(tiny, 65, DOMAINS);
    assert.ok(sampled.length <= 65);
  });
});

// ── shuffle ──────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns the same array reference', () => {
    const arr    = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    assert.equal(result, arr);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    assert.deepEqual([...arr].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });

  it('handles empty array without error', () => {
    assert.doesNotThrow(() => shuffle([]));
  });

  it('handles single-element array without error', () => {
    const arr = ['only'];
    shuffle(arr);
    assert.equal(arr[0], 'only');
  });
});
