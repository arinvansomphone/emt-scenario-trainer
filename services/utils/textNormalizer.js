// services/utils/textNormalizer.js
class TextNormalizer {
  /**
   * Normalize text to ASCII lowercase for consistent pattern matching
   * @param {string} text - The text to normalize
   * @returns {string} - Normalized text
   */
  static normalizeToAsciiLower(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Compute a deterministic integer from text for consistent random-like values
   * @param {string} seedText - Text to use as seed
   * @param {number} minInclusive - Minimum value (inclusive)
   * @param {number} maxInclusive - Maximum value (inclusive)
   * @returns {number} - Deterministic integer in range
   */
  static computeDeterministicInt(seedText, minInclusive, maxInclusive) {
    const text = String(seedText || 'seed');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    const span = Math.max(1, maxInclusive - minInclusive + 1);
    return minInclusive + (hash % span);
  }

  /**
   * Pick a deterministic option from an array based on seed text
   * @param {string} seedText - Text to use as seed
   * @param {Array} options - Array of options to choose from
   * @returns {*} - Selected option
   */
  static pickDeterministicOption(seedText, options) {
    if (!options || options.length === 0) return null;
    const index = this.computeDeterministicInt(seedText, 0, options.length - 1);
    return options[index];
  }
}

module.exports = TextNormalizer;
