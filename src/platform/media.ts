/**
 * Camera and photo library (CAPACITOR-PLAN.md → P4.3).
 *
 * The point of this module is what it *doesn't* change. Everything downstream of
 * a picked file — the per-type size caps, the video/non-video endpoint split,
 * the progress XHR, the storage-quota errors — already exists in
 * `files.service.ts` and is exercised by the web build every day. So the native
 * capture is converted to a plain `File` and handed to exactly that path.
 * Nothing after this line knows a camera was involved.
 *
 * A WebView's `<input type="file">` does reach the system picker on Android, and
 * it is kept as the third option for documents. What it cannot do is open the
 * camera directly with a usable result, or offer the modern photo picker — so
 * "attach a photo of the delivery" costs three taps and a detour through Files.
 *
 * Permission outcomes come back distinguished (`./permissions`), because a
 * permanently-denied camera needs the settings screen, not a retry button.
 */
import { Camera, MediaTypeSelection, type MediaResult } from '@capacitor/camera';
import { isNative } from './env';
import { toOutcome, type AnyPermissionState } from './permissions';
import { suspendAppStateWatch } from './shell/appState';

/** Where the user wants the media to come from. */
export type MediaSource = 'camera' | 'gallery';

export type MediaPickResult =
  | { status: 'picked'; files: File[] }
  /** The user backed out. Says nothing and shows nothing. */
  | { status: 'cancelled' }
  /** Refused this time — asking again is reasonable. */
  | { status: 'denied' }
  /** Refused for good; only the system settings screen can undo it. */
  | { status: 'blocked' }
  /** No camera on this device, or no native media capability at all. */
  | { status: 'unavailable' }
  | { status: 'error' };

/** Whether the native sheet has anything to offer. False on the web build. */
export const nativeMediaAvailable = isNative;

/**
 * JPEG quality for a camera capture.
 *
 * The plugin's default is 100, which on a modern phone sensor is an 8–12 MB
 * file — over the agency image cap of 10 MB (storage.md §1), so the first photo
 * a user takes would be rejected by our own validator. 85 is visually
 * indistinguishable for a delivery proof and lands comfortably under it.
 */
const CAPTURE_QUALITY = 85;

/** Codes the plugin uses for "the user backed out". Not failures. */
const CANCELLED_CODES = new Set([
  'OS-PLUG-CAMR-0006', // TakePhotoCancelled
  'OS-PLUG-CAMR-0020', // ChooseMediaCancelled
  'OS-PLUG-CAMR-0017', // RecordVideoCancelled
]);

/** Codes that mean the OS refused us, as opposed to the user. */
const PERMISSION_CODES = new Set([
  'OS-PLUG-CAMR-0003', // CameraPermissionDenied
  'OS-PLUG-CAMR-0005', // GalleryPermissionDenied
]);

/** No camera hardware. */
const NO_CAMERA_CODE = 'OS-PLUG-CAMR-0007';

function codeOf(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Ensure the grant `source` needs, prompting at most once.
 *
 * Only the permission actually being used is requested — asking for the photo
 * library when the user tapped "Take photo" is how an app trains people to
 * decline prompts on principle.
 */
async function ensurePermission(source: MediaSource): Promise<'granted' | 'denied' | 'blocked'> {
  const key = source === 'camera' ? 'camera' : 'photos';
  try {
    const before: AnyPermissionState = (await Camera.checkPermissions())[key];
    if (before === 'granted' || before === 'limited') return 'granted';

    const after: AnyPermissionState = (
      await Camera.requestPermissions({ permissions: [key] })
    )[key];
    return toOutcome(before, after);
  } catch (err) {
    console.error('[media] permission check failed', err);
    return 'denied';
  }
}

// ─── Conversion ───────────────────────────────────────────────────────────────

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

/** Extension for a MIME type, when the metadata did not carry a format. */
const FORMAT_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_BY_FORMAT).map(([format, mime]) => [mime, format]),
);

/**
 * Build a filename with a real extension.
 *
 * `validateMediaSelection` and `isVideoUpload` both fall back to the extension
 * when `File.type` is empty — which is exactly what happens for `.mov` — so a
 * name like "image" would route a QuickTime video to the general upload
 * endpoint, which rejects video outright.
 */
function fileNameFor(media: MediaResult, extension: string, index: number): string {
  const fromUri = media.uri?.split(/[\\/]/).pop()?.split('?')[0];
  if (fromUri && /\.[a-z0-9]{2,5}$/i.test(fromUri)) return fromUri;
  return `capture-${Date.now()}-${index + 1}.${extension}`;
}

