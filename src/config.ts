/**
 * Exam and domain configuration for AIP-C01
 */

export interface DomainConfig {
  name: string;
  weight: number;
  tasks: string[];
}

export interface ExamConfig {
  totalScoredQuestions: number;
  totalQuestions: number;
  durationMinutes: number;
  passingThreshold: number;
  passingScore: number;
  scoreScale: [number, number];
}

export const DOMAINS: Record<number, DomainConfig> = {
  1: {
    name: 'Foundation Model Integration, Data Management, and Compliance',
    weight: 0.31,
    tasks: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'],
  },
  2: {
    name: 'Implementation and Integration',
    weight: 0.26,
    tasks: ['2.1', '2.2', '2.3', '2.4', '2.5'],
  },
  3: {
    name: 'AI Safety, Security, and Governance',
    weight: 0.20,
    tasks: ['3.1', '3.2', '3.3', '3.4'],
  },
  4: {
    name: 'Operational Efficiency and Optimization for GenAI Applications',
    weight: 0.12,
    tasks: ['4.1', '4.2', '4.3'],
  },
  5: {
    name: 'Testing, Validation, and Troubleshooting',
    weight: 0.11,
    tasks: ['5.1', '5.2'],
  },
};

export const EXAM_CONFIG: ExamConfig = {
  totalScoredQuestions: 65,
  totalQuestions: 75, // 65 scored + 10 unscored (per official AWS guide)
  durationMinutes: 205,
  passingThreshold: 0.75,
  passingScore: 750,
  scoreScale: [100, 1000],
};
