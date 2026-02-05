import { describe, it, expect } from "vitest";
import {
  analyzeTextResource,
  analyzeImageResource,
  analyzeNumericResource,
  analyzeBatch,
  createReport,
  registerAnalyzer,
  getAnalyzer,
  listAnalyzers,
  clearAnalyzers,
} from "./resource-analyzer.ts";

describe("resource-analyzer", () => {
  describe("analyzeTextResource", () => {
    it("should analyze text with sentiment", async () => {
      const result = await analyzeTextResource({
        content: "This is a great and wonderful day!",
        options: { sentiment: true },
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe("text");
      expect(result.results.sentiment).toBeDefined();
      expect(result.results.sentiment?.label).toBe("positive");
    });

    it("should extract keywords from text", async () => {
      const result = await analyzeTextResource({
        content:
          "TypeScript is a programming language. TypeScript adds types to JavaScript.",
        options: { keywords: true },
      });

      expect(result.success).toBe(true);
      expect(result.results.keywords).toBeDefined();
      expect(Array.isArray(result.results.keywords)).toBe(true);
      expect(result.results.keywords?.length).toBeGreaterThan(0);
    });

    it("should generate a summary", async () => {
      const result = await analyzeTextResource({
        content:
          "First sentence. Second sentence. Third sentence. Fourth sentence.",
        options: { summary: true },
      });

      expect(result.success).toBe(true);
      expect(result.results.summary).toBeDefined();
      expect(typeof result.results.summary).toBe("string");
    });

    it("should detect language", async () => {
      const result = await analyzeTextResource({
        content: "The quick brown fox jumps over the lazy dog",
        options: { language: true },
      });

      expect(result.success).toBe(true);
      expect(result.results.language).toBeDefined();
    });
  });

  describe("analyzeImageResource", () => {
    it("should analyze image with mock data", async () => {
      const result = await analyzeImageResource({
        path: "/path/to/image.jpg",
        options: { objectRecognition: true, ocr: true, extractMetadata: true },
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe("image");
      expect(result.results.objects).toBeDefined();
      expect(result.results.text).toBeDefined();
      expect(result.results.metadata).toBeDefined();
    });
  });

  describe("analyzeNumericResource", () => {
    it("should calculate statistics", async () => {
      const result = await analyzeNumericResource({
        data: [1, 2, 3, 4, 5],
        options: { statistics: true },
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe("numeric");
      expect(result.results.statistics).toBeDefined();
      expect(result.results.statistics?.mean).toBe(3);
      expect(result.results.statistics?.median).toBe(3);
    });

    it("should detect trends", async () => {
      const result = await analyzeNumericResource({
        data: [1, 2, 3, 4, 5],
        options: { trends: true },
      });

      expect(result.success).toBe(true);
      expect(result.results.trends).toBeDefined();
      expect(result.results.trends?.direction).toBe("upward");
    });

    it("should detect anomalies", async () => {
      const result = await analyzeNumericResource({
        data: [1, 2, 3, 4, 100],
        options: { detectAnomalies: true },
      });

      expect(result.success).toBe(true);
      expect(result.results.anomalies).toBeDefined();
      expect(Array.isArray(result.results.anomalies)).toBe(true);
      expect(result.results.anomalies?.length).toBeGreaterThan(0);
    });
  });

  describe("analyzeBatch", () => {
    it("should process multiple resources", async () => {
      const result = await analyzeBatch([
        { type: "text", content: "Hello world" },
        { type: "numeric", data: [1, 2, 3] },
      ]);

      expect(result.results.length).toBe(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBeGreaterThan(0);
    });
  });

  describe("createReport", () => {
    it("should generate markdown report", async () => {
      const analysisResults = [
        await analyzeTextResource({
          content: "Test content",
          options: { sentiment: true },
        }),
      ];

      const report = await createReport({
        analyses: analysisResults,
        format: "markdown",
      });

      expect(report.format).toBe("markdown");
      expect(report.content).toContain("# Analysis Report");
      expect(report.metadata.analysesCount).toBe(1);
    });

    it("should generate html report", async () => {
      const analysisResults = [
        await analyzeNumericResource({
          data: [1, 2, 3],
          options: { statistics: true },
        }),
      ];

      const report = await createReport({
        analyses: analysisResults,
        format: "html",
      });

      expect(report.format).toBe("html");
      expect(report.content).toContain("<!DOCTYPE html>");
      expect(report.metadata.analysesCount).toBe(1);
    });
  });

  describe("custom analyzers", () => {
    it("should register and retrieve custom analyzer", () => {
      const customAnalyzer = async (input: unknown) => {
        return { custom: true };
      };

      registerAnalyzer("custom", customAnalyzer);

      const retrieved = getAnalyzer("custom");
      expect(retrieved).toBeDefined();
      expect(typeof retrieved).toBe("function");
    });

    it("should list registered analyzers", () => {
      clearAnalyzers();
      registerAnalyzer("test1", async () => ({}));
      registerAnalyzer("test2", async () => ({}));

      const list = listAnalyzers();
      expect(list).toContain("test1");
      expect(list).toContain("test2");
    });

    it("should clear all analyzers", () => {
      registerAnalyzer("test", async () => ({}));
      clearAnalyzers();

      const list = listAnalyzers();
      expect(list.length).toBe(0);
    });
  });
});
