import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';

const AWS_DIR = path.join(__dirname, '..', 'questions', 'aws');

import {
  loadQuestions,
  Question,
  priorityOf,
  isPendingPriority,
  pendingPriority,
  prioritizeFirst,
  sampleProportional,
} from '../src/loader';
import { DOMAINS } from '../src/config';
import { validateQuestion } from '../src/validator';

function q(id: string, priority?: number, domain = 1): Question {
  return {
    id,
    domain,
    task_statement:  '1.1',
    topic:           'T',
    difficulty:      'medium',
    question_text:   'Q?',
    question_type:   'single',
    options:         [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
    correct_answers: ['A'],
    explanation:     'A is right because of the requirements given in the question.',
    ...(priority === undefined ? {} : { priority }),
  };
}

describe('priorityOf / isPendingPriority', () => {
  it('defaults to 1 when the field is missing', () => {
    assert.equal(priorityOf(q('a')), 1);
  });

  it('is pending only when priority > 1 and unattempted', () => {
    assert.equal(isPendingPriority(q('a', 5), new Set()), true);
    assert.equal(isPendingPriority(q('a', 5), new Set(['a'])), false);
    assert.equal(isPendingPriority(q('a'), new Set()), false);
    assert.equal(isPendingPriority(q('a', 1), new Set()), false);
  });
});

describe('pendingPriority / prioritizeFirst', () => {
  const pool = [q('n1'), q('p1', 5), q('n2'), q('p2', 5), q('mid', 3)];

  it('puts higher priority first and drops attempted ones', () => {
    const ids = pendingPriority(pool, new Set(['p2'])).map(x => x.id);
    assert.deepEqual(ids, ['p1', 'mid']);
  });

  it('keeps every question and puts pending priority ones first', () => {
    const out = prioritizeFirst(pool, new Set());
    assert.equal(out.length, pool.length);
    assert.deepEqual(out.slice(0, 3).map(x => x.id).sort(), ['mid', 'p1', 'p2']);
    assert.deepEqual(out.slice(3).map(x => x.id), ['n1', 'n2']);
  });

  it('falls back to the original order once all priority questions are attempted', () => {
    const out = prioritizeFirst(pool, new Set(['p1', 'p2', 'mid']));
    assert.deepEqual(out.map(x => x.id), pool.map(x => x.id));
  });
});

describe('sampleProportional with priority', () => {
  const pool: Question[] = [];
  for (let d = 1; d <= 5; d++) {
    for (let i = 0; i < 30; i++) pool.push(q(`d${d}-n${i}`, undefined, d));
    for (let i = 0; i < 3; i++)  pool.push(q(`d${d}-p${i}`, 5, d));
  }

  it('puts unattempted priority questions at the start of the exam', () => {
    const out   = sampleProportional(pool, 65, DOMAINS, new Set());
    const lead  = out.findIndex(x => priorityOf(x) === 1);
    const count = out.filter(x => priorityOf(x) > 1).length;
    assert.equal(out.length, 65);
    assert.ok(count > 0);
    assert.equal(lead, count, 'all priority questions precede every normal question');
  });

  it('does not favour priority questions that were already attempted', () => {
    const attempted = new Set(pool.filter(x => priorityOf(x) > 1).map(x => x.id));
    const out = sampleProportional(pool, 65, DOMAINS, attempted);
    assert.equal(out.length, 65);
  });
});

describe('seminar question bank', () => {
  const seminar = loadQuestions(AWS_DIR).filter(x => x.source === 'seminar');

  it('loads all 126 seminar questions at priority 5', () => {
    assert.equal(seminar.length, 126);
    assert.ok(seminar.every(x => x.priority === 5));
  });

  it('keeps every non-seminar question at the default priority', () => {
    const rest = loadQuestions(AWS_DIR).filter(x => x.source !== 'seminar');
    assert.ok(rest.length > 0);
    assert.ok(rest.every(x => priorityOf(x) === 1));
  });

  it('matches the source file verbatim (text, options, correct answers)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = require('../questions/sources/aws-aip-c01-seminar.json') as {
      questions: Array<{ id: number; question: string; options: Record<string, string>; correct_answer: string[] }>;
    };
    const bySeminarId = new Map(seminar.map(x => [x.seminar_id, x]));
    for (const s of src.questions) {
      const got = bySeminarId.get(s.id);
      assert.ok(got, `seminar #${s.id} missing`);
      assert.equal(got!.question_text, s.question.replace(/^Que:\s*\d+\s+/, ''), `#${s.id} text`);
      assert.deepEqual(got!.options.map(o => [o.key, o.text]), Object.entries(s.options), `#${s.id} options`);
      assert.deepEqual(got!.correct_answers, s.correct_answer, `#${s.id} answers`);
    }
  });

  it('every explanation is substantive', () => {
    assert.ok(seminar.every(x => x.explanation.length >= 100));
  });
});

describe('validator priority rule', () => {
  const base = (priority: unknown): Record<string, unknown> => ({ ...q('d1-q0001'), priority });

  it('accepts integers 1-5', () => {
    for (const p of [1, 3, 5]) {
      const { errors } = validateQuestion(base(p), 0, 1, 'domain-1-seminar.json', new Set());
      assert.equal(errors.length, 0, `priority ${p}`);
    }
  });

  it('rejects out-of-range and non-integer priorities', () => {
    for (const p of [0, 6, 2.5, '5']) {
      const { errors } = validateQuestion(base(p), 0, 1, 'domain-1-seminar.json', new Set());
      assert.ok(errors.some(e => e.includes('invalid priority')), `priority ${String(p)}`);
    }
  });
});
