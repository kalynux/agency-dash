// ─── Media Picker ─────────────────────────────────────────────────────────────
// The single way to pick an already-uploaded file from anywhere in the dashboard.
// Lists files from the shared File Management Service with server-side search,
// filtering, sorting and pagination, lets the user upload on the spot (button or
// drag-and-drop), and hands the chosen `ApiFile[]` back to the caller.
//
// Type handling: `acceptedTypes` *seeds* the category filter (a slot that only
// takes images opens on Images) but the filter stays browsable — the user can
// look at anything they uploaded. Selecting an out-of-type file is what gets
// rejected, inline, so nothing silently disappears from the list.
//
// Responsive: a centered Dialog on desktop, a bottom Sheet on mobile. The filter
// panel is a left drawer on desktop and a bottom sheet on mobile.

import { formatDate } from '@/lib/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  List,
  Loader2,
  Music,
  Play,
  Search,
  SlidersHorizontal,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn, formatFileSize } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import { UploadSourceSheet } from '@/components/common/UploadSourceSheet';
import { nativeMediaAvailable } from '@/platform/media';
import { tx, txStatic, type AnyTFunction } from '@/i18n/tx';
import {
  kindFromMime,
  listFiles,
  resolveFileUrl,
  uploadMediaWithProgress,
  validateMediaSelection,
  MAX_FILES_PER_UPLOAD,
  MAX_VIDEOS_PER_UPLOAD,
} from '@/services/files.service';
import type {
  ApiFile,
  FileKind,
  FileListParams,
  FilePagination,
  FileSortField,
  MediaCategory,
} from '@/types/file.types';

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: ApiFile[]) => void;
  multiple?: boolean;
  /** Kinds this slot accepts. Seeds the type filter and gates selection. */
  acceptedTypes?: FileKind[];
  maxFiles?: number;
  /** Ids already attached to the target — shown as "Added" and not re-selectable. */
  alreadySelectedIds?: string[];
}

const KIND_ICONS: Record<FileKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: Music,
};

const KIND_TINTS: Record<FileKind, string> = {
  image: 'bg-blue-500/10 text-blue-600',
  video: 'bg-purple-500/10 text-purple-600',
  document: 'bg-orange-500/10 text-orange-600',
  audio: 'bg-emerald-500/10 text-emerald-600',
};

const ALL_KINDS: FileKind[] = ['image', 'video', 'document', 'audio'];

const PICKER_LIMIT = 24;
const SEARCH_DEBOUNCE_MS = 300;

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

interface FilterState {
  category: MediaCategory | 'all';
  minMB: string;
  maxMB: string;
  createdAfter: string;
  createdBefore: string;
  sort: SortValue;
}

const DEFAULT_FILTERS: FilterState = {
  category: 'all',
  minMB: '',
  maxMB: '',
  createdAfter: '',
  createdBefore: '',
  sort: 'createdAt:desc',
};

function mbToBytes(mb: string): number | undefined {
  const n = parseFloat(mb);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1024 * 1024) : undefined;
}

/** Human label for the kinds a slot accepts, e.g. "image" or "image / video". */
function describeAccepted(types: FileKind[], t: AnyTFunction): string {
  return types.map((k) => tx(t, `media:kindsSingular.${k}`)).join(' / ');
}

