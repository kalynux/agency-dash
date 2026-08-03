// ─── Media Library ────────────────────────────────────────────────────────────
// The agency's media manager, driven entirely by the shared File Management
// Service (api-doc/agency/file-management.md). Files are FLAT (no folders).
//
// An inspector resolves exactly where each file is attached — profile avatar,
// magazin logo, ticket attachment, agent delivery proof — from the `usage`
// references, never from `usageCount`. A file is only deletable once nothing
// references it, so the inspector is the place that tells you what to detach.

import { formatDate } from '@/lib/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Grid3X3,
  HardDrive,
  Image as ImageIcon,
  Inbox,
  Layers,
  LifeBuoy,
  Link2,
  List,
  Loader2,
  Music,
  Package,
  Paperclip,
  Pencil,
  Play,
  Store,
  Trash2,
  Truck,
  Upload,
  User,
  UserCircle,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/state-views';
import { InfoHint } from '@/components/common/InfoHint';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn, formatFileSize, storageBarColor, storagePercent } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';
import { tx, txStatic, type AnyTFunction } from '@/i18n/tx';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import { ApiError } from '@/types/api';
import {
  categoryFromKind,
  deleteFile,
  getFile,
  getFilesUsage,
  kindFromMime,
  listFiles,
  resolveFileUrl,
  updateFileName,
  uploadMediaWithProgress,
  validateMediaSelection,
  MAX_FILES_PER_UPLOAD,
  MAX_VIDEOS_PER_UPLOAD,
} from '@/services/files.service';
import type {
  ApiFile,
  ApiFileDetail,
  FileKind,
  FilePagination,
  FileReference,
  FileSortField,
  StorageProvider,
  StorageUsage,
} from '@/types/file.types';

const PAGE_LIMIT = 24;
const SEARCH_DEBOUNCE_MS = 300;

const KIND_ICONS: Record<FileKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
};

const KIND_TINTS: Record<FileKind, string> = {
  image: 'bg-blue-500/10 text-blue-600',
  video: 'bg-purple-500/10 text-purple-600',
  audio: 'bg-emerald-500/10 text-emerald-600',
  document: 'bg-orange-500/10 text-orange-600',
};

const KIND_FILTER_VALUES: (FileKind | 'all')[] = ['all', 'image', 'video', 'audio', 'document'];

const PROVIDERS: StorageProvider[] = ['local', 's3', 'gcs', 'r2', 'firebase', 'cloudinary'];

const ALL_PROVIDERS = '__all__';

type SortValue = `${FileSortField}:${'asc' | 'desc'}`;

/** Sort choices, with their copy as keys — this table is module-scope data. */
const SORT_OPTIONS: { value: SortValue; labelKey: string }[] = [
  { value: 'createdAt:desc', labelKey: 'media:sort.newest' },
  { value: 'createdAt:asc', labelKey: 'media:sort.oldest' },
  { value: 'originalName:asc', labelKey: 'media:sort.nameAsc' },
  { value: 'originalName:desc', labelKey: 'media:sort.nameDesc' },
  { value: 'size:desc', labelKey: 'media:sort.largest' },
  { value: 'size:asc', labelKey: 'media:sort.smallest' },
];

// ─── Usage references ─────────────────────────────────────────────────────────

interface ReferenceVisual {
  Icon: typeof Package;
  typeLabel: string;
  /** Where the agency goes to detach it, when they can. */
  detachHint: string;
}

/**
 * Describe one `usage.references[]` entry. The visual slot (`field`) wins over the
 * raw entity type — an agency recognises "Business logo" long before "magazin".
 * Anything unknown falls back to a generic row rather than breaking.
 */
