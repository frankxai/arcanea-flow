/**
 * @claude-flow/cache-optimizer - Handoff Module Tests
 * Comprehensive test suite for handoff feature
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  RateLimiter,
  RateLimiterRegistry,
  PersistentStore,
  WebhookHandler,
  StreamingHandler,
} from '../handoff/index.js';
import type {
  HandoffRequest,
  HandoffResponse,
  HandoffQueueItem,
} from '../types.js';

// =============================================================================
// Circuit Breaker Tests
// =============================================================================

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      halfOpenRequests: 1,
    });
  });

  it('should start in closed state', () => {
    expect(breaker.getStats().state).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should track successful executions', () => {
    breaker.recordSuccess();
    breaker.recordSuccess();

    const stats = breaker.getStats();
    expect(stats.totalSuccesses).toBe(2);
    expect(stats.totalFailures).toBe(0);
    expect(stats.state).toBe('closed');
  });

  it('should open after failure threshold', () => {
    breaker.recordFailure(new Error('Test error 1'));
    expect(breaker.getStats().state).toBe('closed');

    breaker.recordFailure(new Error('Test error 2'));
    expect(breaker.getStats().state).toBe('closed');

    breaker.recordFailure(new Error('Test error 3'));
    expect(breaker.getStats().state).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should emit events on state changes', () => {
    const openHandler = vi.fn();
    const closeHandler = vi.fn();

    breaker.on('open', openHandler);
    breaker.on('close', closeHandler);

    // Trigger open
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(openHandler).toHaveBeenCalledTimes(1);
  });

  it('should transition to half-open after recovery timeout', async () => {
    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getStats().state).toBe('open');

    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should now allow execution (half-open)
    expect(breaker.canExecute()).toBe(true);
  });

  it('should close on successful half-open request', async () => {
    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Attempt execution in half-open state
    expect(breaker.canExecute()).toBe(true);

    // Record success
    breaker.recordSuccess();
    expect(breaker.getStats().state).toBe('closed');
  });

  it('should reopen on failure during half-open', async () => {
    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Fail during half-open
    breaker.recordFailure();
    expect(breaker.getStats().state).toBe('open');
  });

  it('should clear failure window over time', async () => {
    const shortWindowBreaker = new CircuitBreaker('short-window', {
      failureThreshold: 3,
      recoveryTimeout: 500,
      halfOpenRequests: 1,
      failureWindow: 100, // 100ms window
    });

    shortWindowBreaker.recordFailure();
    shortWindowBreaker.recordFailure();

    // Wait for failure window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // This failure should not trip the breaker since old failures expired
    shortWindowBreaker.recordFailure();
    expect(shortWindowBreaker.getStats().state).toBe('closed');
  });

  it('should reset state', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getStats().state).toBe('open');

    breaker.reset();
    expect(breaker.getStats().state).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should calculate success rate correctly', () => {
    breaker.recordSuccess();
    breaker.recordSuccess();
    breaker.recordSuccess();
    breaker.recordFailure();

    const stats = breaker.getStats();
    expect(stats.successRate).toBe(0.75); // 3/4
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should create and cache circuit breakers', () => {
    const breaker1 = registry.get('provider-1');
    const breaker2 = registry.get('provider-1');

    expect(breaker1).toBe(breaker2);
  });

  it('should track health across providers', () => {
    const breaker1 = registry.get('provider-1');
    const breaker2 = registry.get('provider-2');

    breaker1.recordSuccess();
    breaker1.recordSuccess();
    breaker1.recordFailure();

    breaker2.recordFailure();
    breaker2.recordFailure();
    breaker2.recordFailure(); // Open

    const unhealthy = registry.getUnhealthyProviders();
    expect(unhealthy).toContain('provider-2');
    expect(unhealthy).not.toContain('provider-1');
  });

  it('should get all stats', () => {
    registry.get('provider-1').recordSuccess();
    registry.get('provider-2').recordFailure();

    const stats = registry.getAllStats();
    expect(stats['provider-1'].totalSuccesses).toBe(1);
    expect(stats['provider-2'].totalFailures).toBe(1);
  });
});

// =============================================================================
// Rate Limiter Tests
// =============================================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter('test', {
      maxRequests: 3,
      windowMs: 1000,
    });
  });

  it('should allow requests under limit', () => {
    const status1 = limiter.acquire();
    expect(status1.allowed).toBe(true);
    expect(status1.remaining).toBe(2);

    const status2 = limiter.acquire();
    expect(status2.allowed).toBe(true);
    expect(status2.remaining).toBe(1);
  });

  it('should block requests over limit', () => {
    limiter.acquire();
    limiter.acquire();
    limiter.acquire();

    const status = limiter.acquire();
    expect(status.allowed).toBe(false);
    expect(status.remaining).toBe(0);
    expect(status.retryAfter).toBeGreaterThan(0);
  });

  it('should emit limited event when blocked', () => {
    const limitHandler = vi.fn();
    limiter.on('limited', limitHandler);

    limiter.acquire();
    limiter.acquire();
    limiter.acquire();
    limiter.acquire(); // Over limit

    expect(limitHandler).toHaveBeenCalledTimes(1);
  });

  it('should check without consuming slot', () => {
    limiter.acquire();

    const checkStatus = limiter.check();
    expect(checkStatus.allowed).toBe(true);
    expect(checkStatus.remaining).toBe(2);

    // Check again - should be same
    const checkStatus2 = limiter.check();
    expect(checkStatus2.remaining).toBe(2);
  });

  it('should reset after window expires', async () => {
    limiter.acquire();
    limiter.acquire();
    limiter.acquire();

    expect(limiter.acquire().allowed).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(limiter.acquire().allowed).toBe(true);
  });

  it('should track tokens per minute', () => {
    const tokenLimiter = new RateLimiter('token-test', {
      maxRequests: 100,
      windowMs: 60000,
      maxTokensPerMinute: 1000,
    });

    expect(tokenLimiter.recordTokens(500)).toBe(true);
    expect(tokenLimiter.recordTokens(400)).toBe(true);
    expect(tokenLimiter.recordTokens(200)).toBe(false); // Over limit

    const stats = tokenLimiter.getStats();
    expect(stats.tokens).toBe(900);
    expect(stats.tokensRemaining).toBe(100);
  });

  it('should enforce minimum request spacing', async () => {
    const spacedLimiter = new RateLimiter('spaced', {
      maxRequests: 100,
      windowMs: 60000,
      minRequestSpacing: 100,
    });

    expect(spacedLimiter.acquire().allowed).toBe(true);

    // Immediate second request should be blocked
    const immediate = spacedLimiter.acquire();
    expect(immediate.allowed).toBe(false);
    expect(immediate.retryAfter).toBeGreaterThan(0);

    // Wait for spacing
    await new Promise(resolve => setTimeout(resolve, 110));
    expect(spacedLimiter.acquire().allowed).toBe(true);
  });

  it('should wait for slot', async () => {
    const fastLimiter = new RateLimiter('fast', {
      maxRequests: 1,
      windowMs: 100,
    });

    fastLimiter.acquire(); // Use the slot

    const startTime = Date.now();
    const result = await fastLimiter.waitForSlot(1000);
    const elapsed = Date.now() - startTime;

    expect(result).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it('should timeout when waiting for slot', async () => {
    const slowLimiter = new RateLimiter('slow', {
      maxRequests: 1,
      windowMs: 5000,
    });

    slowLimiter.acquire();

    const result = await slowLimiter.waitForSlot(50);
    expect(result).toBe(false);
  });

  it('should reset all state', () => {
    limiter.acquire();
    limiter.acquire();

    expect(limiter.getStats().requests).toBe(2);

    limiter.reset();
    expect(limiter.getStats().requests).toBe(0);
    expect(limiter.getStats().remaining).toBe(3);
  });
});

describe('RateLimiterRegistry', () => {
  let registry: RateLimiterRegistry;

  beforeEach(() => {
    registry = new RateLimiterRegistry();
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should manage limiters for multiple providers', () => {
    expect(registry.canRequest('ollama')).toBe(true);

    const status = registry.acquire('ollama');
    expect(status.allowed).toBe(true);
  });

  it('should record tokens', () => {
    expect(registry.recordTokens('anthropic', 1000)).toBe(true);
  });

  it('should get all stats', () => {
    registry.acquire('ollama');
    registry.acquire('anthropic');

    const stats = registry.getAllStats();
    expect(stats['ollama']).toBeDefined();
    expect(stats['anthropic']).toBeDefined();
  });

  it('should reset all limiters', () => {
    registry.acquire('ollama');
    registry.acquire('anthropic');

    registry.resetAll();

    const stats = registry.getAllStats();
    expect(stats['ollama'].requests).toBe(0);
    expect(stats['anthropic'].requests).toBe(0);
  });
});

// =============================================================================
// Persistent Store Tests
// =============================================================================

describe('PersistentStore', () => {
  let store: PersistentStore;
  const testDbPath = '/tmp/test-handoff-' + Date.now() + '.db';

  beforeEach(async () => {
    store = new PersistentStore({
      dbPath: testDbPath,
      autoSaveInterval: 100,
      maxQueueItems: 10,
      maxMetricsHistory: 5,
    });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  it('should add and retrieve queue items', async () => {
    const request: HandoffRequest = {
      id: 'test-request-1',
      prompt: 'Test prompt',
      systemPrompt: 'System',
      options: { maxTokens: 1000 },
    };

    const queueItem: HandoffQueueItem = {
      request,
      status: 'pending',
      position: 0,
      addedAt: Date.now(),
      retries: 0,
    };

    await store.addToQueue(queueItem);

    const retrieved = await store.getQueueItem('test-request-1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.request.prompt).toBe('Test prompt');
    expect(retrieved!.status).toBe('pending');
  });

  it('should update queue item status', async () => {
    const request: HandoffRequest = {
      id: 'update-test',
      prompt: 'Test',
      options: {},
    };

    await store.addToQueue({
      request,
      status: 'pending',
      position: 0,
      addedAt: Date.now(),
      retries: 0,
    });

    await store.updateQueueItem('update-test', {
      status: 'processing',
      startedAt: Date.now(),
    });

    const updated = await store.getQueueItem('update-test');
    expect(updated!.status).toBe('processing');
    expect(updated!.startedAt).toBeDefined();
  });

  it('should get all queue items', async () => {
    const requests = [
      { id: 'req-1', prompt: 'Test 1', options: {} },
      { id: 'req-2', prompt: 'Test 2', options: {} },
      { id: 'req-3', prompt: 'Test 3', options: {} },
    ];

    for (let i = 0; i < requests.length; i++) {
      await store.addToQueue({
        request: requests[i] as HandoffRequest,
        status: 'pending',
        position: i,
        addedAt: Date.now(),
        retries: 0,
      });
    }

    const all = await store.getAllQueueItems();
    expect(all.length).toBe(3);
  });

  it('should filter queue items by status', async () => {
    await store.addToQueue({
      request: { id: 'pending-1', prompt: 'Test', options: {} } as HandoffRequest,
      status: 'pending',
      position: 0,
      addedAt: Date.now(),
      retries: 0,
    });

    await store.addToQueue({
      request: { id: 'completed-1', prompt: 'Test', options: {} } as HandoffRequest,
      status: 'completed',
      position: 1,
      addedAt: Date.now(),
      retries: 0,
    });

    const pending = await store.getAllQueueItems('pending');
    expect(pending.length).toBe(1);
    expect(pending[0].request.id).toBe('pending-1');
  });

  it('should remove queue items', async () => {
    await store.addToQueue({
      request: { id: 'to-remove', prompt: 'Test', options: {} } as HandoffRequest,
      status: 'pending',
      position: 0,
      addedAt: Date.now(),
      retries: 0,
    });

    await store.removeQueueItem('to-remove');

    const removed = await store.getQueueItem('to-remove');
    expect(removed).toBeNull();
  });

  it('should update and get metrics', async () => {
    await store.updateMetrics({
      totalRequests: 10,
      successfulRequests: 8,
      failedRequests: 2,
      averageLatency: 500,
    });

    const metrics = await store.getMetrics();
    expect(metrics.totalRequests).toBe(10);
    expect(metrics.successfulRequests).toBe(8);
    expect(metrics.averageLatency).toBe(500);
  });

  it('should snapshot metrics to history', async () => {
    await store.updateMetrics({
      totalRequests: 5,
      successfulRequests: 5,
      failedRequests: 0,
      averageLatency: 100,
      totalTokens: 1000,
      byProvider: { ollama: { requests: 5, tokens: 1000, avgLatency: 100, errors: 0 } },
      queueLength: 0,
      activeRequests: 0,
    });

    await store.snapshotMetrics();

    const history = await store.getMetricsHistory(10);
    expect(history.length).toBe(1);
    expect(history[0].totalRequests).toBe(5);
  });

  it('should limit metrics history size', async () => {
    for (let i = 0; i < 10; i++) {
      await store.updateMetrics({ totalRequests: i });
      await store.snapshotMetrics();
    }

    const history = await store.getMetricsHistory(100);
    expect(history.length).toBeLessThanOrEqual(5); // maxMetricsHistory = 5
  });

  it('should reset metrics', async () => {
    await store.updateMetrics({
      totalRequests: 100,
      successfulRequests: 90,
    });

    await store.resetMetrics();

    const metrics = await store.getMetrics();
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.successfulRequests).toBe(0);
  });

  it('should clear all data', async () => {
    await store.addToQueue({
      request: { id: 'test', prompt: 'Test', options: {} } as HandoffRequest,
      status: 'pending',
      position: 0,
      addedAt: Date.now(),
      retries: 0,
    });

    await store.updateMetrics({ totalRequests: 10 });

    await store.clear();

    const items = await store.getAllQueueItems();
    const metrics = await store.getMetrics();

    expect(items.length).toBe(0);
    expect(metrics.totalRequests).toBe(0);
  });
});

// =============================================================================
// Webhook Handler Tests
// =============================================================================

describe('WebhookHandler', () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    handler = new WebhookHandler();
  });

  afterEach(() => {
    handler.clear();
  });

  it('should register webhooks', () => {
    handler.register('webhook-1', {
      url: 'https://example.com/webhook',
      events: ['handoff.completed'],
    });

    const webhooks = handler.list();
    expect(webhooks.length).toBe(1);
    expect(webhooks[0].id).toBe('webhook-1');
  });

  it('should unregister webhooks', () => {
    handler.register('webhook-1', { url: 'https://example.com/webhook' });
    handler.unregister('webhook-1');

    expect(handler.list().length).toBe(0);
  });

  it('should filter webhooks by event type', async () => {
    handler.register('completed-only', {
      url: 'https://example.com/completed',
      events: ['handoff.completed'],
    });

    handler.register('failed-only', {
      url: 'https://example.com/failed',
      events: ['handoff.failed'],
    });

    // Mock fetch to track calls
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await handler.trigger('handoff.completed', { requestId: 'test' });

    // Only the completed-only webhook should be called
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/completed');
  });

  it('should include event headers in webhook calls', async () => {
    handler.register('test-webhook', {
      url: 'https://example.com/webhook',
      events: ['handoff.completed'],
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await handler.trigger('handoff.completed', { requestId: 'test-123' });

    const options = fetchMock.mock.calls[0][1];
    expect(options.headers['X-Webhook-Event']).toBe('handoff.completed');
    expect(options.headers['X-Webhook-Timestamp']).toBeDefined();
  });

  it('should retry on failure', async () => {
    handler.register('retry-test', {
      url: 'https://example.com/webhook',
      events: ['handoff.completed'],
      retry: {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 100,
      },
    });

    let attempts = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });
    global.fetch = fetchMock;

    const results = await handler.trigger('handoff.completed', { requestId: 'test' });

    expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(results.get('retry-test')!.success).toBe(true);
    expect(results.get('retry-test')!.attempts).toBe(3);
  });

  it('should not retry on client errors (4xx)', async () => {
    handler.register('no-retry', {
      url: 'https://example.com/webhook',
      events: ['handoff.completed'],
      retry: {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });
    global.fetch = fetchMock;

    const results = await handler.trigger('handoff.completed', { requestId: 'test' });

    // Should not retry on 400
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.get('no-retry')!.success).toBe(false);
  });

  it('should emit success event', async () => {
    handler.register('success-test', {
      url: 'https://example.com/webhook',
      events: ['handoff.completed'],
    });

    const successHandler = vi.fn();
    handler.on('success', successHandler);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await handler.trigger('handoff.completed', { requestId: 'test' });

    expect(successHandler).toHaveBeenCalledWith({
      id: 'success-test',
      event: 'handoff.completed',
      attempts: 1,
    });
  });

  it('should emit failure event', async () => {
    handler.register('failure-test', {
      url: 'https://example.com/webhook',
      events: ['handoff.completed'],
      retry: { maxRetries: 0, baseDelay: 10, maxDelay: 100 },
    });

    const failureHandler = vi.fn();
    handler.on('failure', failureHandler);

    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock;

    await handler.trigger('handoff.completed', { requestId: 'test' });

    expect(failureHandler).toHaveBeenCalled();
    expect(failureHandler.mock.calls[0][0].error).toBe('Network error');
  });

  it('should test webhook', async () => {
    handler.register('test-webhook', {
      url: 'https://example.com/webhook',
      events: ['handoff.completed'],
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    const result = await handler.test('test-webhook');

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should return error for non-existent webhook test', async () => {
    const result = await handler.test('non-existent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Webhook not found');
  });
});

// =============================================================================
// Streaming Handler Tests
// =============================================================================

describe('StreamingHandler', () => {
  let handler: StreamingHandler;

  beforeEach(() => {
    handler = new StreamingHandler();
  });

  afterEach(() => {
    handler.cancelAll();
  });

  it('should track active streams', () => {
    expect(handler.getActiveCount()).toBe(0);
  });

  it('should emit chunk events', async () => {
    const chunks: Array<{ type: string; content?: string }> = [];
    handler.on('chunk', chunk => chunks.push(chunk));

    // Mock a simple Ollama stream
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => {
          let read = false;
          return {
            read: async () => {
              if (!read) {
                read = true;
                const encoder = new TextEncoder();
                return {
                  done: false,
                  value: encoder.encode(JSON.stringify({
                    message: { content: 'Hello ' },
                  }) + '\n' + JSON.stringify({
                    message: { content: 'world!' },
                    done: true,
                    prompt_eval_count: 10,
                    eval_count: 5,
                  })),
                };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const request: HandoffRequest = {
      id: 'stream-test',
      prompt: 'Test',
      options: {},
    };

    const result = await handler.streamFromOllama(
      request,
      { name: 'ollama', type: 'ollama', endpoint: 'http://localhost:11434', model: 'llama2' },
    );

    expect(result.content).toBe('Hello world!');
    expect(result.status).toBe('completed');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should cancel active streams', () => {
    // Start a stream (mocked to be long-running)
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: () => new Promise(() => {}), // Never resolves
        }),
      },
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const request: HandoffRequest = {
      id: 'cancel-test',
      prompt: 'Test',
      options: {},
    };

    // Start stream but don't await
    handler.streamFromOllama(
      request,
      { name: 'ollama', type: 'ollama', endpoint: 'http://localhost:11434', model: 'llama2' },
    );

    expect(handler.getActiveCount()).toBe(1);

    const cancelled = handler.cancel('cancel-test');
    expect(cancelled).toBe(true);
    expect(handler.getActiveCount()).toBe(0);
  });

  it('should handle stream errors gracefully', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: () => Promise.reject(new Error('Stream error')),
        }),
      },
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const errorHandler = vi.fn();

    const request: HandoffRequest = {
      id: 'error-test',
      prompt: 'Test',
      options: {},
    };

    const result = await handler.streamFromOllama(
      request,
      { name: 'ollama', type: 'ollama', endpoint: 'http://localhost:11434', model: 'llama2' },
      { onError: errorHandler },
    );

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
    expect(errorHandler).toHaveBeenCalled();
  });

  it('should return error for missing API keys', async () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const request: HandoffRequest = {
      id: 'no-key-test',
      prompt: 'Test',
      options: {},
    };

    const result = await handler.streamFromAnthropic(
      request,
      { name: 'anthropic', type: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-3' },
    );

    expect(result.status).toBe('failed');
    expect(result.error).toBe('No Anthropic API key');

    process.env.ANTHROPIC_API_KEY = originalEnv;
  });

  it('should call onComplete callback', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => {
          let read = false;
          return {
            read: async () => {
              if (!read) {
                read = true;
                return {
                  done: false,
                  value: new TextEncoder().encode(JSON.stringify({
                    message: { content: 'Done' },
                    done: true,
                  })),
                };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const onComplete = vi.fn();

    const request: HandoffRequest = {
      id: 'complete-test',
      prompt: 'Test',
      options: {},
    };

    await handler.streamFromOllama(
      request,
      { name: 'ollama', type: 'ollama', endpoint: 'http://localhost:11434', model: 'llama2' },
      { onComplete },
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].content).toBe('Done');
  });

  it('should respect abort signal', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: () => new Promise(() => {}), // Never resolves
        }),
      },
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const controller = new AbortController();

    const request: HandoffRequest = {
      id: 'abort-test',
      prompt: 'Test',
      options: {},
    };

    const streamPromise = handler.streamFromOllama(
      request,
      { name: 'ollama', type: 'ollama', endpoint: 'http://localhost:11434', model: 'llama2' },
      { signal: controller.signal },
    );

    // Abort after a short delay
    setTimeout(() => controller.abort(), 10);

    const result = await streamPromise;
    expect(result.status).toBe('failed');
  });
});
