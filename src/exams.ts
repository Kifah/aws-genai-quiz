/**
 * Exam registry — one entry per supported certification exam.
 * Mode runners import ExamDefinition and EXAMS from here instead of
 * hardcoding AWS-specific config constants.
 */

import { DOMAINS, EXAM_CONFIG, DomainConfig, ExamConfig } from './config';

export interface ExamDefinition {
  exam_id:     string;
  displayName: string;
  shortName:   string;
  questionsDir: string;
  domains:     Record<number, DomainConfig>;
  examConfig:  ExamConfig;
}

export const EXAMS: Record<string, ExamDefinition> = {

  aws: {
    exam_id:      'aws',
    displayName:  'AWS Certified AI Practitioner',
    shortName:    'AIP-C01',
    questionsDir: 'questions/aws',
    domains:      DOMAINS,
    examConfig:   EXAM_CONFIG,
  },

  claude: {
    exam_id:      'claude',
    displayName:  'Claude Certified Architect – Professional',
    shortName:    'CCAR-P',
    questionsDir: 'questions/claude',
    domains: {
      1: {
        name:   'Solution Design & Architecture',
        weight: 0.17,
        tasks:  ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'],
      },
      2: {
        name:   'Claude Models, Prompting & Context Engineering',
        weight: 0.13,
        tasks:  ['2.1', '2.2', '2.3', '2.4'],
      },
      3: {
        name:   'Integration',
        weight: 0.19,
        tasks:  ['3.1', '3.2', '3.3', '3.4', '3.5'],
      },
      4: {
        name:   'Evaluation, Testing & Optimization',
        weight: 0.16,
        tasks:  ['4.1', '4.2', '4.3', '4.4'],
      },
      5: {
        name:   'Governance, Safety & Risk Management',
        weight: 0.14,
        tasks:  ['5.1', '5.2', '5.3'],
      },
      6: {
        name:   'Stakeholder Communication & Lifecycle Management',
        weight: 0.14,
        tasks:  ['6.1', '6.2', '6.3'],
      },
      7: {
        name:   'Developer Productivity & Operational Enablement',
        weight: 0.07,
        tasks:  ['7.1', '7.2'],
      },
    },
    examConfig: {
      totalScoredQuestions: 63,
      totalQuestions:       63,
      durationMinutes:      120,
      passingThreshold:     0.72,
      passingScore:         720,
      scoreScale:           [100, 1000],
    },
  },

};
