import type {
  AdaptedResponse,
  Adaptation,
  AdaptationType,
  Pattern,
  ResponseAdaptationInput,
} from "../types.ts";
import { getUserPatterns } from "../storage/pattern-store.ts";

/**
 * Adapts a response based on user patterns
 */
export async function adaptResponse(
  input: ResponseAdaptationInput,
): Promise<AdaptedResponse> {
  const { userId, context, baseResponse, patterns: providedPatterns } = input;

  // Get patterns if not provided
  const patterns =
    providedPatterns || (await getUserPatterns(userId, { minConfidence: 0.7 }));

  if (patterns.length === 0) {
    return {
      content: baseResponse,
      adaptations: [],
      confidence: 1.0,
    };
  }

  let adaptedContent = baseResponse;
  const adaptations: Adaptation[] = [];

  // Apply format adaptations
  const formatAdaptation = applyFormatAdaptation(
    adaptedContent,
    patterns,
    context,
  );
  if (formatAdaptation) {
    adaptedContent = formatAdaptation.content;
    adaptations.push(formatAdaptation.adaptation);
  }

  // Apply tone adaptations
  const toneAdaptation = applyToneAdaptation(
    adaptedContent,
    patterns,
    context,
  );
  if (toneAdaptation) {
    adaptedContent = toneAdaptation.content;
    adaptations.push(toneAdaptation.adaptation);
  }

  // Apply verbosity adaptations
  const verbosityAdaptation = applyVerbosityAdaptation(
    adaptedContent,
    patterns,
  );
  if (verbosityAdaptation) {
    adaptedContent = verbosityAdaptation.content;
    adaptations.push(verbosityAdaptation.adaptation);
  }

  // Apply structure adaptations
  const structureAdaptation = applyStructureAdaptation(
    adaptedContent,
    patterns,
  );
  if (structureAdaptation) {
    adaptedContent = structureAdaptation.content;
    adaptations.push(structureAdaptation.adaptation);
  }

  // Calculate overall confidence
  const confidence =
    adaptations.length > 0
      ? adaptations.reduce((sum, a) => sum + a.pattern.confidence, 0) /
        adaptations.length
      : 1.0;

  return {
    content: adaptedContent,
    adaptations,
    confidence,
  };
}

/**
 * Applies format adaptations based on user preferences
 */
function applyFormatAdaptation(
  content: string,
  patterns: Pattern[],
  context: any,
): { content: string; adaptation: Adaptation } | null {
  const formatPattern = patterns.find(
    (p) => p.category === "format" && p.type === "preference",
  );

  if (!formatPattern) {
    return null;
  }

  const preferredFormat = formatPattern.value as string;
  let adaptedContent = content;

  // Apply format transformations
  switch (preferredFormat) {
    case "markdown":
      adaptedContent = convertToMarkdown(content);
      break;
    case "json":
      adaptedContent = convertToJSON(content);
      break;
    case "plain":
      adaptedContent = stripFormatting(content);
      break;
  }

  return {
    content: adaptedContent,
    adaptation: {
      type: "format",
      description: `Converted to ${preferredFormat} format`,
      pattern: formatPattern,
    },
  };
}

/**
 * Applies tone adaptations
 */
function applyToneAdaptation(
  content: string,
  patterns: Pattern[],
  context: any,
): { content: string; adaptation: Adaptation } | null {
  const tonePattern = patterns.find(
    (p) => p.category === "tone" && p.type === "preference",
  );

  if (!tonePattern) {
    return null;
  }

  const preferredTone = tonePattern.value as string;
  let adaptedContent = content;

  switch (preferredTone) {
    case "formal":
      adaptedContent = makeFormal(content);
      break;
    case "casual":
      adaptedContent = makeCasual(content);
      break;
    case "technical":
      adaptedContent = makeTechnical(content);
      break;
  }

  return {
    content: adaptedContent,
    adaptation: {
      type: "tone",
      description: `Adjusted tone to ${preferredTone}`,
      pattern: tonePattern,
    },
  };
}

/**
 * Applies verbosity adaptations
 */
