// Type definitions for pattern-learner skill

export interface Pattern {
  id: string;
  type: PatternType;
  category: string;
  value: unknown;
  confidence: number;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  metadata: Record<string, unknown>;
}

export type PatternType =
  | "preference"
  | "behavioral"
  | "contextual"
  | "temporal";

export interface PatternDetectionOptions {
  minOccurrences?: number;
  confidenceThreshold?: number;
  timeWindow?: string;
  categories?: string[];
}

export interface PatternDetectionInput {
  userId: string;
  interactions: Interaction[];
  options: PatternDetectionOptions;
}

export interface PatternDetectionResult {
  patterns: Pattern[];
  metadata: PatternDetectionMetadata;
}

export interface PatternDetectionMetadata {
  userId: string;
  analyzedInteractions: number;
  timeWindow: string;
  generatedAt: string;
}

export interface Interaction {
  id: string;
  userId: string;
  timestamp: string;
  type: InteractionType;
  content: unknown;
  context?: Record<string, unknown>;
  feedback?: InteractionFeedback;
}

export type InteractionType =
  | "message"
  | "command"
  | "action"
  | "preference"
  | "feedback";

export interface InteractionFeedback {
  rating?: number;
  accepted?: boolean;
  comment?: string;
}

// Storage Types
export interface PatternStoreOptions {
  retentionDays?: number;
  maxPatterns?: number;
  compressionEnabled?: boolean;
}

export interface PatternQuery {
  userId?: string;
  type?: PatternType;
  category?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface StorageBackend {
  save: (pattern: Pattern) => Promise<void>;
  load: (id: string) => Promise<Pattern | undefined>;
  query: (query: PatternQuery) => Promise<Pattern[]>;
  delete: (id: string) => Promise<boolean>;
  clear: (userId: string) => Promise<number>;
}

// Detector Types
export interface PatternDetector {
  detect: (interactions: Interaction[]) => Promise<Pattern[]>;
  supports: (interactionType: InteractionType) => boolean;
}

export interface DetectorRegistry {
  [key: string]: PatternDetector;
}

export interface TemporalPattern {
  pattern: string;
  timeOfDay?: number[];
  daysOfWeek?: number[];
  frequency: number;
}

// Adapter Types
export interface ResponseAdaptationInput {
  userId: string;
  context: ResponseContext;
  baseResponse: string;
  patterns?: Pattern[];
}

export interface ResponseContext {
  type: string;
  environment?: string;
  previousResponses?: string[];
  metadata?: Record<string, unknown>;
}

export interface AdaptedResponse {
  content: string;
  adaptations: Adaptation[];
  confidence: number;
}

export interface Adaptation {
  type: AdaptationType;
  description: string;
  pattern: Pattern;
}

export type AdaptationType =
  | "format"
  | "tone"
  | "verbosity"
  | "structure"
  | "content";

// Preference Types
export interface UserPreference {
  category: string;
  key: string;
  value: unknown;
  confidence: number;
  lastUpdated: string;
}

export interface PreferenceUpdate {
  userId: string;
  category: string;
  preferences: Record<string, unknown>;
}

// Suggestion Types
export interface Suggestion {
  id: string;
  type: SuggestionType;
  content: string;
  confidence: number;
  context: string;
  basedOnPatterns: string[];
}

export type SuggestionType =
  | "action"
  | "preference"
  | "shortcut"
  | "optimization"
  | "alternative";

export interface SuggestionRequest {
  userId: string;
  context: string;
  limit?: number;
  minConfidence?: number;
}

// Analysis Types
export interface PatternAnalysis {
  summary: AnalysisSummary;
  topPatterns: Pattern[];
  trends: Trend[];
  insights: Insight[];
}

export interface AnalysisSummary {
  totalPatterns: number;
  patternsByType: Record<PatternType, number>;
  averageConfidence: number;
  timeRange: TimeRange;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface Trend {
  type: string;
  direction: "increasing" | "decreasing" | "stable";
  strength: number;
  description: string;
}

export interface Insight {
  type: string;
  description: string;
  confidence: number;
  recommendation?: string;
}

// Learning Types
export interface LearningOptions {
  parallelProcessing?: boolean;
  updateExisting?: boolean;
  minConfidence?: number;
  batchSize?: number;
}

export interface LearningResult {
  patternsLearned: number;
  patternsUpdated: number;
  processingTime: number;
  errors: string[];
}

// Command Recording Types
export interface CommandRecord {
  userId: string;
  command: string;
  flags: string[];
  arguments: string[];
  success: boolean;
  timestamp: string;
}

// Preference Recording Types
export interface PreferenceRecord {
  userId: string;
  category: string;
  preference: Record<string, unknown>;
  timestamp: string;
}

// Privacy Types
export interface PrivacySettings {
  learningEnabled: boolean;
  dataRetentionDays: number;
  allowAnonymization: boolean;
  shareForImprovement: boolean;
}

export interface DataDeletionRequest {
  userId: string;
  scope: "all" | "patterns" | "interactions";
  olderThan?: string;
}

export interface DataDeletionResult {
  deletedCount: number;
  success: boolean;
  error?: string;
}
