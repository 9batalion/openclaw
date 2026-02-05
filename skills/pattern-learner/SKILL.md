---
name: pattern-learner
description: Adaptive learning system that detects patterns in user behavior, adapts responses based on interaction history, and provides proactive suggestions. Use when building intelligent systems that learn from user preferences and improve over time.
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "requires": {},
      },
  }
---

# Pattern Learner

Adaptive learning system that identifies and learns from user behavior patterns to provide personalized experiences.

## When to Use

Use this skill when you need to:

- Track and analyze user behavior patterns
- Adapt responses based on historical interactions
- Build personalized user experiences
- Provide proactive suggestions based on learned preferences
- Create intelligent systems that improve over time
- Implement recommendation engines

## Quick Start

### Detect Patterns

```typescript
import { detectPatterns } from './pattern-learner';

const patterns = await detectPatterns({
  userId: 'user123',
  interactions: recentInteractions,
  options: {
    minOccurrences: 3,
    timeWindow: '7d'
  }
});
```

### Adapt Responses

```typescript
import { adaptResponse } from './pattern-learner';

const adaptedResponse = await adaptResponse({
  userId: 'user123',
  context: currentContext,
  baseResponse: 'Here is your result',
  patterns: userPatterns
});
```

### Store Patterns

```typescript
import { storePattern } from './pattern-learner';

await storePattern({
  userId: 'user123',
  pattern: {
    type: 'preference',
    category: 'format',
    value: 'markdown',
    confidence: 0.85
  }
});
```

## Features

### Pattern Detection
- **Behavioral analysis**: Identify recurring user actions and preferences
- **Temporal patterns**: Detect time-based patterns (daily, weekly, etc.)
- **Contextual patterns**: Find patterns based on context and conditions
- **Confidence scoring**: Assign confidence levels to detected patterns

### Response Adaptation
- **Dynamic responses**: Adjust responses based on user preferences
- **Format adaptation**: Automatically use preferred formats
- **Tone adaptation**: Match communication style to user preferences
- **Content personalization**: Customize content based on learned patterns

### Pattern Storage
- **Persistent storage**: Save patterns for long-term learning
- **Pattern updates**: Continuously update patterns as new data arrives
- **Pattern expiry**: Remove outdated patterns automatically
- **Privacy controls**: Respect user privacy and data retention policies

### Proactive Suggestions
- **Predictive recommendations**: Suggest actions before being asked
- **Smart defaults**: Pre-fill options based on patterns
- **Contextual tips**: Provide relevant guidance at the right time
- **Learning feedback**: Track which suggestions are accepted

## Pattern Types

### Preference Patterns
User preferences for formats, styles, and options:
- Output format (markdown, JSON, plain text)
- Verbosity level (concise, detailed, comprehensive)
- Communication style (formal, casual, technical)

### Behavioral Patterns
Recurring user actions and workflows:
- Frequently used commands or features
- Common sequences of actions
- Time-of-day usage patterns
- Task completion patterns

### Contextual Patterns
Patterns based on specific contexts:
- Project-specific preferences
- Domain-specific terminology
- Environment-specific settings
- Role-based behavior

## Configuration

Configure pattern learning via environment variables or config:

- `PATTERN_LEARNER_MIN_OCCURRENCES`: Minimum pattern occurrences (default: 3)
- `PATTERN_LEARNER_CONFIDENCE_THRESHOLD`: Minimum confidence for pattern (default: 0.7)
- `PATTERN_LEARNER_RETENTION_DAYS`: Days to keep patterns (default: 90)
- `PATTERN_LEARNER_STORAGE_PATH`: Path for pattern storage

## Advanced Usage

### Custom Pattern Detection

```typescript
import { registerPatternDetector } from './pattern-learner';

registerPatternDetector('custom-type', async (data) => {
  // Custom detection logic
  return detectedPatterns;
});
```

### Pattern Analysis

```typescript
import { analyzePatterns } from './pattern-learner';

const analysis = await analyzePatterns({
  userId: 'user123',
  timeRange: { start: '2024-01-01', end: '2024-12-31' }
});
// Returns statistics and insights about user patterns
```

### Batch Learning

```typescript
import { learnFromBatch } from './pattern-learner';

await learnFromBatch({
  interactions: historicalData,
  options: {
    parallelProcessing: true,
    updateExisting: true
  }
});
```

## Output Format

Pattern detection returns a consistent structure:

```typescript
{
  patterns: [
    {
      id: string;
      type: string;
      category: string;
      value: any;
      confidence: number;
      occurrences: number;
      firstSeen: string;
      lastSeen: string;
      metadata: Record<string, any>;
    }
  ];
  metadata: {
    userId: string;
    analyzedInteractions: number;
    timeWindow: string;
    generatedAt: string;
  };
}
```

## Privacy & Ethics

The pattern learner includes privacy-aware features:

- **User consent**: Respect opt-in/opt-out preferences
- **Data minimization**: Store only necessary information
- **Anonymization**: Support anonymous pattern learning
- **Transparency**: Provide visibility into learned patterns
- **Right to deletion**: Allow users to clear their patterns

## Performance

- Incremental learning: Update patterns without full reprocessing
- Caching: Cache frequently accessed patterns
- Lazy loading: Load patterns only when needed
- Efficient storage: Use compressed storage for large datasets

## Integration Examples

### With Chatbots

```typescript
// Learn from conversations
await recordInteraction({
  userId: 'user123',
  type: 'message',
  content: userMessage,
  response: botResponse,
  feedback: userFeedback
});

// Adapt future responses
const response = await adaptResponse({
  userId: 'user123',
  context: currentConversation
});
```

### With CLI Tools

```typescript
// Track command usage
await recordCommand({
  userId: 'user123',
  command: 'deploy',
  flags: ['--verbose', '--dry-run'],
  success: true
});

// Suggest common flags
const suggestions = await getSuggestions({
  userId: 'user123',
  command: 'deploy'
});
```

### With Web Applications

```typescript
// Track user preferences
await recordPreference({
  userId: 'user123',
  category: 'ui',
  preference: { theme: 'dark', layout: 'compact' }
});

// Apply preferences automatically
const settings = await getUserPreferences('user123');
```

## Dependencies

Uses standard TypeScript/Node.js features. Optional integrations:

- Storage backends (file system, database)
- Machine learning libraries for advanced pattern detection
- Analytics tools for pattern visualization
