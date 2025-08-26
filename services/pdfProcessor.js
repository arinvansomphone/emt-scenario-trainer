// services/pdfProcessor.js
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const path = require('path');

class PDFProcessor {
  constructor() {
    this.processedPDFs = new Map();
    this.lastCacheTime = null;
    this.cachedDirectory = null;
  }

  // Extract text from a single PDF
  async extractTextFromPDF(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdf(dataBuffer);
      
      return {
        text: data.text,
        pages: data.numpages,
        info: data.info
      };
    } catch (error) {
      console.error(`Error processing PDF ${pdfPath}:`, error.message);
      throw error;
    }
  }

  // Process all PDFs in a directory
  async processPDFDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      const pdfFiles = files.filter(file => file.endsWith('.pdf'));

      console.log(`Found ${pdfFiles.length} PDF files to process...`);

      for (const pdfFile of pdfFiles) {
        const fullPath = path.join(dirPath, pdfFile);
        const fileName = path.basename(pdfFile, '.pdf');
        
        console.log(`Processing: ${pdfFile}...`);
        
        const extracted = await this.extractTextFromPDF(fullPath);
        
        // Clean and format the text
        const cleanText = this.cleanExtractedText(extracted.text);
        
        this.processedPDFs.set(fileName, {
          content: cleanText,
          pages: extracted.pages,
          originalFile: pdfFile,
          processedAt: new Date()
        });

        console.log(`✅ Processed: ${pdfFile} (${extracted.pages} pages)`);
      }

      return this.processedPDFs;
    } catch (error) {
      console.error('Error processing PDF directory:', error.message);
      throw error;
    }
  }

  // Clean up extracted text
  cleanExtractedText(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page breaks and form feeds
      .replace(/\f/g, '\n\n')
      // Clean up line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  // Get processed content by filename
  getProcessedContent(fileName) {
    return this.processedPDFs.get(fileName);
  }

  // Get all processed content
  getAllProcessedContent() {
    return Array.from(this.processedPDFs.entries()).map(([name, data]) => ({
      name,
      ...data
    }));
  }

  // Search through processed PDFs
  searchContent(query) {
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [name, data] of this.processedPDFs) {
      if (data.content.toLowerCase().includes(searchTerm)) {
        // Find relevant excerpts
        const excerpts = this.findRelevantExcerpts(data.content, searchTerm);
        results.push({
          fileName: name,
          excerpts,
          relevance: excerpts.length
        });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  // Find relevant text excerpts around search term
  findRelevantExcerpts(text, searchTerm, contextLength = 200) {
    const excerpts = [];
    const regex = new RegExp(searchTerm, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - contextLength);
      const end = Math.min(text.length, match.index + searchTerm.length + contextLength);
      
      excerpts.push({
        text: text.substring(start, end),
        position: match.index
      });
    }

    return excerpts;
  }

  // Load and cache knowledge base from PDF directory
  async loadKnowledgeBase(pdfDir) {
    console.log('📚 Loading knowledge base...');
    
    try {
      // Check if already processed and cache is valid
      if (this.processedPDFs.size > 0) {
        const cacheValid = await this.isCacheValid(pdfDir);
        if (cacheValid) {
          console.log('📚 Knowledge base already loaded');
          return this.formatKnowledgeBaseOutput();
        }
      }

      // Process PDFs (this will populate this.processedPDFs)
      await this.processPDFDirectory(pdfDir);
      
      // Store cache metadata
      this.lastCacheTime = Date.now();
      this.cachedDirectory = pdfDir;
      
      console.log('📖 Total PDFs loaded:', this.processedPDFs.size);
      return this.formatKnowledgeBaseOutput();
      
    } catch (error) {
      console.error('❌ Failed to load knowledge base:', error);
      throw error;
    }
  }

  // Check if cache is still valid based on file modification times
  async isCacheValid(pdfDir) {
    if (!this.lastCacheTime || !this.cachedDirectory || this.cachedDirectory !== pdfDir) {
      return false;
    }

    try {
      const files = await fs.readdir(pdfDir);
      const pdfFiles = files.filter(file => file.endsWith('.pdf'));

      for (const pdfFile of pdfFiles) {
        const fullPath = path.join(pdfDir, pdfFile);
        const stats = await fs.stat(fullPath);
        
        // If any file was modified after our cache time, invalidate cache
        if (stats.mtime.getTime() > this.lastCacheTime) {
          console.log(`📄 PDF file ${pdfFile} has been modified, invalidating cache`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  // Format processed PDFs for knowledge base output
  formatKnowledgeBaseOutput() {
    const output = {};
    
    for (const [name, data] of this.processedPDFs) {
      output[name] = {
        content: data.content,
        pages: data.pages,
        file: data.originalFile,
        processedAt: data.processedAt
      };
      
      console.log(`✅ Loaded: ${name}`);
    }
    
    return output;
  }

  // Clear cache (useful for testing or forced refresh)
  clearCache() {
    this.processedPDFs.clear();
    this.lastCacheTime = null;
    this.cachedDirectory = null;
    console.log('🧹 Knowledge base cache cleared');
  }
}

module.exports = new PDFProcessor();