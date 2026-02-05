import type {
  SentimentResult,
  TextAnalysisInput,
  TextAnalysisResult,
} from "../types.ts";

/**
 * Analyzes text content for sentiment, keywords, summaries, and language detection
 */
export async function analyzeText(
  input: TextAnalysisInput,
): Promise<TextAnalysisResult> {
  const result: TextAnalysisResult = {};

  if (input.options.sentiment) {
    result.sentiment = analyzeSentiment(input.content);
  }

  if (input.options.keywords) {
    result.keywords = extractKeywords(input.content);
  }

  if (input.options.summary) {
    result.summary = generateSummary(input.content);
  }

  if (input.options.language) {
    result.language = detectLanguage(input.content);
  }

  return result;
}

/**
 * Analyzes sentiment of text content
 */
function analyzeSentiment(content: string): SentimentResult {
  // Simple sentiment analysis based on positive/negative word counting
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "happy",
    "joy",
    "best",
  ];
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "horrible",
    "hate",
    "worst",
    "sad",
    "anger",
    "disappointed",
    "poor",
  ];

  const lowerContent = content.toLowerCase();
  const words = lowerContent.split(/\s+/);

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (positiveWords.some((pw) => word.includes(pw))) {
      positiveCount++;
    }
    if (negativeWords.some((nw) => word.includes(nw))) {
      negativeCount++;
    }
  }

  const total = positiveCount + negativeCount;
  const score = total === 0 ? 0 : (positiveCount - negativeCount) / total;

  let label: "positive" | "negative" | "neutral";
  if (score > 0.2) {
    label = "positive";
  } else if (score < -0.2) {
    label = "negative";
  } else {
    label = "neutral";
  }

  const confidence = Math.abs(score);

  return {
    score,
    label,
    confidence,
  };
}

/**
 * Extracts important keywords from text
 */
function extractKeywords(content: string, maxKeywords = 10): string[] {
  // Simple keyword extraction using word frequency
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "they",
    "them",
    "their",
  ]);

  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Generates a summary of the text content
 */
function generateSummary(content: string, maxSentences = 3): string {
  // Simple extractive summarization using sentence scoring
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length <= maxSentences) {
    return content;
  }

  // Score sentences based on word frequency and position
  const keywords = extractKeywords(content, 20);
  const keywordSet = new Set(keywords);

  const scoredSentences = sentences.map((sentence, index) => {
    const words = sentence
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/);
    const keywordCount = words.filter((w) => keywordSet.has(w)).length;

    // Boost score for sentences at the beginning
    const positionScore = 1 - index / sentences.length;
    const score = keywordCount * 2 + positionScore;

    return { sentence, score };
  });

  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map((s) => s.sentence)
    .join(". ") + ".";
}

/**
 * Detects the language of the text content
 */
function detectLanguage(content: string): string {
  // Simple language detection based on common words
  const lowerContent = content.toLowerCase();

  const patterns = [
    {
      lang: "en",
      patterns: ["the", "and", "or", "is", "are", "was", "were"],
    },
    { lang: "pl", patterns: ["jest", "oraz", "lub", "był", "była", "były"] },
    { lang: "es", patterns: ["el", "la", "los", "las", "es", "está", "son"] },
    { lang: "fr", patterns: ["le", "la", "les", "est", "sont", "et", "ou"] },
    { lang: "de", patterns: ["der", "die", "das", "und", "oder", "ist"] },
  ];

  let bestMatch = { lang: "unknown", score: 0 };

  for (const { lang, patterns: langPatterns } of patterns) {
    let matchCount = 0;
    for (const pattern of langPatterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, "gi");
      const matches = lowerContent.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    }

    if (matchCount > bestMatch.score) {
      bestMatch = { lang, score: matchCount };
    }
  }

  return bestMatch.lang;
}
