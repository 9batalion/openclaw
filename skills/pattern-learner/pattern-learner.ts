import type {
  CommandRecord,
  DataDeletionRequest,
  DataDeletionResult,
  Interaction,
  LearningOptions,
  LearningResult,
  Pattern,
  PatternAnalysis,
  PatternDetectionInput,
  PreferenceRecord,
  PrivacySettings,
  Suggestion,
  SuggestionRequest,
} from "./types.ts";

import {
  detectPatterns,
  registerPatternDetector,
  getPatternDetector,
  listDetectors,
  clearDetectors,
} from "./detector/pattern-detector.ts";

import {
  storePattern,
  getPattern,
  queryPatterns,
  updatePattern,
  deletePattern,
  clearUserPatterns,
  getUserPatterns,
  cleanupOldPatterns,
  getStorageStats,
  exportPatterns,
  importPatterns,
} from "./storage/pattern-store.ts";

import {
  adaptResponse,
  getAdaptationSuggestions,
  evaluateAdaptation,
} from "./adapter/response-adapter.ts";

const VERSION = "1.0.0";

/**
 * Detects patterns from user interactions
 */
export async function findPatterns(
  input: PatternDetectionInput,
): Promise<Pattern[]> {
  const result = await detectPatterns(input);
  return result.patterns;
}

/**
 * Records an interaction for pattern learning
 */
export async function recordInteraction(
  interaction: Interaction,
): Promise<void> {
  // In a real implementation, interactions would be persisted
  // For now, this is a placeholder that could trigger pattern detection
}

/**
 * Records a command execution
 */
export async function recordCommand(record: CommandRecord): Promise<void> {
  const interaction: Interaction = {
    id: `cmd-${Date.now()}`,
    userId: record.userId,
    timestamp: record.timestamp,
    type: "command",
    content: {
      command: record.command,
      flags: record.flags,
      arguments: record.arguments,
      success: record.success,
    },
  };

  await recordInteraction(interaction);
}

/**
 * Records a user preference
 */
export async function recordPreference(
  record: PreferenceRecord,
): Promise<void> {
  const interaction: Interaction = {
    id: `pref-${Date.now()}`,
    userId: record.userId,
    timestamp: record.timestamp,
    type: "preference",
    content: record.preference,
    context: { category: record.category },
  };

  await recordInteraction(interaction);
}

/**
 * Gets suggestions for a user based on patterns
 */
export async function getSuggestions(
  request: SuggestionRequest,
): Promise<Suggestion[]> {
  const { userId, context, limit = 5, minConfidence = 0.7 } = request;

  const patterns = await getUserPatterns(userId, { minConfidence });
  const suggestions: Suggestion[] = [];

  for (const pattern of patterns) {
    if (pattern.type === "behavioral" && pattern.category === "action") {
      suggestions.push({
        id: `sug-${pattern.id}`,
        type: "action",
        content: `You often use: ${pattern.value}`,
        confidence: pattern.confidence,
        context,
        basedOnPatterns: [pattern.id],
      });
    }
  }

  return suggestions.slice(0, limit);
}

/**
 * Analyzes patterns for a user
 */
export async function analyzePatterns(input: {
  userId: string;
  timeRange?: { start: string; end: string };
}): Promise<PatternAnalysis> {
  const patterns = await getUserPatterns(input.userId);

  // Calculate summary
  const patternsByType = patterns.reduce(
    (acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0);
  const averageConfidence =
    patterns.length > 0 ? totalConfidence / patterns.length : 0;

  // Get top patterns
  const topPatterns = patterns
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  // Generate insights
  const insights = [];
  if (patterns.length > 10) {
    insights.push({
      type: "learning",
      description: "Strong learning profile established",
      confidence: 0.9,
      recommendation: "System can provide highly personalized responses",
    });
  }

  return {
    summary: {
      totalPatterns: patterns.length,
      patternsByType,
      averageConfidence,
      timeRange:
        input.timeRange || { start: "unknown", end: new Date().toISOString() },
    },
    topPatterns,
    trends: [],
    insights,
  };
}

/**
 * Learns from a batch of interactions
 */
export async function learnFromBatch(options: {
  interactions: Interaction[];
  options: LearningOptions;
}): Promise<LearningResult> {
  const startTime = Date.now();
  const { interactions, options: learningOptions } = options;

  const errors: string[] = [];
  let patternsLearned = 0;
  let patternsUpdated = 0;

  try {
    // Group interactions by user
    const byUser = new Map<string, Interaction[]>();
    for (const interaction of interactions) {
      const userInteractions = byUser.get(interaction.userId) || [];
      userInteractions.push(interaction);
      byUser.set(interaction.userId, userInteractions);
    }

    // Process each user's interactions
    for (const [userId, userInteractions] of byUser.entries()) {
      const result = await detectPatterns({
        userId,
        interactions: userInteractions,
        options: {
          minOccurrences: 2,
          confidenceThreshold: learningOptions.minConfidence || 0.7,
        },
      });

      for (const pattern of result.patterns) {
        // Check if pattern exists
        const existingPatterns = await queryPatterns({
          userId,
          type: pattern.type,
          category: pattern.category,
        });

        if (existingPatterns.length > 0 && learningOptions.updateExisting) {
          await updatePattern(pattern);
          patternsUpdated++;
        } else {
          await storePattern(pattern);
          patternsLearned++;
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown error");
  }

  return {
    patternsLearned,
    patternsUpdated,
    processingTime: Date.now() - startTime,
    errors,
  };
}

/**
 * Gets user preferences
 */
export async function getUserPreferences(userId: string): Promise<Record<string, unknown>> {
  const patterns = await getUserPatterns(userId, { minConfidence: 0.7 });
  const preferences: Record<string, unknown> = {};

  for (const pattern of patterns) {
    if (pattern.type === "preference") {
      preferences[pattern.category] = pattern.value;
    }
  }

  return preferences;
}

/**
 * Handles data deletion requests
 */
export async function deleteUserData(
  request: DataDeletionRequest,
): Promise<DataDeletionResult> {
  try {
    let deletedCount = 0;

    if (request.scope === "all" || request.scope === "patterns") {
      deletedCount = await clearUserPatterns(request.userId);
    }

    return {
      deletedCount,
      success: true,
    };
  } catch (error) {
    return {
      deletedCount: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Performs maintenance on pattern storage
 */
export async function performMaintenance(): Promise<{
  cleanedPatterns: number;
  stats: Awaited<ReturnType<typeof getStorageStats>>;
}> {
  const cleanedPatterns = await cleanupOldPatterns();
  const stats = await getStorageStats();

  return {
    cleanedPatterns,
    stats,
  };
}

// Re-export key functions and types
export {
  detectPatterns,
  storePattern,
  getPattern,
  queryPatterns,
  updatePattern,
  deletePattern,
  getUserPatterns,
  adaptResponse,
  getAdaptationSuggestions,
  registerPatternDetector,
  getPatternDetector,
  listDetectors,
  clearDetectors,
  exportPatterns,
  importPatterns,
  getStorageStats,
};

export * from "./types.ts";