function describeReference(ref: FileReference, t: AnyTFunction): ReferenceVisual {
  const label = (key: string, hintKey: string) => ({
    typeLabel: tx(t, `media:references.${key}`),
    detachHint: tx(t, `media:references.${hintKey}`),
  });

  switch (ref.field) {
    case 'avatar':
      return { Icon: UserCircle, ...label('avatar', 'avatarHint') };
    case 'logo':
      return { Icon: Store, ...label('logo', 'logoHint') };
    case 'banner':
    case 'cover':
      return {
        Icon: ImageIcon,
        ...label(ref.field === 'cover' ? 'cover' : 'banner', 'bannerHint'),
      };
    case 'delivery_proof':
      return { Icon: Truck, ...label('deliveryProof', 'deliveryProofHint') };
    case 'attachment':
      return { Icon: Paperclip, ...label('ticketAttachment', 'ticketAttachmentHint') };
  }

  switch (ref.entityType) {
    case 'shipment':
      return { Icon: Truck, ...label('shipment', 'shipmentHint') };
    case 'ticket':
      return { Icon: LifeBuoy, ...label('ticket', 'ticketAttachmentHint') };
    case 'agency':
    case 'magazin':
      return { Icon: Building2, ...label('agency', 'agencyHint') };
    case 'agent':
      return { Icon: User, ...label('agent', 'agentHint') };
    case 'product':
      return { Icon: Package, ...label('product', 'productHint') };
    default:
      return { Icon: Link2, ...label('generic', 'genericHint') };
  }
}

// ─── File artwork ─────────────────────────────────────────────────────────────

