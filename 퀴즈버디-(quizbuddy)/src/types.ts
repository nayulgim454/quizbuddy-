/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UnderstandingLevel {
  GUESSED = 1,
  NOT_SURE = 2,
  PERFECT = 3
}

export enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard"
}

export enum QuestionType {
  MULTIPLE_CHOICE = "multiple_choice",
  SUBJECTIVE = "subjective",
  FILL_IN_THE_BLANKS = "fill_in_the_blanks",
  ESSAY = "essay"
}

export interface QuizQuestion {
  id: string;
  topic: string;
  question: string;
  options?: string[]; // Optional for subjective
  correctAnswer: string;
  explanation: string;
  type: QuestionType;
  difficulty: Difficulty;
}

export enum UserStatus {
  LEARNING = "learning",
  RESTING = "resting",
  OFFLINE = "offline"
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  status: UserStatus;
  lastSeen: string;
}

export interface Friendship {
  id?: string;
  users: string[];
  createdAt: string;
}
export interface UserProgress {
  userId: string;
  topicMastery: Record<string, {
    level: UnderstandingLevel;
    lastReviewed: number;
    points: number;
  }>;
  totalCredits: number;
  dailyStreak: number;
  lastActive: number;
  achievements: string[];
}
