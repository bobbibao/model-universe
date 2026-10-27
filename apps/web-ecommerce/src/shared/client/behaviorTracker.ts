'use client';

import type {
  RecommendationEventType,
  RecommendationStrategy,
  RecommendationSurface,
} from '@/shared/smart-recommendations';
import { readRecentlyViewed } from './recentlyViewed';

const SESSION_KEY_STORAGE = 'model-universe.rec-session.v1';
const RECENT_SEARCHES_STORAGE = 'model-universe.recent-searches.v1';
const MAX_RECENT_SEARCHES = 8;

export function getRecommendationSessionKey(): string {
  if (typeof window === 'undefined') return 'ssr-session';
  try {
    const existing = localStorage.getItem(SESSION_KEY_STORAGE);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const generated = `mu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY_STORAGE, generated);
    return generated;
  } catch {
    return 'anon-browser';
  }
}

export function readRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_SEARCHES_STORAGE) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length >= 2)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function rememberSearchQuery(query: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = query.trim().slice(0, 80);
  if (trimmed.length < 2) return;
  try {
    const prev = readRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...prev].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_STORAGE, JSON.stringify(next));
  } catch {
    /* Storage unavailable */
  }
}

export function readClientRecommendationSignals(): {
  sessionKey: string;
  recentIds: number[];
  recentQueries: string[];
} {
  const sessionKey = getRecommendationSessionKey();
  const recentIds = readRecentlyViewed()
    .map((item) => item.id)
    .filter((id): id is number => Number.isInteger(id) && id > 0)
    .slice(0, 12);
  const recentQueries = readRecentSearches();
  return { sessionKey, recentIds, recentQueries };
}

export interface TrackRecommendationEventPayload {
  eventType: RecommendationEventType;
  productId?: number | null;
  sourceProductId?: number | null;
  categoryId?: number | null;
  categorySlug?: string | null;
  searchQuery?: string | null;
  strategy?: RecommendationStrategy | null;
  surface?: RecommendationSurface | null;
  dwellMs?: number | null;
  priceVnd?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export function trackRecommendationEvent(payload: TrackRecommendationEventPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const sessionKey = getRecommendationSessionKey();
    const body = JSON.stringify({
      ...payload,
      sessionKey,
    });
    void fetch('/api/recommendations/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body,
    }).catch(() => {
      /* Telemetry is non-blocking and must never disrupt the customer experience */
    });
  } catch {
    /* Ignore serialization or storage errors */
  }
}

