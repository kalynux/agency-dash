/**
 * How this app decides what kind of file it is holding.
 *
 * `access` gained a third value, `quota_blocked`, on 2026-09-07
 * (api-doc/files/private-files.md § The third value). The failure it causes is
 * quiet and everywhere: with a two-valued union, a blocked file is not
 * `authorized`, so `resolveFileUrl` falls through to the `key` fallback and
 * manufactures a URL that looks exactly like a real one and serves 404 — a
 * broken image on every avatar, logo, thumbnail and media tile whose owner is
 * over their plan.
 */
import { describe, it, expect } from 'vitest';
import { fileAccessState, isAuthorizedFile, isQuotaBlockedFile, resolveFileUrl } from './files.service';

const publicFile = { key: 'images/2026/09/logo.png', url: 'https://cdn.example.com/logo.png' };
const blocked = { ...publicFile, access: 'quota_blocked' as const, url: null };
const authorized = { key: 'shipments/2026/09/proof.jpg', url: null, access: 'authorized' as const };

describe('fileAccessState', () => {
  it('reads `access` when the payload carries it', () => {
    expect(fileAccessState({ ...publicFile, access: 'public' })).toBe('public');
    expect(fileAccessState(authorized)).toBe('authorized');
    expect(fileAccessState(blocked)).toBe('quota_blocked');
  });

  it('falls back to the key prefix on a payload predating `access`', () => {
    // The same three trees the backend routes on, so the two cannot disagree.
    expect(fileAccessState({ key: 'shipments/a.jpg', url: null })).toBe('authorized');
    expect(fileAccessState({ key: 'digital/a.zip', url: null })).toBe('authorized');
    expect(fileAccessState({ key: 'ticket-attachments/a.png', url: null })).toBe('authorized');
    expect(fileAccessState(publicFile)).toBe('public');
  });

  it('treats a blocked file in a private tree as blocked, not authorized', () => {
    // Precedence, and it matters: branching on `authorized` first sends the
    // client to the owning entity's byte route, which answers about permissions
    // when the real problem is billing.
    expect(fileAccessState({ key: 'shipments/p.jpg', url: null, access: 'quota_blocked' })).toBe(
      'quota_blocked',
    );
    expect(isAuthorizedFile({ key: 'shipments/p.jpg', url: null, access: 'quota_blocked' })).toBe(
      false,
    );
  });
});

describe('resolveFileUrl', () => {
  it('returns the URL for a public file', () => {
    expect(resolveFileUrl(publicFile)).toBe('https://cdn.example.com/logo.png');
  });

  it('rebuilds from `key` only for a public file with no url', () => {
    expect(resolveFileUrl({ key: 'images/2026/09/a.png', url: null })).toContain(
      '/files/images/2026/09/a.png',
    );
  });

  it('NEVER manufactures a URL for a blocked file', () => {
    // The regression this whole change exists to prevent.
    expect(resolveFileUrl(blocked)).toBeNull();
    expect(resolveFileUrl({ key: 'images/2026/09/a.png', url: null, access: 'quota_blocked' }))
      .toBeNull();
  });

  it('never manufactures one for an authorized file either', () => {
    expect(resolveFileUrl(authorized)).toBeNull();
  });
});

describe('isQuotaBlockedFile', () => {
  it('is true only for the billing state', () => {
    expect(isQuotaBlockedFile(blocked)).toBe(true);
    expect(isQuotaBlockedFile(authorized)).toBe(false);
    expect(isQuotaBlockedFile(publicFile)).toBe(false);
  });
});
