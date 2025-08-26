/* eslint-disable no-console */
const path = require('path');
const pdfProcessor = require('../services/pdfProcessor');

(async () => {
  try {
    const pdfDir = path.join(__dirname, '..', 'pdfs');
    const processed = await pdfProcessor.processPDFDirectory(pdfDir);

    for (const [name, data] of processed) {
      const text = data.content || '';
      const totalChars = text.length;
      const firstChunk = text.slice(0, 2000);
      const firstChars = firstChunk.length;
      const firstWords = (firstChunk.trim().match(/\S+/g) || []).length;
      const coveragePct = totalChars === 0 ? 0 : (firstChars / totalChars) * 100;

      console.log(`${data.originalFile}`);
      console.log(`- total_chars: ${totalChars}`);
      console.log(`- first_chunk_chars: ${firstChars}`);
      console.log(`- first_chunk_words: ${firstWords}`);
      console.log(`- coverage_percent: ${coveragePct.toFixed(1)}%`);
      console.log('');
    }
  } catch (err) {
    console.error('Error measuring PDFs:', err.message);
    process.exit(1);
  }
})();



