import type {
  DetectorRegistry,
  Interaction,
  Pattern,
  PatternDetectionInput,
  PatternDetectionResult,
  PatternDetector,
  PatternType,
} from "../types.ts";
import { generatePatternId } from "../storage/pattern-store.ts";

// Registry for custom pattern detectors
const detectorRegistry: DetectorRegistry = {};

/**
 * Detects patterns in user interactions
 */
export async function detectPatterns(
  input: PatternDetectionInput,
): Promise<PatternDetectionResult> {
  const { userId, interactions, options } = input;

  const minOccurrences = options.minOccurrences || 3;
  const confidenceThreshold = options.confidenceThreshold || 0.7;

  const patterns: Pattern[] = [];

  // Detect preference patterns
  const preferencePatterns = detectPreferencePatterns(
    interactions,
    userId,
    minOccurrences,
  );
  patterns.push(...preferencePatterns);

  // Detect behavioral patterns
  const behavioralPatterns = detectBehavioralPatterns(
    interactions,
    userId,
    minOccurrences,
  );
  patterns.push(...behavioralPatterns);

  // Detect contextual patterns
  const contextualPatterns = detectContextualPatterns(
    interactions,
    userId,
    minOccurrences,
  );
  patterns.push(...contextualPatterns);

  // Detect temporal patterns
  const temporalPatterns = detectTemporalPatterns(
    interactions,
    userId,
    minOccurrences,
  );
  patterns.push(...temporalPatterns);

  // Apply custom detectors
  for (const detector of Object.values(detectorRegistry)) {
    const customPatterns = await detector.detect(interactions);
    patterns.push(...customPatterns);
  }

  // Filter by confidence threshold
  const filteredPatterns = patterns.filter(
    (p) => p.confidence >= confidenceThreshold,
  );

  return {
    patterns: filteredPatterns,
    metadata: {
      userId,
      analyzedInteractions: interactions.length,
      timeWindow: options.timeWindow || "all",
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Detects preference patterns from interactions
 */
function detectPreferencePatterns(
  interactions: Interaction[],
  userId: string,
  minOccurrences: number,
): Pattern[] {
  const patterns: Pattern[] = [];
  const preferenceMap = new Map<
    string,
    { value: unknown; count: number; timestamps: string[] }
  >();

  // Analyze preference interactions
  for (const interaction of interactions) {
    if (interaction.type === "preference") {
      const content = interaction.content as Record<string, unknown>;
      for (const [key, value] of Object.entries(content)) {
        const prefKey = `${key}:${JSON.stringify(value)}`;
        const existing = preferenceMap.get(prefKey);

        if (existing) {
          existing.count++;
          existing.timestamps.push(interaction.timestamp);
        } else {
          preferenceMap.set(prefKey, {
            value,
            count: 1,
            timestamps: [interaction.timestamp],
          });
        }
      }
    }
  }

  // Create patterns from frequent preferences
  for (const [key, data] of preferenceMap.entries()) {
    if (data.count >= minOccurrences) {
      const [category] = key.split(":");
      const confidence = Math.min(data.count / interactions.length, 1);

      patterns.push({
        id: generatePatternId(userId, "preference", category),
        type: "preference",
        category,
        value: data.value,
        confidence,
        occurrences: data.count,
        firstSeen: data.timestamps[0],
        lastSeen: data.timestamps[data.timestamps.length - 1],
        metadata: { userId },
      });
    }
  }

  return patterns;
}

/**
 * Detects behavioral patterns (repeated actions)
 */
function detectBehavioralPatterns(
  interactions: Interaction[],
  userId: string,
  minOccurrences: number,
): Pattern[] {
  const patterns: Pattern[] = [];
  const actionMap = new Map<
    string,
    { count: number; timestamps: string[] }
  >();

  // Count action occurrences
  for (const interaction of interactions) {
    if (
      interaction.type === "action" ||
      interaction.type === "command"
    ) {
      const action =
        typeof interaction.content === "string"
          ? interaction.content
          : JSON.stringify(interaction.content);

      const existing = actionMap.get(action);
      if (existing) {
        existing.count++;
        existing.timestamps.push(interaction.timestamp);
      } else {
        actionMap.set(action, {
          count: 1,
          timestamps: [interaction.timestamp],
        });
      }
    }
  }

  // Create patterns from frequent actions
  for (const [action, data] of actionMap.entries()) {
    if (data.count >= minOccurrences) {
      const confidence = Math.min(data.count / interactions.length, 1);

      patterns.push({
        id: generatePatternId(userId, "behavioral", "action"),
        type: "behavioral",
        category: "action",
        value: action,
        confidence,
        occurrences: data.count,
        firstSeen: data.timestamps[0],
        lastSeen: data.timestamps[data.timestamps.length - 1],
        metadata: { userId },
      });
    }
  }

  return patterns;
}

/**
 * Detects contextual patterns
 */
function detectContextualPatterns(
  interactions: Interaction[],
  userId: string,
  minOccurrences: number,
): Pattern[] {
  const patterns: Pattern[] = [];
  const contextMap = new Map<
    string,
    { count: number; timestamps: string[] }
  >();

  // Analyze contexts
  for (const interaction of interactions) {
    if (interaction.context) {
      const contextKey = JSON.stringify(interaction.context);
      const existing = contextMap.get(contextKey);

      if (existing) {
        existing.count++;
        existing.timestamps.push(interaction.timestamp);
      } else {
        contextMap.set(contextKey, {
          count: 1,
          timestamps: [interaction.timestamp],
        });
      }
    }
  }

  // Create patterns from frequent contexts
  for (const [contextKey, data] of contextMap.entries()) {
    if (data.count >= minOccurrences) {
      const confidence = Math.min(data.count / interactions.length, 1);

      patterns.push({
        id: generatePatternId(userId, "contextual", "environment"),
        type: "contextual",
        category: "environment",
        value: JSON.parse(contextKey),
        confidence,
        occurrences: data.count,
        firstSeen: data.timestamps[0],
        lastSeen: data.timestamps[data.timestamps.length - 1],
        metadata: { userId },
      });
    }
  }

  return patterns;
}

/**
 * Detects temporal patterns (time-based)
 */
function detectTemporalPatterns(
  interactions: Interaction[],
  userId: string,
  minOccurrences: number,
): Pattern[] {
  const patterns: Pattern[] = [];

  // Analyze time of day patterns
  const hourMap = new Map<number, number>();
  const dayMap = new Map<number, number>();

  for (const interaction of interactions) {
    const date = new Date(interaction.timestamp);
    const hour = date.getHours();
    const day = date.getDay();

    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }

  // Find peak hours
  const peakHours = Array.from(hourMap.entries())
    .filter(([, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => hour);

  if (peakHours.length > 0) {
    patterns.push({
      id: generatePatternId(userId, "temporal", "hour"),
      type: "temporal",
      category: "hour",
      value: peakHours,
      confidence: 0.8,
      occurrences: peakHours.length,
      firstSeen: interactions[0].timestamp,
      lastSeen: interactions[interactions.length - 1].timestamp,
      metadata: { userId },
    });
  }

  // Find active days
  const activeDays = Array.from(dayMap.entries())
    .filter(([, count]) => count >= minOccurrences)
    .map(([day]) => day);

  if (activeDays.length > 0) {
    patterns.push({
      id: generatePatternId(userId, "temporal", "day"),
      type: "temporal",
      category: "day",
      value: activeDays,
      confidence: 0.75,
      occurrences: activeDays.length,
      firstSeen: interactions[0].timestamp,
      lastSeen: interactions[interactions.length - 1].timestamp,
      metadata: { userId },
    });
  }

  return patterns;
}

/**
 * Registers a custom pattern detector
 */
export function registerPatternDetector(
  name: string,
  detector: PatternDetector,
): void {
  detectorRegistry[name] = detector;
}

/**
 * Gets a registered pattern detector
 */
export function getPatternDetector(name: string): PatternDetector | undefined {
  return detectorRegistry[name];
}

/**
 * Lists all registered detectors
 */
export function listDetectors(): string[] {
  return Object.keys(detectorRegistry);
}

/**
 * Clears all custom detectors
 */
export function clearDetectors(): void {
  for (const key of Object.keys(detectorRegistry)) {
    delete detectorRegistry[key];
  }
}
