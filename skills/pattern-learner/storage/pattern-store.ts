import type {
  Pattern,
  PatternQuery,
  PatternStoreOptions,
  StorageBackend,
} from "../types.ts";

// In-memory storage implementation (can be replaced with persistent storage)
class InMemoryStorage implements StorageBackend {
  private patterns: Map<string, Pattern> = new Map();

  async save(pattern: Pattern): Promise<void> {
    this.patterns.set(pattern.id, pattern);
  }

  async load(id: string): Promise<Pattern | undefined> {
    return this.patterns.get(id);
  }

  async query(query: PatternQuery): Promise<Pattern[]> {
    let results = Array.from(this.patterns.values());

    if (query.userId) {
      results = results.filter((p) =>
        p.metadata.userId === query.userId
      );
    }

    if (query.type) {
      results = results.filter((p) => p.type === query.type);
    }

    if (query.category) {
      results = results.filter((p) => p.category === query.category);
    }

    if (query.minConfidence !== undefined) {
      results = results.filter((p) => p.confidence >= query.minConfidence);
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async delete(id: string): Promise<boolean> {
    return this.patterns.delete(id);
  }

  async clear(userId: string): Promise<number> {
    let count = 0;
    for (const [id, pattern] of this.patterns.entries()) {
      if (pattern.metadata.userId === userId) {
        this.patterns.delete(id);
        count++;
      }
    }
    return count;
  }
}

// Default storage instance
let storageBackend: StorageBackend = new InMemoryStorage();
let storeOptions: PatternStoreOptions = {
  retentionDays: 90,
  maxPatterns: 10000,
  compressionEnabled: false,
};

/**
 * Sets the storage backend
 */
export function setStorageBackend(backend: StorageBackend): void {
  storageBackend = backend;
}

/**
 * Gets the current storage backend
 */
export function getStorageBackend(): StorageBackend {
  return storageBackend;
}

/**
 * Configures pattern storage options
 */
export function configureStorage(options: PatternStoreOptions): void {
  storeOptions = { ...storeOptions, ...options };
}

/**
 * Stores a pattern
 */
export async function storePattern(pattern: Pattern): Promise<void> {
  await storageBackend.save(pattern);
}

/**
 * Retrieves a pattern by ID
 */
export async function getPattern(id: string): Promise<Pattern | undefined> {
  return await storageBackend.load(id);
}

/**
 * Queries patterns based on criteria
 */
export async function queryPatterns(
  query: PatternQuery,
): Promise<Pattern[]> {
  return await storageBackend.query(query);
}

/**
 * Updates an existing pattern
 */
export async function updatePattern(pattern: Pattern): Promise<void> {
  const existing = await storageBackend.load(pattern.id);
  if (!existing) {
    throw new Error(`Pattern ${pattern.id} not found`);
  }

  const updated = {
    ...existing,
    ...pattern,
    occurrences: existing.occurrences + 1,
    lastSeen: new Date().toISOString(),
    confidence: calculateUpdatedConfidence(existing, pattern),
  };

  await storageBackend.save(updated);
}

/**
 * Deletes a pattern
 */
export async function deletePattern(id: string): Promise<boolean> {
  return await storageBackend.delete(id);
}

/**
 * Clears all patterns for a user
 */
export async function clearUserPatterns(userId: string): Promise<number> {
  return await storageBackend.clear(userId);
}

/**
 * Gets patterns for a specific user
 */
export async function getUserPatterns(
  userId: string,
  options?: { type?: string; minConfidence?: number },
): Promise<Pattern[]> {
  return await storageBackend.query({
    userId,
    type: options?.type as any,
    minConfidence: options?.minConfidence,
  });
}

/**
 * Cleans up old patterns based on retention policy
 */
export async function cleanupOldPatterns(): Promise<number> {
  const retentionMs = (storeOptions.retentionDays || 90) * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - retentionMs).toISOString();

  const allPatterns = await storageBackend.query({});
  let deletedCount = 0;

  for (const pattern of allPatterns) {
    if (pattern.lastSeen < cutoffDate) {
      await storageBackend.delete(pattern.id);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Calculates updated confidence when merging patterns
 */
function calculateUpdatedConfidence(
  existing: Pattern,
  update: Pattern,
): number {
  // Weighted average based on occurrences
  const totalOccurrences = existing.occurrences + 1;
  return (
    (existing.confidence * existing.occurrences + update.confidence) /
    totalOccurrences
  );
}

/**
 * Generates a unique pattern ID
 */
export function generatePatternId(
  userId: string,
  type: string,
  category: string,
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${userId}-${type}-${category}-${timestamp}-${random}`;
}

/**
 * Exports patterns to JSON
 */
export async function exportPatterns(
  userId: string,
): Promise<string> {
  const patterns = await getUserPatterns(userId);
  return JSON.stringify(patterns, null, 2);
}

/**
 * Imports patterns from JSON
 */
export async function importPatterns(
  jsonData: string,
): Promise<number> {
  const patterns = JSON.parse(jsonData) as Pattern[];
  for (const pattern of patterns) {
    await storePattern(pattern);
  }
  return patterns.length;
}

/**
 * Gets storage statistics
 */
export async function getStorageStats(): Promise<{
  totalPatterns: number;
  userCount: number;
  averageConfidence: number;
}> {
  const allPatterns = await storageBackend.query({});
  const userIds = new Set(
    allPatterns.map((p) => p.metadata.userId as string).filter(Boolean),
  );

  const totalConfidence = allPatterns.reduce(
    (sum, p) => sum + p.confidence,
    0,
  );
  const averageConfidence =
    allPatterns.length > 0 ? totalConfidence / allPatterns.length : 0;

  return {
    totalPatterns: allPatterns.length,
    userCount: userIds.size,
    averageConfidence,
  };
}
