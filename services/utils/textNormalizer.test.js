// services/utils/textNormalizer.test.js
const TextNormalizer = require('./textNormalizer');

describe('TextNormalizer', () => {
  describe('normalizeToAsciiLower', () => {
    test('should normalize text to lowercase ASCII', () => {
      expect(TextNormalizer.normalizeToAsciiLower('Hello World')).toBe('hello world');
      expect(TextNormalizer.normalizeToAsciiLower('Café')).toBe('cafe');
      expect(TextNormalizer.normalizeToAsciiLower('  Multiple   Spaces  ')).toBe('multiple spaces');
    });

    test('should handle null and undefined', () => {
      expect(TextNormalizer.normalizeToAsciiLower(null)).toBe('');
      expect(TextNormalizer.normalizeToAsciiLower(undefined)).toBe('');
    });
  });

  describe('computeDeterministicInt', () => {
    test('should return consistent values for same input', () => {
      const result1 = TextNormalizer.computeDeterministicInt('test', 1, 10);
      const result2 = TextNormalizer.computeDeterministicInt('test', 1, 10);
      expect(result1).toBe(result2);
    });

    test('should return values within specified range', () => {
      const result = TextNormalizer.computeDeterministicInt('test', 5, 15);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(15);
    });
  });

  describe('pickDeterministicOption', () => {
    test('should return consistent option for same input', () => {
      const options = ['a', 'b', 'c'];
      const result1 = TextNormalizer.pickDeterministicOption('test', options);
      const result2 = TextNormalizer.pickDeterministicOption('test', options);
      expect(result1).toBe(result2);
    });

    test('should return null for empty array', () => {
      expect(TextNormalizer.pickDeterministicOption('test', [])).toBeNull();
    });
  });
});
