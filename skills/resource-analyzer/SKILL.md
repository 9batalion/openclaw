---
name: resource-analyzer
description: Analyze various types of resources including text (sentiment, keywords, summaries), images (object recognition, OCR, metadata), and numeric data (statistics, trends, anomalies). Generate visual reports with charts and dashboards in Markdown/HTML format.
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "requires": {},
      },
  }
---

# Resource Analyzer

Comprehensive analysis tool for multiple data types with automated report generation.

## When to Use

Use this skill when you need to:

- Analyze text content for sentiment, keywords, or summaries
- Extract information from images using OCR or object recognition
- Process numeric datasets to identify trends, anomalies, or statistics
- Generate visual reports with charts and dashboards
- Combine multiple analysis types in a single workflow

## Quick Start

### Text Analysis

```typescript
import { analyzeText } from './resource-analyzer';

const result = await analyzeText({
  content: 'Your text content here',
  options: {
    sentiment: true,
    keywords: true,
    summary: true
  }
});
```

### Image Analysis

```typescript
import { analyzeImage } from './resource-analyzer';

const result = await analyzeImage({
  path: '/path/to/image.jpg',
  options: {
    objectRecognition: true,
    ocr: true,
    extractMetadata: true
  }
});
```

### Numeric Analysis

```typescript
import { analyzeNumeric } from './resource-analyzer';

const result = await analyzeNumeric({
  data: [1, 2, 3, 4, 5, 100],
  options: {
    statistics: true,
    trends: true,
    detectAnomalies: true
  }
});
```

## Report Generation

Generate comprehensive reports combining multiple analyses:

```typescript
import { generateReport } from './resource-analyzer';

const report = await generateReport({
  analyses: [textResult, imageResult, numericResult],
  format: 'markdown', // or 'html'
  includeCharts: true,
  includeDashboard: true
});
```

## Features

### Text Analysis
- **Sentiment analysis**: Detect positive, negative, or neutral sentiment
- **Keyword extraction**: Identify important terms and phrases
- **Summarization**: Generate concise summaries of long content
- **Language detection**: Identify the language of text

### Image Analysis
- **Object recognition**: Detect and classify objects in images
- **OCR (Optical Character Recognition)**: Extract text from images
- **Metadata extraction**: Read EXIF and other image metadata
- **Face detection**: Identify faces in images (privacy-aware)

### Numeric Analysis
- **Statistics**: Calculate mean, median, mode, standard deviation
- **Trend detection**: Identify upward or downward trends
- **Anomaly detection**: Find outliers and unusual patterns
- **Time series analysis**: Analyze data over time

### Report Generation
- **Multiple formats**: Markdown and HTML output
- **Charts and graphs**: Visual representation of data
- **Interactive dashboards**: Combine multiple visualizations
- **Export options**: Save reports to files or return as strings

## Configuration

Optional configuration can be provided via environment variables:

- `RESOURCE_ANALYZER_MODEL`: AI model for text analysis (default: uses available model)
- `RESOURCE_ANALYZER_MAX_TOKENS`: Maximum tokens for text processing
- `RESOURCE_ANALYZER_CACHE_DIR`: Directory for caching analysis results

## Advanced Usage

### Batch Analysis

Process multiple resources in a single operation:

```typescript
import { analyzeBatch } from './resource-analyzer';

const results = await analyzeBatch([
  { type: 'text', content: 'Text 1' },
  { type: 'image', path: '/path/to/image.jpg' },
  { type: 'numeric', data: [1, 2, 3] }
]);
```

### Custom Analyzers

Extend the analyzer with custom analysis functions:

```typescript
import { registerAnalyzer } from './resource-analyzer';

registerAnalyzer('custom-type', async (resource) => {
  // Custom analysis logic
  return { result: 'custom analysis' };
});
```

## Output Format

All analysis functions return a consistent structure:

```typescript
{
  success: boolean;
  type: 'text' | 'image' | 'numeric';
  results: {
    // Type-specific results
  };
  metadata: {
    timestamp: string;
    duration: number;
    version: string;
  };
  error?: string;
}
```

## Error Handling

The analyzer includes comprehensive error handling:

- Invalid input validation
- Graceful degradation when features are unavailable
- Detailed error messages for debugging
- Fallback options for failed analyses

## Performance

- Lazy loading of analysis modules
- Caching of intermediate results
- Parallel processing for batch operations
- Memory-efficient streaming for large files

## Dependencies

The skill uses standard TypeScript/Node.js features and does not require external services by default. Optional integrations can enhance functionality:

- Image processing libraries (optional)
- ML models for advanced analysis (optional)
- Charting libraries for reports (optional)