function FileArtwork({
  file,
  className,
  controls = false,
}: {
  file: ApiFile;
  className?: string;
  /** Detail view renders a full player; a thumbnail shows a poster + play badge. */
  controls?: boolean;
}) {
  const kind = kindFromMime(file.mimeType);
  const Icon = KIND_ICONS[kind];
  const [broken, setBroken] = useState(false);
  const url = resolveFileUrl(file);

  // Local-provider files are served by the API behind the session cookie, so the
  // media elements have to send credentials.
  if (kind === 'image' && !broken) {
    return (
      <img
        src={url}
        alt={file.originalName ?? txStatic('media:preview.fileAlt')}
        crossOrigin="use-credentials"
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn('h-full w-full object-cover', className)}
        draggable={false}
      />
    );
  }

  if (kind === 'video' && !broken) {
    if (controls) {
      return (
        <video
          src={url}
          controls
          preload="metadata"
          crossOrigin="use-credentials"
          playsInline
          onError={() => setBroken(true)}
          className={cn('h-full w-full bg-black object-contain', className)}
        />
      );
    }
    return (
      <div className={cn('relative h-full w-full bg-black', className)}>
        <video
          src={url}
          muted
          preload="metadata"
          crossOrigin="use-credentials"
          playsInline
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm">
            <Play className="h-5 w-5" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center', className)}>
      <div className={cn('rounded-xl p-4', KIND_TINTS[kind])}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
}

/** Rich preview for the inspector — documents hand off to a new tab (e.g. PDFs). */
function FilePreview({ file }: { file: ApiFile }) {
  const { t } = useTranslation('media');
  const kind = kindFromMime(file.mimeType);
  const url = resolveFileUrl(file);

  if (kind === 'image' || kind === 'video') return <FileArtwork file={file} controls />;

  if (kind === 'audio') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
        <div className={cn('rounded-xl p-4', KIND_TINTS.audio)}>
          <Music className="h-8 w-8" />
        </div>
        <audio src={url} controls crossOrigin="use-credentials" className="w-full max-w-sm" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:bg-muted"
    >
      <div className={cn('rounded-xl p-4', KIND_TINTS.document)}>
        <FileText className="h-8 w-8" />
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ExternalLink className="h-4 w-4" />
        {t('preview.openInNewTab')}
      </span>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MediaLibrary() {
  const { t } = useTranslation(['media', 'common']);
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Server-driven list state
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [pagination, setPagination] = useState<FilePagination | null>(null);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<FileKind | 'all'>('all');
  const [provider, setProvider] = useState<StorageProvider | 'all'>('all');
  const [sort, setSort] = useState<SortValue>('createdAt:desc');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Account-wide usage + plan limit, embedded in the file listing.
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  // Reference-based enrichment cache — the source of attachment truth.
  const [detailCache, setDetailCache] = useState<Record<string, ApiFileDetail>>({});

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [inspectId, setInspectId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [sortBy, sortOrder] = sort.split(':') as [FileSortField, 'asc' | 'desc'];

  // Debounce the search box into the applied query. Every query change resets to
  // page 1 alongside the change itself, so a filter switch is a single refetch.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listFiles({
        page,
        limit: PAGE_LIMIT,
        search: search || undefined,
        category: kind === 'all' ? undefined : categoryFromKind(kind),
        provider: provider === 'all' ? undefined : provider,
        sortBy,
        sortOrder,
      });
      setFiles(res.files);
      setPagination(res.pagination);
      if (res.storage) setStorage(res.storage);
      setIsLoading(false);

      // Enrich the page with usage references so attachment status is real. This
      // is one request per file, so it runs *after* the grid is on screen — each
      // card shows a spinner in place of its status chip until its detail lands.
      const ids = res.files.map((f) => f.id);
      if (ids.length > 0) {
        const map = await getFilesUsage(ids);
        setDetailCache((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setIsLoading(false);
    }
  }, [page, search, kind, provider, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const pageStats = useMemo(() => {
    let attached = 0;
    let unused = 0;
    let resolved = 0;
    for (const f of files) {
      const d = detailCache[f.id];
      if (!d) continue;
      resolved += 1;
      if (d.usage.totalReferences > 0) attached += 1;
      else unused += 1;
    }
    return { attached, unused, resolved };
  }, [files, detailCache]);

  const inspectFile = inspectId ? files.find((f) => f.id === inspectId) : undefined;
  const inspectDetail = inspectId ? (detailCache[inspectId] ?? null) : null;

  const hasFilters = !!search || kind !== 'all' || provider !== 'all';

  const kindFilters = useMemo(
    () =>
      KIND_FILTER_VALUES.map((v) => ({
        value: v,
        label: v === 'all' ? t('filters.all') : t(`kinds.${v}` as const),
      })),
    [t],
  );

  const providerFilters = useMemo(
    () => [
      { value: ALL_PROVIDERS as StorageProvider | typeof ALL_PROVIDERS, label: t('filters.allProviders') },
      // Provider names are product names, not copy — they stay upper-cased as-is.
      ...PROVIDERS.map((p) => ({ value: p, label: p.toUpperCase() })),
    ],
    [t],
  );

  const sortOptions = useMemo(
    () => SORT_OPTIONS.map((o) => ({ value: o.value, label: tx(t, o.labelKey) })),
    [t],
  );

  /** Sort counts too — it changes which files land on the page you're looking at. */
  const activeFilterCount =
    (kind === 'all' ? 0 : 1) + (provider === 'all' ? 0 : 1) + (sort === 'createdAt:desc' ? 0 : 1);

  // ─── Upload ─────────────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    async (picked: FileList | File[]) => {
      const arr = Array.from(picked);
      if (arr.length === 0) return;

      const invalid = validateMediaSelection(arr);
      if (invalid) {
        toast.error(invalid);
        return;
      }

      setUploading(true);
      setUploadPercent(0);
      setUploadLabel(
        arr.length === 1 ? arr[0].name : t('upload.fileCount', { count: arr.length }),
      );
      try {
        await uploadMediaWithProgress(arr, setUploadPercent);
        toast.success(t('upload.succeeded', { count: arr.length }));
        // Newest-first is the default, so land the user where the files are.
        if (page !== 1) setPage(1);
        else await load();
      } catch (err) {
        toast.error(getUploadErrorMessage(err, arr));
      } finally {
        setUploading(false);
        setUploadPercent(0);
        setUploadLabel('');
      }
    },
    [page, load, t],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  // ─── Inspect / mutate ───────────────────────────────────────────────────────

  const openInspector = useCallback(
    async (id: string) => {
      setInspectId(id);
      if (detailCache[id]) return;
      try {
        const detail = await getFile(id);
        setDetailCache((prev) => ({ ...prev, [id]: detail }));
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      }
    },
    [detailCache],
  );

  const handleRename = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await updateFileName(id, trimmed);
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, originalName: trimmed } : f)));
      setDetailCache((prev) =>
        prev[id] ? { ...prev, [id]: { ...prev[id], originalName: trimmed } } : prev,
      );
      toast.success(t('inspector.renamed'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }, [t]);

  const handleDelete = useCallback(
    async (id: string) => {
      const detail = detailCache[id];
      if (detail && detail.usage.totalReferences > 0) {
        toast.error(t('inspector.detachFirst'));
        return;
      }
      if (!window.confirm(t('inspector.confirmDelete'))) return;

      const removed = files.find((f) => f.id === id);
      try {
        await deleteFile(id);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        // Keep the usage bar honest without a full re-list.
        if (removed) {
          setStorage((prev) =>
            prev
              ? {
                  ...prev,
                  usedBytes: Math.max(0, prev.usedBytes - removed.size),
                  remainingBytes:
                    prev.remainingBytes !== null ? prev.remainingBytes + removed.size : null,
                }
              : prev,
          );
        }
        setDetailCache((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (inspectId === id) setInspectId(null);
        toast.success(t('inspector.deleted'));
      } catch (err) {
        // The backend answers 409 with CATALOG_FILE_STILL_REFERENCED (older
        // builds: FILE_IN_USE) — branch on the status, not the code.
        if (err instanceof ApiError && err.status === 409) {
          toast.error(t('inspector.stillInUse'));
        } else {
          toast.error(getApiErrorMessage(err));
        }
      }
    },
    [files, detailCache, inspectId, t],
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  const StatusChip = ({ fileId }: { fileId: string }) => {
    const d = detailCache[fileId];
    if (!d) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
      );
    }
    const n = d.usage.totalReferences;
    return n > 0 ? (
      <Badge className="gap-1 bg-primary text-[11px] text-primary-foreground">
        <Link2 className="h-3 w-3" />
        {n}
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-[11px]">
        {t('list.unused')}
      </Badge>
    );
  };

  // `key` remounts the inspector when the selected file changes, so its rename
  // draft resets without an effect.
  const inspector = (
    <InspectorBody
      key={inspectId}
      fileId={inspectId!}
      file={inspectFile}
      detail={inspectDetail}
      onRename={handleRename}
      onDelete={handleDelete}
      onClose={() => setInspectId(null)}
    />
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="space-y-5 animate-fade-in"
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragActive(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragActive(false);
        }}
        onDrop={onDrop}
      >
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onInputChange} />

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-1.5 text-2xl font-bold">
              {t('page.title')}
              <InfoHint className="md:hidden" label={t('page.aboutLabel')}>
                {t('page.about')}
              </InfoHint>
            </h1>
            <p className="text-muted-foreground max-md:hidden">{t('page.description')}</p>
            <p className="text-muted-foreground md:hidden">{t('page.descriptionShort')}</p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t('upload.button')}
          </Button>
        </div>

        {/* Upload progress */}
        {uploading && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">
                  {t('upload.progress', { what: uploadLabel })}
                </span>
                <span className="text-muted-foreground">
                  {t('common:units.percent', { value: uploadPercent })}
                </span>
              </div>
              <Progress value={uploadPercent} />
            </CardContent>
          </Card>
        )}

        {/* Overview */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Layers}
              label={t('stats.totalFiles')}
              value={pagination ? String(pagination.total) : t('common:values.notAvailable')}
            />
            <StatCard
              icon={HardDrive}
              label={t('stats.storageUsed')}
              value={
                storage
                  ? storage.limitBytes !== null
                    ? t('stats.storageUsedOfLimit', {
                        used: formatFileSize(storage.usedBytes),
                        limit: formatFileSize(storage.limitBytes),
                      })
                    : formatFileSize(storage.usedBytes)
                  : t('common:values.notAvailable')
              }
            />
            <StatCard
              icon={Link2}
              label={t('stats.attachedOnPage')}
              value={pageStats.resolved ? String(pageStats.attached) : t('common:values.notAvailable')}
            />
            <StatCard
              icon={Inbox}
              label={t('stats.unusedOnPage')}
              value={pageStats.resolved ? String(pageStats.unused) : t('common:values.notAvailable')}
            />
          </div>
          {storage && storage.limitBytes !== null && <StorageBar storage={storage} />}
        </div>

        {/* Toolbar */}
        <SearchFilterBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('filters.searchPlaceholder')}
          searchLabel={t('filters.searchLabel')}
          activeCount={activeFilterCount}
          onReset={() => {
            setKind('all');
            setProvider('all');
            setSort('createdAt:desc');
            setPage(1);
          }}
          filterDescription={t('filters.description')}
          resultCount={pagination?.total}
          resultNounKey="common:nouns.file"
          trailing={
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'grid' | 'list')}
              className="flex-shrink-0"
            >
              <TabsList className="h-11">
                <TabsTrigger value="grid" aria-label={t('filters.gridView')}>
                  <Grid3X3 className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" aria-label={t('filters.listView')}>
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <FilterSection label={t('filters.fileType')}>
            <FilterOptionGroup
              value={kind}
              onChange={(v) => {
                setKind(v);
                setPage(1);
              }}
              options={kindFilters}
            />
          </FilterSection>

          <FilterSection label={t('filters.storageProvider')}>
            <FilterOptionGroup
              value={provider === 'all' ? ALL_PROVIDERS : provider}
              onChange={(v) => {
                setProvider(v === ALL_PROVIDERS ? 'all' : (v as StorageProvider));
                setPage(1);
              }}
              options={providerFilters}
            />
          </FilterSection>

          <FilterSection label={t('filters.sortBy')}>
            <FilterOptionGroup
              value={sort}
              onChange={(v) => {
                setSort(v);
                setPage(1);
              }}
              options={sortOptions}
            />
          </FilterSection>
        </SearchFilterBar>

        {/* Library + persistent inspector (desktop) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {isLoading ? (
              <LibrarySkeleton viewMode={viewMode} />
            ) : error ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={load}>
                  {t('common:actions.retry')}
                </Button>
              </div>
            ) : files.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title={hasFilters ? t('list.emptyFilteredTitle') : t('list.emptyTitle')}
                description={
                  hasFilters ? t('list.emptyFilteredDescription') : t('list.emptyDescription')
                }
                action={
                  hasFilters ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchInput('');
                        setKind('all');
                        setProvider('all');
                        setPage(1);
                      }}
                    >
                      {t('filters.clear')}
                    </Button>
                  ) : (
                    <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                      <Upload className="h-4 w-4" />
                      {t('upload.uploadFiles')}
                    </Button>
                  )
                }
              />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => openInspector(file.id)}
                    className={cn(
                      'group relative overflow-hidden rounded-xl border bg-card text-left transition-all hover:shadow-md',
                      inspectId === file.id && 'ring-2 ring-primary',
                    )}
                  >
                    <div className="relative aspect-square bg-muted">
                      <FileArtwork file={file} />
                      <div className="absolute right-2 top-2">
                        <StatusChip fileId={file.id} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-black">
                          {t('list.inspect')}
                        </span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium">
                        {file.originalName ?? t('list.untitled')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('list.meta', {
                          size: formatFileSize(file.size),
                          date: formatDate(file.createdAt),
                        })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => openInspector(file.id)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50',
                          inspectId === file.id && 'bg-primary/5',
                        )}
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                          <FileArtwork file={file} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {file.originalName ?? t('list.untitled')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('list.metaWithKind', {
                              kind: t(`kinds.${kindFromMime(file.mimeType)}` as const),
                              size: formatFileSize(file.size),
                              date: formatDate(file.createdAt),
                            })}
                          </p>
                        </div>
                        <StatusChip fileId={file.id} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={t('list.fileActions')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openInspector(file.id);
                              }}
                            >
                              <Link2 className="mr-2 h-4 w-4" />
                              {t('list.inspect')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('common:actions.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {pagination && files.length > 0 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
                <span>
                  {t('common:pagination.showingRange', {
                    from: (pagination.page - 1) * pagination.limit + 1,
                    to: (pagination.page - 1) * pagination.limit + files.length,
                    total: pagination.total,
                  })}
                </span>
                {pagination.pages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>
                      {t('common:pagination.pageOf', {
                        page: pagination.page,
                        total: pagination.pages,
                      })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.pages || isLoading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persistent inspector — desktop only */}
          {!isMobile && (
            <aside className="sticky top-6 hidden h-fit lg:block">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {inspectId ? (
                    inspector
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                      <div className="rounded-full bg-muted p-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t('inspector.placeholder')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          )}
        </div>

        {/* Inspector as a slide-over below lg */}
        {isMobile && (
          <Sheet open={!!inspectId} onOpenChange={(o) => !o && setInspectId(null)}>
            <SheetContent
              side="bottom"
              className="flex h-[90vh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0"
            >
              <SheetTitle className="border-b p-4 pr-12">{t('inspector.sheetTitle')}</SheetTitle>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {inspectId && (
                  <InspectorBody
                    key={inspectId}
                    fileId={inspectId}
                    file={inspectFile}
                    detail={inspectDetail}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onClose={() => setInspectId(null)}
                    hideClose
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Drag overlay */}
        {dragActive && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="rounded-2xl border-2 border-dashed border-primary bg-background px-10 py-8 text-center shadow-lg">
              <Upload className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-lg font-semibold">{t('upload.dropTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('upload.dropHint', {
                  files: MAX_FILES_PER_UPLOAD,
                  videos: MAX_VIDEOS_PER_UPLOAD,
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Storage + stats ──────────────────────────────────────────────────────────

function StorageBar({ storage }: { storage: StorageUsage }) {
  const { t } = useTranslation('media');
  const pct = storagePercent(storage.usedBytes, storage.limitBytes);
  return (
    <Card className="max-md:rounded-lg max-md:py-0 max-md:shadow-none">
      <CardContent className="space-y-2 p-4 max-md:px-3 max-md:py-2.5 max-md:text-xs">
        <div className="flex items-center justify-between text-sm max-md:text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <HardDrive className="h-4 w-4 max-md:h-3.5 max-md:w-3.5" /> {t('storage.title')}
          </span>
          <span className="font-medium">
            {t('storage.usage', {
              used: formatFileSize(storage.usedBytes),
              limit: formatFileSize(storage.limitBytes ?? 0),
              percent: pct,
            })}
          </span>
        </div>
        <Progress value={pct} indicatorClassName={storageBarColor(pct)} />
        {pct >= 80 && (
          <p className="text-xs text-muted-foreground">
            {pct >= 100 ? t('storage.full') : t('storage.nearlyFull')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  // On a phone these four are reference figures, not the point of the page —
  // the Card's `py-6` on top of the content's `p-4` made each one ~124px tall,
  // pushing the library itself off the first screen. Below `md` the label and
  // value share one line and the tile lands at roughly a button's height.
  return (
    <Card className="max-md:rounded-lg max-md:py-0 max-md:shadow-none">
      <CardContent className="flex items-center gap-3 p-4 max-md:gap-2 max-md:px-3 max-md:py-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary max-md:p-1.5">
          <Icon className="h-5 w-5 max-md:h-3.5 max-md:w-3.5" />
        </div>
        <div className="min-w-0 max-md:flex max-md:flex-1 max-md:items-baseline max-md:justify-between max-md:gap-2">
          <p className="truncate text-xs text-muted-foreground max-md:text-[11px]">{label}</p>
          <p className="text-lg font-semibold max-md:shrink-0 max-md:text-sm">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Inspector ────────────────────────────────────────────────────────────────

function InspectorBody({
  fileId,
  file,
  detail,
  onRename,
  onDelete,
  onClose,
  hideClose,
}: {
  fileId: string;
  file?: ApiFile;
  detail: ApiFileDetail | null;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  hideClose?: boolean;
}) {
  const { t } = useTranslation(['media', 'common']);
  // Callers pass `key={fileId}`, so remounting on a new file resets the draft —
  // no effect needed to keep this in sync.
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(() => file?.originalName ?? '');

  const display = file ?? detail;
  if (!display) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const kind = kindFromMime(display.mimeType);
  const loadingUsage = !detail;
  const attached = detail ? detail.usage.totalReferences > 0 : false;
  const references = detail?.usage.references ?? [];

  return (
    <div className="flex flex-col">
      {/* Preview */}
      <div className="relative aspect-video w-full bg-muted">
        <FilePreview file={display} />
        {!hideClose && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={onClose}
            aria-label={t('inspector.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-5 p-4">
        {/* Name + rename */}
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRename(fileId, nameDraft);
                  setEditing(false);
                }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="h-8"
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                onRename(fileId, nameDraft);
                setEditing(false);
              }}
              aria-label={t('inspector.saveName')}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <h3 className="break-words text-base font-semibold leading-tight">
              {display.originalName ?? t('list.untitled')}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                setNameDraft(display.originalName ?? '');
                setEditing(true);
              }}
              aria-label={t('inspector.rename')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Metadata */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Meta label={t('inspector.meta.type')} value={t(`kinds.${kind}` as const)} />
          <Meta label={t('inspector.meta.size')} value={formatFileSize(display.size)} />
          <Meta
            label={t('inspector.meta.mime')}
            value={<span className="break-all">{display.mimeType}</span>}
          />
          <Meta
            label={t('inspector.meta.provider')}
            value={<span className="uppercase">{display.provider}</span>}
          />
          <Meta label={t('inspector.meta.uploaded')} value={formatDate(display.createdAt)} />
          <Meta
            label={t('inspector.meta.references')}
            value={detail ? String(detail.usage.totalReferences) : '…'}
          />
        </dl>

        {/* Where it's used */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">{t('inspector.whereUsed')}</h4>
          {loadingUsage ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !attached ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {t('inspector.notAttached')}
            </div>
          ) : references.length > 0 ? (
            <div className="space-y-2">
              {references.map((ref, i) => {
                const { Icon, typeLabel, detachHint } = describeReference(ref, t);
                return (
                  <UsageRow
                    key={`${ref.entityType}-${ref.entityId}-${ref.field}-${i}`}
                    file={display}
                    icon={Icon}
                    typeLabel={typeLabel}
                    name={ref.label}
                    hint={detachHint}
                  />
                );
              })}
            </div>
          ) : (
            // `references` is optional — an older backend reports only the count.
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {t('inspector.usedInPlaces', { count: detail!.usage.totalReferences })}
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="border-t pt-4">
          {attached ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button variant="outline" disabled className="w-full gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t('common:actions.delete')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{t('inspector.deleteDisabledHint')}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              onClick={() => onDelete(fileId)}
              disabled={loadingUsage}
              className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {t('inspector.deleteFile')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function UsageRow({
  file,
  icon: Icon,
  typeLabel,
  name,
  hint,
}: {
  file: ApiFile;
  icon: typeof Package;
  typeLabel: string;
  name: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
        <FileArtwork file={file} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {typeLabel}
          </span>
        </div>
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LibrarySkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <Card>
        <CardContent className="space-y-3 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border">
          <Skeleton className="aspect-square" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
