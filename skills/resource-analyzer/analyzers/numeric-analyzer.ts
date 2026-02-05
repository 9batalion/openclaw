import type {
  Anomaly,
  NumericAnalysisInput,
  NumericAnalysisResult,
  Statistics,
  TimeSeriesAnalysis,
  TrendAnalysis,
} from "../types.ts";

/**
 * Analyzes numeric data for statistics, trends, and anomalies
 */
export async function analyzeNumeric(
  input: NumericAnalysisInput,
): Promise<NumericAnalysisResult> {
  const result: NumericAnalysisResult = {};

  if (input.options.statistics) {
    result.statistics = calculateStatistics(input.data);
  }

  if (input.options.trends) {
    result.trends = analyzeTrends(input.data);
  }

  if (input.options.detectAnomalies) {
    result.anomalies = detectAnomalies(input.data);
  }

  if (input.options.timeSeries) {
    result.timeSeries = analyzeTimeSeries(input.data);
  }

  return result;
}

/**
 * Calculates basic statistics for a dataset
 */
function calculateStatistics(data: number[]): Statistics {
  if (data.length === 0) {
    throw new Error("Cannot calculate statistics for empty dataset");
  }

  const sorted = [...data].sort((a, b) => a - b);
  const sum = data.reduce((acc, val) => acc + val, 0);
  const mean = sum / data.length;

  // Calculate median
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  // Calculate mode
  const frequency = new Map<number, number>();
  for (const value of data) {
    frequency.set(value, (frequency.get(value) || 0) + 1);
  }
  const maxFreq = Math.max(...frequency.values());
  const mode = Array.from(frequency.entries())
    .filter(([, freq]) => freq === maxFreq)
    .map(([value]) => value);

  // Calculate standard deviation
  const squaredDiffs = data.map((value) => Math.pow(value - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / data.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    mean,
    median,
    mode,
    standardDeviation,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: data.length,
  };
}

/**
 * Analyzes trends in numeric data
 */
function analyzeTrends(data: number[]): TrendAnalysis {
  if (data.length < 2) {
    return {
      direction: "stable",
      strength: 0,
    };
  }

  // Calculate linear regression slope
  const n = data.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  const sumX = indices.reduce((acc, val) => acc + val, 0);
  const sumY = data.reduce((acc, val) => acc + val, 0);
  const sumXY = indices.reduce((acc, val, i) => acc + val * data[i], 0);
  const sumXX = indices.reduce((acc, val) => acc + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Determine direction and strength
  const dataRange = Math.max(...data) - Math.min(...data);
  const strength = Math.min(Math.abs(slope) / (dataRange / n), 1);

  let direction: "upward" | "downward" | "stable";
  if (slope > 0.1) {
    direction = "upward";
  } else if (slope < -0.1) {
    direction = "downward";
  } else {
    direction = "stable";
  }

  return {
    direction,
    strength,
    slope,
  };
}

/**
 * Detects anomalies in numeric data using statistical methods
 */
function detectAnomalies(
  data: number[],
  threshold = 2.5,
): Anomaly[] {
  const stats = calculateStatistics(data);
  const anomalies: Anomaly[] = [];

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const zScore = Math.abs((value - stats.mean) / stats.standardDeviation);

    if (zScore > threshold) {
      anomalies.push({
        index: i,
        value,
        score: Math.min(zScore / 5, 1), // Normalize to 0-1
        type: value > stats.mean ? "high" : "low",
      });
    }
  }

  return anomalies;
}

/**
 * Analyzes time series data for patterns and forecasting
 */
function analyzeTimeSeries(data: number[]): TimeSeriesAnalysis {
  if (data.length < 4) {
    return {
      seasonality: false,
      trend: "insufficient data",
    };
  }

  // Simple seasonality detection using autocorrelation
  const seasonality = detectSeasonality(data);

  // Get trend information
  const trend = analyzeTrends(data);
  const trendDescription = `${trend.direction} (strength: ${trend.strength.toFixed(2)})`;

  // Simple forecast using linear extrapolation
  const forecast = generateSimpleForecast(data, 3);

  return {
    seasonality,
    trend: trendDescription,
    forecast,
  };
}

/**
 * Detects seasonality in time series data
 */
function detectSeasonality(data: number[]): boolean {
  // Simple autocorrelation check for periodicity
  // This is a simplified implementation
  const n = data.length;
  const mean = data.reduce((acc, val) => acc + val, 0) / n;

  for (let lag = 1; lag <= Math.floor(n / 2); lag++) {
    let correlation = 0;
    let variance = 0;

    for (let i = 0; i < n - lag; i++) {
      correlation += (data[i] - mean) * (data[i + lag] - mean);
      variance += Math.pow(data[i] - mean, 2);
    }

    const autocorrelation = correlation / variance;

    // If we find significant autocorrelation, there's likely seasonality
    if (autocorrelation > 0.5 && lag > 1) {
      return true;
    }
  }

  return false;
}

/**
 * Generates a simple forecast using linear extrapolation
 */
function generateSimpleForecast(data: number[], periods: number): number[] {
  const trend = analyzeTrends(data);
  const lastValue = data[data.length - 1];
  const forecast: number[] = [];

  for (let i = 1; i <= periods; i++) {
    forecast.push(lastValue + (trend.slope || 0) * i);
  }

  return forecast;
}

/**
 * Utility function to normalize data to 0-1 range
 */
export function normalizeData(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) {
    return data.map(() => 0.5);
  }

  return data.map((value) => (value - min) / range);
}

/**
 * Utility function to calculate moving average
 */
export function movingAverage(data: number[], windowSize: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
    const window = data.slice(start, end);
    const avg = window.reduce((acc, val) => acc + val, 0) / window.length;
    result.push(avg);
  }

  return result;
}
