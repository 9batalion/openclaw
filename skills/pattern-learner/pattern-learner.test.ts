import { describe, it, expect, beforeEach } from "vitest";
import {
  findPatterns,
  recordCommand,
  recordPreference,
  getSuggestions,
  analyzePatterns,
  learnFromBatch,
  getUserPreferences,
  deleteUserData,
  storePattern,
  getUserPatterns,
  adaptResponse,
} from "./pattern-learner.ts";
import type { Interaction } from "./types.ts";

describe("pattern-learner", () => {
  const testUserId = "test-user-123";

  describe("findPatterns", () => {
    it("should detect preference patterns", async () => {
      const interactions: Interaction[] = [
        {
          id: "1",
          userId: testUserId,
          timestamp: new Date().toISOString(),
          type: "preference",
          content: { format: "markdown" },
        },
        {
          id: "2",
          userId: testUserId,
          timestamp: new Date().toISOString(),
          type: "preference",
          content: { format: "markdown" },
        },
        {
          id: "3",
          userId: testUserId,
          timestamp: new Date().toISOString(),
          type: "preference",
          content: { format: "markdown" },
        },
      ];

      const patterns = await findPatterns({
        userId: testUserId,
        interactions,
        options: { minOccurrences: 3 },
      });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe("preference");
    });

    it("should detect behavioral patterns", async () => {
      const interactions: Interaction[] = [];
      for (let i = 0; i < 5; i++) {
        interactions.push({
          id: `${i}`,
          userId: testUserId,
          timestamp: new Date().toISOString(),
          type: "action",
          content: "deploy --verbose",
        });
      }

      const patterns = await findPatterns({
        userId: testUserId,
        interactions,
        options: { minOccurrences: 3 },
      });

      const behavioralPattern = patterns.find((p) => p.type === "behavioral");
      expect(behavioralPattern).toBeDefined();
    });

    it("should detect temporal patterns", async () => {
      const interactions: Interaction[] = [];
      const baseTime = new Date();
      baseTime.setHours(10, 0, 0, 0);

      for (let i = 0; i < 5; i++) {
        interactions.push({
          id: `${i}`,
          userId: testUserId,
          timestamp: new Date(baseTime.getTime() + i * 1000).toISOString(),
          type: "action",
          content: "test",
        });
      }

      const patterns = await findPatterns({
        userId: testUserId,
        interactions,
        options: { minOccurrences: 3 },
      });

      const temporalPattern = patterns.find((p) => p.type === "temporal");
      expect(temporalPattern).toBeDefined();
    });
  });

  describe("recordCommand", () => {
    it("should record command execution", async () => {
      await recordCommand({
        userId: testUserId,
        command: "test",
        flags: ["--verbose"],
        arguments: [],
        success: true,
        timestamp: new Date().toISOString(),
      });

      // Recording should not throw
      expect(true).toBe(true);
    });
  });

  describe("recordPreference", () => {
    it("should record user preference", async () => {
      await recordPreference({
        userId: testUserId,
        category: "format",
        preference: { type: "markdown" },
        timestamp: new Date().toISOString(),
      });

      // Recording should not throw
      expect(true).toBe(true);
    });
  });

  describe("getSuggestions", () => {
    it("should return suggestions based on patterns", async () => {
      // Store a pattern first
      await storePattern({
        id: "test-pattern-1",
        type: "behavioral",
        category: "action",
        value: "deploy",
        confidence: 0.8,
        occurrences: 5,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        metadata: { userId: testUserId },
      });

      const suggestions = await getSuggestions({
        userId: testUserId,
        context: "deployment",
        limit: 5,
      });

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe("analyzePatterns", () => {
    it("should analyze user patterns", async () => {
      // Store some test patterns
      for (let i = 0; i < 3; i++) {
        await storePattern({
          id: `test-pattern-${i}`,
          type: "preference",
          category: "test",
          value: `value-${i}`,
          confidence: 0.8,
          occurrences: 3,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          metadata: { userId: testUserId },
        });
      }

      const analysis = await analyzePatterns({ userId: testUserId });

      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.totalPatterns).toBeGreaterThan(0);
      expect(Array.isArray(analysis.topPatterns)).toBe(true);
    });
  });

  describe("learnFromBatch", () => {
    it("should learn patterns from batch of interactions", async () => {
      const interactions: Interaction[] = [];
      for (let i = 0; i < 10; i++) {
        interactions.push({
          id: `batch-${i}`,
          userId: testUserId,
          timestamp: new Date().toISOString(),
          type: "preference",
          content: { theme: "dark" },
        });
      }

      const result = await learnFromBatch({
        interactions,
        options: { parallelProcessing: true, minConfidence: 0.7 },
      });

      expect(result.patternsLearned).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe("getUserPreferences", () => {
    it("should retrieve user preferences from patterns", async () => {
      await storePattern({
        id: "pref-pattern-1",
        type: "preference",
        category: "format",
        value: "json",
        confidence: 0.9,
        occurrences: 5,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        metadata: { userId: testUserId },
      });

      const preferences = await getUserPreferences(testUserId);

      expect(typeof preferences).toBe("object");
      expect(preferences.format).toBe("json");
    });
  });

  describe("deleteUserData", () => {
    it("should delete user patterns", async () => {
      // Store a pattern first
      await storePattern({
        id: "delete-test-pattern",
        type: "preference",
        category: "test",
        value: "test",
        confidence: 0.8,
        occurrences: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        metadata: { userId: testUserId },
      });

      const result = await deleteUserData({
        userId: testUserId,
        scope: "all",
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("adaptResponse", () => {
    it("should adapt response based on patterns", async () => {
      const pattern = {
        id: "adapt-pattern-1",
        type: "preference" as const,
        category: "format",
        value: "markdown",
        confidence: 0.9,
        occurrences: 5,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        metadata: { userId: testUserId },
      };

      const result = await adaptResponse({
        userId: testUserId,
        context: { type: "response" },
        baseResponse: "This is a test response",
        patterns: [pattern],
      });

      expect(result.content).toBeDefined();
      expect(typeof result.confidence).toBe("number");
      expect(Array.isArray(result.adaptations)).toBe(true);
    });
  });
});
