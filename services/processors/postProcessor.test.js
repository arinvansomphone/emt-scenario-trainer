// services/processors/postProcessor.test.js
const PostProcessor = require('./postProcessor');

describe('PostProcessor', () => {
  describe('userRequestedAuscultation', () => {
    test('should detect auscultation request', () => {
      expect(PostProcessor.userRequestedAuscultation('listen to lung sounds')).toBe(true);
      expect(PostProcessor.userRequestedAuscultation('auscultate chest')).toBe(true);
    });

    test('should not detect auscultation request', () => {
      expect(PostProcessor.userRequestedAuscultation('check pulse')).toBe(false);
    });
  });

  describe('postProcessObjectiveContent', () => {
    test('should remove second-person narration', () => {
      const input = 'You observe the patient is breathing normally.';
      const result = PostProcessor.postProcessObjectiveContent(input, 'test');
      expect(result).not.toContain('You observe');
    });

    test('should add awaiting message if missing', () => {
      const input = 'Patient is stable.';
      const result = PostProcessor.postProcessObjectiveContent(input, 'test');
      expect(result).toContain('Awaiting your next step');
    });
  });
});