// Module-level so its identity is stable across renders — defining it inside the
// component would remount every <img> on each selection (visible as a flicker).
function FileThumb({ file }: { file: ApiFile }) {
  const kind = kindFromMime(file.mimeType);
  const Icon = KIND_ICONS[kind];
  const url = resolveFileUrl(file);

  if (kind === 'image') {
    return (
      <img
        src={url}
        alt={file.originalName ?? txStatic('media:preview.fileAlt')}
        crossOrigin="anonymous"
        loading="lazy"
        className="h-full w-full object-cover"
        draggable={false}
      />
    );
  }
  if (kind === 'video') {
    return (
      <div className="relative h-full w-full bg-black">
        <video
          src={url}
          muted
          preload="metadata"
          crossOrigin="anonymous"
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-1.5 text-white backdrop-blur-sm">
            <Play className="h-4 w-4" />
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={cn('rounded-lg p-3', KIND_TINTS[kind])}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
}

/** Always-visible checkbox so it's obvious what is selectable and what is picked. */
function SelectionBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-white/90 bg-black/30 text-transparent backdrop-blur-sm',
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  acceptedTypes = ALL_KINDS,
  maxFiles,
  alreadySelectedIds = [],
}: MediaPickerProps) {
  const { t } = useTranslation(['media', 'common']);
  const isMobile = useIsMobile();

  const alreadySelected = useMemo(() => new Set(alreadySelectedIds), [alreadySelectedIds]);

  const [files, setFiles] = useState<ApiFile[]>([]);
  const [pagination, setPagination] = useState<FilePagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Selection survives paging by keying chosen files by id.
  const [selected, setSelected] = useState<Record<string, ApiFile>>({});
  // Inline error when the user tries to pick a file outside the accepted kinds.
  const [selectError, setSelectError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Query assembly ─────────────────────────────────────────────────────────

  const [sortBy, sortOrder] = filters.sort.split(':') as [FileSortField, 'asc' | 'desc'];
  const effectiveCategory: MediaCategory | undefined =
    filters.category === 'all' ? undefined : filters.category;

  const query: FileListParams = useMemo(
    () => ({
      page,
      limit: PICKER_LIMIT,
      search: search || undefined,
      category: effectiveCategory,
      minSize: mbToBytes(filters.minMB),
      maxSize: mbToBytes(filters.maxMB),
      createdAfter: filters.createdAfter || undefined,
      createdBefore: filters.createdBefore || undefined,
      sortBy,
      sortOrder,
    }),
    [page, search, effectiveCategory, filters, sortBy, sortOrder],
  );

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listFiles(query);
      setFiles(res.files);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // Reset on open. The type filter is *seeded* from the accepted kinds (a single
  // accepted kind pre-selects it) but stays changeable, so the user can browse
  // other types — picking an out-of-type file is what gets rejected.
  useEffect(() => {
    if (!open) return;
    setSelected({});
    setSelectError(null);
    setSearchInput('');
    setSearch('');
    setFilters({
      ...DEFAULT_FILTERS,
      category: acceptedTypes.length === 1 ? acceptedTypes[0] : 'all',
    });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounce the search box into the applied `search`. Every query change resets
  // to page 1 alongside the change itself, so one filter switch is one refetch.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  /** Filter edits always land back on page 1. */
  const applyFilters = useCallback((next: FilterState) => {
    setFilters(next);
    setPage(1);
  }, []);

  useEffect(() => {
    if (open) fetchFiles();
  }, [open, fetchFiles]);

  // ─── Upload (button + drag-and-drop) ────────────────────────────────────────

  const handleUpload = useCallback(
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
      try {
        const uploaded = await uploadMediaWithProgress(arr, setUploadPercent);
        toast.success(t('upload.succeeded', { count: arr.length }));
        // Uploading from inside the picker means "I want *this* file here", so
        // pre-select what just landed — the user only has to confirm.
        const eligible = uploaded.filter((f) => acceptedTypes.includes(kindFromMime(f.mimeType)));
        if (eligible.length > 0) {
          setSelectError(null);
          setSelected((prev) => {
            if (!multiple) return { [eligible[0].id]: eligible[0] };
            const next = { ...prev };
            for (const f of eligible) {
              if (maxFiles && Object.keys(next).length >= maxFiles) break;
              next[f.id] = f;
            }
            return next;
          });
        }
        if (page !== 1) setPage(1);
        else await fetchFiles();
      } catch (err) {
        toast.error(getUploadErrorMessage(err, arr));
      } finally {
        setUploading(false);
        setUploadPercent(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [page, fetchFiles, acceptedTypes, multiple, maxFiles, t],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
  };

  // On a device the Upload button opens the source sheet (camera / library /
  // files) instead of going straight to the system file chooser; on the web it
  // is the same click on the same hidden input it always was (P4.3).
  const requestUpload = () => {
    if (nativeMediaAvailable) setSourceOpen(true);
    else fileInputRef.current?.click();
  };

  // ─── Selection ──────────────────────────────────────────────────────────────

  const selectedCount = Object.keys(selected).length;

  const toggleSelection = (file: ApiFile) => {
    if (alreadySelected.has(file.id)) return; // already attached to the target
    const kind = kindFromMime(file.mimeType);
    if (!selected[file.id] && !acceptedTypes.includes(kind)) {
      setSelectError(
        t('picker.wrongKind', {
          kind: t(`kinds.${kind}` as const),
          accepted: describeAccepted(acceptedTypes, t),
        }),
      );
      return;
    }
    setSelectError(null);
    setSelected((prev) => {
      if (prev[file.id]) {
        const next = { ...prev };
        delete next[file.id];
        return next;
      }
      if (!multiple) return { [file.id]: file };
      if (maxFiles && Object.keys(prev).length >= maxFiles) return prev;
      return { ...prev, [file.id]: file };
    });
  };

  const handleConfirm = () => {
    onSelect(Object.values(selected));
    onClose();
  };

  const hasActiveFilters =
    !!search ||
    filters.category !== 'all' ||
    !!filters.minMB ||
    !!filters.maxMB ||
    !!filters.createdAfter ||
    !!filters.createdBefore;

  // ─── Pieces ─────────────────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('picker.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-10"
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      <UploadSourceSheet
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        onPicked={handleUpload}
        onBrowseFiles={() => fileInputRef.current?.click()}
        multiple
        // The same ceiling `validateMediaSelection` enforces, applied at the
        // point of selection so the user is stopped by the picker rather than
        // by an error after choosing twelve photos.
        limit={MAX_FILES_PER_UPLOAD}
        allowVideo
      />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          {t('picker.filters')}
          {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={requestUpload}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('upload.button')}
        </Button>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
          <TabsList className="h-9">
            <TabsTrigger value="grid" className="px-2">
              <Grid3X3 className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list" className="px-2">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  const grid = (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
      {files.map((file) => {
        const added = alreadySelected.has(file.id);
        const isSelected = added || !!selected[file.id];
        return (
          <div
            key={file.id}
            onClick={() => toggleSelection(file)}
            className={cn(
              'group relative overflow-hidden rounded-lg border-2 transition-all',
              added
                ? 'cursor-default border-primary/40 opacity-70'
                : isSelected
                  ? 'cursor-pointer border-primary bg-primary/5'
                  : 'cursor-pointer border-transparent hover:border-muted',
            )}
          >
            <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
              <FileThumb file={file} />
              <div className="absolute right-2 top-2">
                <SelectionBox checked={isSelected} />
              </div>
              <div className="absolute bottom-2 left-2">
                {added ? (
                  <Badge className="bg-primary text-xs text-primary-foreground">
                    {t('picker.added')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {t(`kinds.${kindFromMime(file.mimeType)}` as const)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium">
                {file.originalName ?? t('list.untitled')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const listView = (
    <div className="space-y-2">
      {files.map((file) => {
        const added = alreadySelected.has(file.id);
        const isSelected = added || !!selected[file.id];
        return (
          <div
            key={file.id}
            onClick={() => toggleSelection(file)}
            className={cn(
              'flex items-center gap-4 rounded-lg border p-3 transition-all',
              added
                ? 'cursor-default border-primary/40 opacity-70'
                : isSelected
                  ? 'cursor-pointer border-primary bg-primary/5'
                  : 'cursor-pointer border-transparent hover:border-muted hover:bg-muted/50',
            )}
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">
              <FileThumb file={file} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.originalName ?? t('list.untitled')}</p>
              <p className="text-xs text-muted-foreground">
                {t('list.meta', {
                  size: formatFileSize(file.size),
                  date: formatDate(file.createdAt),
                })}
              </p>
            </div>
            {added && (
              <Badge className="bg-primary text-xs text-primary-foreground">
                {t('picker.added')}
              </Badge>
            )}
            <SelectionBox checked={isSelected} />
          </div>
        );
      })}
    </div>
  );

  const content = (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={onDrop}
    >
      {uploading && (
        <div className="border-b bg-muted/30 px-4 py-3 sm:px-6">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">{t('upload.uploading')}</span>
            <span>{t('common:units.percent', { value: uploadPercent })}</span>
          </div>
          <Progress value={uploadPercent} className="h-1.5" />
        </div>
      )}

      {toolbar}

      {/* Out-of-type selection error — inline, contextual, clears on a valid pick */}
      {selectError && (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive sm:px-6">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{selectError}</span>
          <button
            type="button"
            onClick={() => setSelectError(null)}
            className="shrink-0 rounded-sm p-0.5 hover:bg-destructive/15"
            aria-label={t('picker.dismiss')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          )
        ) : files.length === 0 ? (
          <div className="py-12 text-center">
            <ImageIcon className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('picker.noFiles')}</p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  applyFilters(DEFAULT_FILTERS);
                }}
                className="mt-3"
              >
                {t('picker.clearFilters')}
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          grid
        ) : (
          listView
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('picker.pageOf', {
                page: pagination.page,
                pages: pagination.pages,
                total: pagination.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages || isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Drag overlay */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
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
  );

  const footer = (
    <div className="flex flex-shrink-0 items-center justify-between border-t px-4 py-4 sm:px-6">
      <Button variant="outline" onClick={onClose}>
        {t('common:actions.cancel')}
      </Button>
      <Button onClick={handleConfirm} disabled={selectedCount === 0}>
        {selectedCount > 0
          ? t('picker.confirmWithCount', { count: selectedCount })
          : t('picker.confirm')}
      </Button>
    </div>
  );

  const titleNode = (
    <div className="flex items-center justify-between pr-6">
      <span>{t('picker.title')}</span>
      {multiple && (
        <span className="text-sm font-normal text-muted-foreground">
          {maxFiles
            ? t('picker.selectedOfMax', { count: selectedCount, max: maxFiles })
            : t('picker.selectedOf', { count: selectedCount })}
        </span>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
          <SheetContent
            side="bottom"
            className="flex h-[92vh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b px-4 pb-3 pt-4 text-left">
              <SheetTitle>{titleNode}</SheetTitle>
            </SheetHeader>
            {content}
            {footer}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
          >
            <DialogHeader className="border-b px-6 pb-4 pt-6">
              <DialogTitle>{titleNode}</DialogTitle>
            </DialogHeader>
            {content}
            {footer}
          </DialogContent>
        </Dialog>
      )}

      {/* Filter drawer: left on desktop, bottom sheet on mobile */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'left'}
          className={cn(
            'flex flex-col gap-0 p-0',
            isMobile ? 'h-[80vh] rounded-t-2xl' : 'w-[340px] sm:max-w-[340px]',
          )}
        >
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>{t('picker.filters')}</SheetTitle>
          </SheetHeader>
          <MediaPickerFilters
            filters={filters}
            onChange={applyFilters}
            onReset={() => applyFilters(DEFAULT_FILTERS)}
            onClose={() => setFiltersOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

function MediaPickerFilters({
  filters,
  onChange,
  onReset,
  onClose,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['media', 'common']);
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('filters.fileType')}</Label>
          <Select
            value={filters.category}
            onValueChange={(v) => set('category', v as MediaCategory | 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
              {ALL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`kinds.${k}` as const)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('picker.filterPanel.size')}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder={t('picker.filterPanel.min')}
              value={filters.minMB}
              onChange={(e) => set('minMB', e.target.value)}
              className="h-9"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              placeholder={t('picker.filterPanel.max')}
              value={filters.maxMB}
              onChange={(e) => set('maxMB', e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('picker.filterPanel.uploaded')}</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[11px] text-muted-foreground">
                {t('picker.filterPanel.after')}
              </span>
              <Input
                type="date"
                value={filters.createdAfter}
                onChange={(e) => set('createdAfter', e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">
                {t('picker.filterPanel.before')}
              </span>
              <Input
                type="date"
                value={filters.createdBefore}
                onChange={(e) => set('createdBefore', e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('filters.sortBy')}</Label>
          <Select value={filters.sort} onValueChange={(v) => set('sort', v as SortValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {tx(t, o.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SheetFooter className="flex-row gap-2 border-t px-5 py-4">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={onReset}>
          <X className="h-4 w-4" />
          {t('common:actions.reset')}
        </Button>
        <Button className="flex-1" onClick={onClose}>
          {t('common:actions.done')}
        </Button>
      </SheetFooter>
    </>
  );
}
