// Type definitions for resource-analyzer skill

export interface AnalysisResult {
  success: boolean;
  type: ResourceType;
  results: Record<string, unknown>;
  metadata: AnalysisMetadata;
  error?: string;
}

export interface AnalysisMetadata {
  timestamp: string;
  duration: number;
  version: string;
}

export type ResourceType = "text" | "image" | "numeric";

// Text Analysis Types
export interface TextAnalysisOptions {
  sentiment?: boolean;
  keywords?: boolean;
  summary?: boolean;
  language?: boolean;
}

export interface TextAnalysisInput {
  content: string;
  options: TextAnalysisOptions;
}

export interface TextAnalysisResult {
  sentiment?: SentimentResult;
  keywords?: string[];
  summary?: string;
  language?: string;
}

export interface SentimentResult {
  score: number; // -1 (negative) to 1 (positive)
  label: "positive" | "negative" | "neutral";
  confidence: number;
}

// Image Analysis Types
export interface ImageAnalysisOptions {
  objectRecognition?: boolean;
  ocr?: boolean;
  extractMetadata?: boolean;
  faceDetection?: boolean;
}

export interface ImageAnalysisInput {
  path: string;
  options: ImageAnalysisOptions;
}

export interface ImageAnalysisResult {
  objects?: DetectedObject[];
  text?: string;
  metadata?: ImageMetadata;
  faces?: FaceDetection[];
}

export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  exif?: Record<string, unknown>;
}

export interface FaceDetection {
  confidence: number;
  boundingBox: BoundingBox;
}

// Numeric Analysis Types
export interface NumericAnalysisOptions {
  statistics?: boolean;
  trends?: boolean;
  detectAnomalies?: boolean;
  timeSeries?: boolean;
}

export interface NumericAnalysisInput {
  data: number[];
  options: NumericAnalysisOptions;
  labels?: string[];
}

export interface NumericAnalysisResult {
  statistics?: Statistics;
  trends?: TrendAnalysis;
  anomalies?: Anomaly[];
  timeSeries?: TimeSeriesAnalysis;
}

export interface Statistics {
  mean: number;
  median: number;
  mode: number[];
  standardDeviation: number;
  min: number;
  max: number;
  count: number;
}

export interface TrendAnalysis {
  direction: "upward" | "downward" | "stable";
  strength: number; // 0-1
  slope?: number;
}

export interface Anomaly {
  index: number;
  value: number;
  score: number; // How anomalous (0-1)
  type: "high" | "low";
}

export interface TimeSeriesAnalysis {
  seasonality?: boolean;
  trend?: string;
  forecast?: number[];
}

// Report Generation Types
export type ReportFormat = "markdown" | "html";

export interface ReportOptions {
  analyses: AnalysisResult[];
  format: ReportFormat;
  includeCharts?: boolean;
  includeDashboard?: boolean;
  title?: string;
}

export interface Report {
  content: string;
  format: ReportFormat;
  metadata: {
    generatedAt: string;
    analysesCount: number;
  };
}

// Batch Processing Types
export interface BatchInput {
  type: ResourceType;
  content?: string;
  path?: string;
  data?: number[];
}

export interface BatchResult {
  results: AnalysisResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Custom Analyzer Types
export type AnalyzerFunction = (input: unknown) => Promise<unknown>;

export interface AnalyzerRegistry {
  [key: string]: AnalyzerFunction;
}