function applyVerbosityAdaptation(
  content: string,
  patterns: Pattern[],
): { content: string; adaptation: Adaptation } | null {
  const verbosityPattern = patterns.find(
    (p) => p.category === "verbosity" && p.type === "preference",
  );

  if (!verbosityPattern) {
    return null;
  }

  const preferredVerbosity = verbosityPattern.value as string;
  let adaptedContent = content;

  switch (preferredVerbosity) {
    case "concise":
      adaptedContent = makeConcise(content);
      break;
    case "detailed":
      adaptedContent = makeDetailed(content);
      break;
    case "comprehensive":
      adaptedContent = makeComprehensive(content);
      break;
  }

  return {
    content: adaptedContent,
    adaptation: {
      type: "verbosity",
      description: `Adjusted verbosity to ${preferredVerbosity}`,
      pattern: verbosityPattern,
    },
  };
}

/**
 * Applies structure adaptations
 */
function applyStructureAdaptation(
  content: string,
  patterns: Pattern[],
): { content: string; adaptation: Adaptation } | null {
  const structurePattern = patterns.find(
    (p) => p.category === "structure" && p.type === "preference",
  );

  if (!structurePattern) {
    return null;
  }

  const preferredStructure = structurePattern.value as string;
  let adaptedContent = content;

  switch (preferredStructure) {
    case "bulleted":
      adaptedContent = convertToBullets(content);
      break;
    case "numbered":
      adaptedContent = convertToNumbered(content);
      break;
    case "sections":
      adaptedContent = convertToSections(content);
      break;
  }

  return {
    content: adaptedContent,
    adaptation: {
      type: "structure",
      description: `Restructured as ${preferredStructure}`,
      pattern: structurePattern,
    },
  };
}

// Helper functions for content transformation

function convertToMarkdown(content: string): string {
  // Simple markdown conversion
  return content;
}

function convertToJSON(content: string): string {
  // Attempt to structure content as JSON
  try {
    return JSON.stringify({ response: content }, null, 2);
  } catch {
    return content;
  }
}

function stripFormatting(content: string): string {
  // Remove markdown and other formatting
  return content
    .replace(/[*_~`#]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function makeFormal(content: string): string {
  // Make content more formal (simplified implementation)
  return content
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bdon't\b/g, "do not");
}

function makeCasual(content: string): string {
  // Make content more casual
  return content
    .replace(/\bcannot\b/g, "can't")
    .replace(/\bwill not\b/g, "won't")
    .replace(/\bdo not\b/g, "don't");
}

function makeTechnical(content: string): string {
  // Add technical precision
  return content;
}

function makeConcise(content: string): string {
  // Reduce verbosity (simplified)
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
  return sentences.slice(0, Math.ceil(sentences.length / 2)).join(". ") + ".";
}

function makeDetailed(content: string): string {
  // Add detail markers
  return content;
}

function makeComprehensive(content: string): string {
  // Add comprehensive markers
  return content;
}

function convertToBullets(content: string): string {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
  return sentences.map((s) => `• ${s.trim()}`).join("\n");
}

function convertToNumbered(content: string): string {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
  return sentences.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n");
}

function convertToSections(content: string): string {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
  return sentences.map((s, i) => `\n### Section ${i + 1}\n${s.trim()}`).join("\n");
}

/**
 * Gets adaptation suggestions without applying them
 */
export async function getAdaptationSuggestions(
  userId: string,
): Promise<string[]> {
  const patterns = await getUserPatterns(userId, { minConfidence: 0.7 });
  const suggestions: string[] = [];

  for (const pattern of patterns) {
    if (pattern.type === "preference") {
      suggestions.push(
        `Consider using ${pattern.category}: ${JSON.stringify(pattern.value)}`,
      );
    }
  }

  return suggestions;
}

/**
 * Evaluates adaptation effectiveness
 */
export function evaluateAdaptation(
  original: string,
  adapted: string,
  userFeedback: number,
): number {
  // Calculate adaptation quality score (0-1)
  const lengthRatio = adapted.length / original.length;
  const feedbackScore = userFeedback / 5; // Normalize to 0-1

  // Combine metrics
  return (feedbackScore * 0.7 + (1 - Math.abs(1 - lengthRatio)) * 0.3);
}
