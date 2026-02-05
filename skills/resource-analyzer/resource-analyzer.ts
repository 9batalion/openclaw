import type {
  AnalysisResult,
  AnalyzerFunction,
  AnalyzerRegistry,
  BatchInput,
  BatchResult,
  ImageAnalysisInput,
  NumericAnalysisInput,
  Report,
  ReportOptions,
  TextAnalysisInput,
} from "./types.ts";

import { analyzeText } from "./analyzers/text-analyzer.ts";
import { analyzeImage } from "./analyzers/image-analyzer.ts";
import { analyzeNumeric } from "./analyzers/numeric-analyzer.ts";
import { generateReport } from "./reports/report-generator.ts";

const VERSION = "1.0.0";

// Custom analyzer registry
const customAnalyzers: AnalyzerRegistry = {};

/**
 * Analyzes text content
 */
export async function analyzeTextResource(
  input: TextAnalysisInput,
): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    const results = await analyzeText(input);

    return {
      success: true,
      type: "text",
      results,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        version: VERSION,
      },
    };
  } catch (error) {
    return {
      success: false,
      type: "text",
      results: {},
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        version: VERSION,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Analyzes image content
 */
export async function analyzeImageResource(
  input: ImageAnalysisInput,
): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    const results = await analyzeImage(input);

    return {
      success: true,
      type: "image",
      results,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        version: VERSION,
      },
    };
  } catch (error) {
    return {
      success: false,
      type: "image",
      results: {},
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        version: VERSION,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Analyzes numeric data
 */
export async function analyzeNumericResource(
  input: NumericAnalysisInput,
): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    const results = await analyzeNumeric(input);

    return {
      success: true,
      type: "numeric",
      results,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        version: VERSION,
      },
    };
  } catch (error) {
    return {
      success: false,
      type: "numeric",
      results: {},
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        version: VERSION,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generates a report from analysis results
 */
export async function createReport(options: ReportOptions): Promise<Report> {
  return await generateReport(options);
}

/**
 * Processes multiple resources in batch
 */
export async function analyzeBatch(inputs: BatchInput[]): Promise<BatchResult> {
  const results: AnalysisResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const input of inputs) {
    let result: AnalysisResult;

    try {
      switch (input.type) {
        case "text":
          if (!input.content) {
            throw new Error("Text content is required");
          }
          result = await analyzeTextResource({
            content: input.content,
            options: {},
          });
          break;

        case "image":
          if (!input.path) {
            throw new Error("Image path is required");
          }
          result = await analyzeImageResource({
            path: input.path,
            options: {},
          });
          break;

        case "numeric":
          if (!input.data) {
            throw new Error("Numeric data is required");
          }
          result = await analyzeNumericResource({
            data: input.data,
            options: {},
          });
          break;

        default:
          throw new Error(`Unknown resource type: ${input.type}`);
      }

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      results.push(result);
    } catch (error) {
      failed++;
      results.push({
        success: false,
        type: input.type,
        results: {},
        metadata: {
          timestamp: new Date().toISOString(),
          duration: 0,
          version: VERSION,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    results,
    summary: {
      total: inputs.length,
      successful,
      failed,
    },
  };
}

/**
 * Registers a custom analyzer for a specific resource type
 */
export function registerAnalyzer(
  type: string,
  analyzer: AnalyzerFunction,
): void {
  customAnalyzers[type] = analyzer;
}

/**
 * Gets a custom analyzer by type
 */
export function getAnalyzer(type: string): AnalyzerFunction | undefined {
  return customAnalyzers[type];
}

/**
 * Lists all registered custom analyzers
 */
export function listAnalyzers(): string[] {
  return Object.keys(customAnalyzers);
}

/**
 * Clears all custom analyzers
 */
export function clearAnalyzers(): void {
  for (const key of Object.keys(customAnalyzers)) {
    delete customAnalyzers[key];
  }
}

// Export individual analyzers for direct use
export { analyzeText } from "./analyzers/text-analyzer.ts";
export { analyzeImage } from "./analyzers/image-analyzer.ts";
export { analyzeNumeric } from "./analyzers/numeric-analyzer.ts";
export { generateReport } from "./reports/report-generator.ts";

// Export types
export * from "./types.ts";
