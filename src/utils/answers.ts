/**
 * Shared answer-handling utilities used by both practice and exam modes.
 * Pure functions — no I/O, no side effects.
 */

/**
 * Parse a user's raw answer string into a sorted array of uppercase option keys.
 * Accepts: "A", "A B", "A,B", "A, B", "a b", "a,b"
 */
export function parseAnswer(input: string): string[] {
  return input
    .toUpperCase()
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .sort();
}

/**
 * Return true when userAnswers matches correctAnswers exactly (order-insensitive).
 * Does NOT mutate either argument.
 */
export function answersCorrect(userAnswers: string[], correctAnswers: string[]): boolean {
  if (userAnswers.length !== correctAnswers.length) return false;
  const sortedUser    = [...userAnswers].sort();
  const sortedCorrect = [...correctAnswers].sort();
  return sortedCorrect.every((k, i) => k === sortedUser[i]);
}
