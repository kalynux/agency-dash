/**
 * The geometry behind swipe-to-navigate.
 *
 * The rule that matters most here is the edge dead zone. Every other test in
 * this file guards against a gesture that fails to fire, which is a small
 * annoyance; that one guards against a gesture that fires when the user was
 * asking the operating system to go back, which breaks the control people rely
 * on to leave any screen.
 */
import { describe, it, expect } from 'vitest';
import { isEdgeStart, swipeDirection } from './use-swipe-navigation';

const VIEWPORT = 390; // a common phone width, in CSS pixels

// ─── The system back gesture ──────────────────────────────────────────────────

describe('isEdgeStart', () => {
  it('claims the left edge, where the back gesture starts', () => {
    expect(isEdgeStart(0, VIEWPORT)).toBe(true);
    expect(isEdgeStart(20, VIEWPORT)).toBe(true);
    // Android lets the user widen the zone to 40dp; the inset is wider still.
    expect(isEdgeStart(40, VIEWPORT)).toBe(true);
  });

  it('claims the right edge too — the gesture works from both sides', () => {
    expect(isEdgeStart(VIEWPORT, VIEWPORT)).toBe(true);
    expect(isEdgeStart(VIEWPORT - 20, VIEWPORT)).toBe(true);
  });

  it('leaves the middle of the screen alone', () => {
    expect(isEdgeStart(VIEWPORT / 2, VIEWPORT)).toBe(false);
    expect(isEdgeStart(45, VIEWPORT)).toBe(false);
    expect(isEdgeStart(VIEWPORT - 45, VIEWPORT)).toBe(false);
  });

  it('treats a narrow viewport as all edge rather than guessing', () => {
    // Nothing real is this narrow, but the arithmetic must not invert and
    // silently declare the whole screen safe.
    expect(isEdgeStart(40, 80)).toBe(true);
  });
});

// ─── What counts as a swipe ───────────────────────────────────────────────────

describe('swipeDirection', () => {
  const quick = { durationMs: 200 };

  it('reads a leftward flick as forward', () => {
    expect(swipeDirection({ dx: -120, dy: 4, ...quick })).toBe('next');
  });

  it('reads a rightward flick as backward', () => {
    expect(swipeDirection({ dx: 120, dy: -6, ...quick })).toBe('previous');
  });

  it('mirrors both in a right-to-left document', () => {
    // The gesture follows the text: in Arabic a page turns the other way.
    expect(swipeDirection({ dx: -120, dy: 0, ...quick }, true)).toBe('previous');
    expect(swipeDirection({ dx: 120, dy: 0, ...quick }, true)).toBe('next');
  });

  it('ignores a drag that barely moved', () => {
    expect(swipeDirection({ dx: -40, dy: 0, ...quick })).toBeNull();
  });

  it('ignores a scroll with a sideways wobble', () => {
    // The common false positive: a finger dragging a long list down the screen
    // never travels perfectly straight.
    expect(swipeDirection({ dx: -80, dy: 200, ...quick })).toBeNull();
    expect(swipeDirection({ dx: -80, dy: 60, ...quick })).toBeNull();
  });

  it('accepts a swipe that is mostly horizontal', () => {
    expect(swipeDirection({ dx: -140, dy: 40, ...quick })).toBe('next');
  });

  it('ignores a slow drag', () => {
    // Past the ceiling the finger was doing something else — holding a row,
    // dragging a control, deciding — and navigating would be a surprise.
    expect(swipeDirection({ dx: -200, dy: 0, durationMs: 1500 })).toBeNull();
  });
});
