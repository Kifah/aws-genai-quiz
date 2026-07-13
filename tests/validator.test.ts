import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';

const QUESTIONS_DIR = path.join(__dirname, '..', 'questions');

import {
  validateQuestion,
  validateFile,
  validateAll,
  REQUIRED_FIELDS,
  ValidationResult,
} from '../src/validator';

// ── helpers ───────────────────────────────────────────────────────────────────

type QuestionShape = Record<string, unknown>;

function makeQ(overrides: Partial<QuestionShape> = {}): QuestionShape {
  return {
    id:             'd1-q0001',
    domain:         1,
    task_statement: '1.1',
    topic:          'Test topic',
    difficulty:     'medium',
    question_text:  'What is the best answer?',
    question_type:  'single',
    options: [
      { key: 'A', text: 'Option A' },
      { key: 'B', text: 'Option B' },
      { key: 'C', text: 'Option C' },
      { key: 'D', text: 'Option D' },
    ],
    correct_answers: ['A'],
    explanation:     'A is correct because it satisfies all requirements outlined in the specification.',
    source_topic:    'AWS Bedrock',
    ...overrides,
  };
}

// ── validateQuestion ──────────────────────────────────────────────────────────

describe('validateQuestion', () => {
  it('returns no errors for a fully valid single question', () => {
    const { errors } = validateQuestion(makeQ(), 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.equal(errors.length, 0);
  });

  it('returns no errors for a fully valid multi question', () => {
    const q = makeQ({ id: 'd1-q0002', question_type: 'multi', correct_answers: ['A', 'B'] });
    const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.equal(errors.length, 0);
  });

  it('errors on each missing required field', () => {
    for (const field of REQUIRED_FIELDS) {
      const q = makeQ({ [field]: undefined });
      const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
      assert.ok(
        errors.some(e => e.includes(`missing required field "${field}"`)),
        `Expected error for missing field "${field}"`,
      );
    }
  });

  it('errors on a correct_answer key not present in options', () => {
    const q = makeQ({ correct_answers: ['Z'] });
    const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(errors.some(e => e.includes('correct_answer key "Z" not found in options')));
  });

  it('errors when single question has 2 correct answers', () => {
    const q = makeQ({ question_type: 'single', correct_answers: ['A', 'B'] });
    const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(errors.some(e => e.includes('question_type=single but correct_answers has 2 items')));
  });

  it('errors when multi question has only 1 correct answer', () => {
    const q = makeQ({ question_type: 'multi', correct_answers: ['A'] });
    const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(errors.some(e => e.includes('question_type=multi but correct_answers has only 1 item(s)')));
  });

  it('errors on invalid difficulty', () => {
    const q = makeQ({ difficulty: 'extreme' });
    const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(errors.some(e => e.includes('invalid difficulty "extreme"')));
  });

  it('errors on invalid question_type', () => {
    const q = makeQ({ question_type: 'checkbox' });
    const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(errors.some(e => e.includes('invalid question_type "checkbox"')));
  });

  it('errors on duplicate id within the same seenIds set', () => {
    const seenIds = new Set(['d1-q0001']);
    const { errors } = validateQuestion(makeQ(), 0, 1, 'domain-1-task-1.1.json', seenIds);
    assert.ok(errors.some(e => e.includes('duplicate id "d1-q0001"')));
  });

  it('adds id to seenIds after validation', () => {
    const seenIds = new Set<string>();
    validateQuestion(makeQ(), 0, 1, 'domain-1-task-1.1.json', seenIds);
    assert.ok(seenIds.has('d1-q0001'));
  });

  it('warns when id has wrong prefix', () => {
    const q = makeQ({ id: 'd2-q0001' }); // domain-1 file but d2 prefix
    const { warnings } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(warnings.some(w => w.includes('id should start with "d1-q"')));
  });

  it('warns when domain field mismatches file domain', () => {
    const q = makeQ({ domain: 3 }); // file is domain-1
    const { warnings } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(warnings.some(w => w.includes("domain field (3) doesn't match file domain (1)")));
  });

  it('warns when explanation is too short', () => {
    const q = makeQ({ explanation: 'Too short.' });
    const { warnings } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(warnings.some(w => w.includes('explanation seems very short')));
  });

  it('errors when fewer than 4 options are provided', () => {
    const q = makeQ({ options: [{ key: 'A', text: 'Only one' }] });
    const { errors } = validateQuestion(q, 0, 1, 'domain-1-task-1.1.json', new Set());
    assert.ok(errors.some(e => e.includes('at least 4 items')));
  });
});

// ── validateAll (integration — reads real question files) ─────────────────────

describe('validateAll (real question bank)', () => {
  let result: ValidationResult;

  before(() => {
    result = validateAll(QUESTIONS_DIR);
  });

  it('finds all question files', () => {
    assert.ok(result.fileResults.length > 0, 'should find at least one file');
  });

  it('reports zero errors across the entire question bank', () => {
    assert.equal(
      result.totalErrors, 0,
      `Expected 0 errors but got ${result.totalErrors}:\n` +
      result.fileResults.flatMap(r => r.errors).join('\n'),
    );
  });

  it('counts questions correctly — total matches sum of per-file counts', () => {
    const sumFromFiles = result.fileResults.reduce((n, r) => n + r.count, 0);
    assert.equal(result.totalQuestions, sumFromFiles);
  });

  it('reports domain counts for all 5 domains', () => {
    for (let d = 1; d <= 5; d++) {
      assert.ok(
        (result.domainCounts[d] ?? 0) > 0,
        `Domain ${d} should have at least 1 question`,
      );
    }
  });
});