/**
 * Read one native media result into a `File`.
 *
 * `webPath` is the one to fetch, not `uri`. `uri` is a `file://` path the
 * WebView cannot read cross-origin; `webPath` is served by Capacitor's own local
 * handler on the app origin, so an ordinary `fetch` works and the bytes arrive
 * without a base64 round trip through the bridge.
 */
async function toFile(media: MediaResult, index: number): Promise<File | null> {
  const src = media.webPath ?? media.uri;
  if (!src) return null;

  const blob = await (await fetch(src)).blob();

  const format = (media.metadata?.format ?? '').toLowerCase();

  // The plugin's own declared format wins over the `Content-Type` the local file
  // handler served. That handler answers from a static extension table and
  // falls back to `application/octet-stream` for anything it does not know —
  // which `kindFromMime` reads as a *document*, so a perfectly good photo would
  // be filtered out of an image-only slot on the way back into MediaPicker.
  // The format came from the OS's own media metadata and is the better source.
  const type = MIME_BY_FORMAT[format] || blob.type || '';
  const extension = format || FORMAT_BY_MIME[type] || 'jpg';

  return new File([blob], fileNameFor(media, extension, index), {
    type,
    lastModified: Date.now(),
  });
}

async function toFiles(results: MediaResult[]): Promise<File[]> {
  const files = await Promise.all(
    results.map((media, index) =>
      toFile(media, index).catch((err) => {
        // One unreadable item does not sink the rest of a multi-selection.
        console.warn('[media] could not read a picked item', err);
        return null;
      }),
    ),
  );
  return files.filter((f): f is File => f !== null);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export interface PickMediaOptions {
  /** Allow more than one item. Gallery only — a capture is always one photo. */
  multiple?: boolean;
  /** Cap a multiple selection. Mirrors the caller's own upload limit. */
  limit?: number;
  /** Offer videos as well as photos in the gallery. */
  allowVideo?: boolean;
}

/**
 * Pick media from the camera or the library, as `File`s ready for the existing
 * upload path.
 *
 * Never throws. Every failure is one of the statuses, because the caller has to
 * say something different for each and a thrown error flattens them all into
 * "something went wrong".
 */
export async function pickMedia(
  source: MediaSource,
  options: PickMediaOptions = {},
): Promise<MediaPickResult> {
  if (!isNative) return { status: 'unavailable' };

  const permission = await ensurePermission(source);
  if (permission !== 'granted') return { status: permission };

  // The camera and the gallery are separate activities, so this whole call is a
  // stretch with our app in the background — and browsing a photo library is a
  // slow, deliberate thing. Without this the biometric app lock would read the
  // round trip as "the user walked away" and greet them with an unlock screen
  // the moment they finished choosing a picture. See platform/shell/appState.ts.
  const releaseAppStateWatch = suspendAppStateWatch();

  try {
    if (source === 'camera') {
      const shot = await Camera.takePhoto({
        quality: CAPTURE_QUALITY,
        // Not saved to the camera roll: this is a delivery proof being uploaded,
        // and quietly filling someone's gallery with them is not ours to do.
        saveToGallery: false,
        includeMetadata: true,
      });
      const files = await toFiles([shot]);
      return files.length > 0 ? { status: 'picked', files } : { status: 'error' };
    }

    const picked = await Camera.chooseFromGallery({
      mediaType: options.allowVideo ? MediaTypeSelection.All : MediaTypeSelection.Photo,
      allowMultipleSelection: options.multiple ?? false,
      ...(options.limit ? { limit: options.limit } : {}),
      includeMetadata: true,
    });
    if (picked.results.length === 0) return { status: 'cancelled' };

    const files = await toFiles(picked.results);
    return files.length > 0 ? { status: 'picked', files } : { status: 'error' };
  } catch (err) {
    const code = codeOf(err);
    if (CANCELLED_CODES.has(code)) return { status: 'cancelled' };
    if (code === NO_CAMERA_CODE) return { status: 'unavailable' };
    // A permission refused at the point of use rather than at the check above —
    // possible when the grant is revoked between the two.
    if (PERMISSION_CODES.has(code)) return { status: 'blocked' };
    console.error('[media] could not pick media', err);
    return { status: 'error' };
  } finally {
    releaseAppStateWatch();
  }
}
