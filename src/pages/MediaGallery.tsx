import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Upload,
  MoreHorizontal,
  Trash2,
  X,
  Folder,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Download,
  FolderPlus,
  ChevronLeft,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useMediaStore } from '@/store';
import { cn, formatFileSize } from '@/lib/utils';
import type { MediaFile, MediaSortField } from '@/types';

const typeIcons = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: Music,
};

const typeColors = {
  image: 'bg-blue-100 text-blue-700',
  video: 'bg-purple-100 text-purple-700',
  document: 'bg-orange-100 text-orange-700',
  audio: 'bg-green-100 text-green-700',
};

export function MediaGallery() {
  const {
    files,
    folders,
    selectedFiles,
    isLoading,
    uploadProgress,
    currentFolderId,
    viewMode,
    sortBy,
    sortOrder,
    filterType,
    searchQuery,
    fetchFiles,
    uploadFile,
    deleteFile,
    deleteMultipleFiles,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    setViewMode,
    setSortBy,
    setSortOrder,
    setFilterType,
    setSearchQuery,
    setCurrentFolder,
    createFolder,
  } = useMediaStore();

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFile]);

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim(), currentFolderId);
      setNewFolderName('');
      setIsCreateFolderOpen(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (confirm(`Are you sure you want to delete ${selectedFiles.length} file(s)?`)) {
      await deleteMultipleFiles(selectedFiles);
    }
  };

  const handleSort = (field: MediaSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Filter and sort files
  const filteredFiles = files
    .filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.metadata.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = !filterType || file.type === filterType;
      const matchesFolder = !currentFolderId || file.folderId === currentFolderId;
      return matchesSearch && matchesType && matchesFolder;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'usage':
          comparison = a.usageCount - b.usageCount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const allSelected = filteredFiles.length > 0 && selectedFiles.length === filteredFiles.length;

  const FileCard = ({ file }: { file: MediaFile }) => {
    const Icon = typeIcons[file.type];
    const isSelected = selectedFiles.includes(file.id);

    return (
      <div className="animate-fade-in">
        <Card
          className={cn(
            'group relative overflow-hidden cursor-pointer transition-all',
            isSelected && 'ring-2 ring-primary'
          )}
          onClick={() => toggleFileSelection(file.id)}
        >
          <div className="relative aspect-square bg-muted">
            {file.type === 'image' && file.thumbnailUrl ? (
              <img
                src={file.thumbnailUrl}
                alt={file.metadata.alt || file.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className={cn('p-4 rounded-lg', typeColors[file.type])}>
                  <Icon className="w-12 h-12" />
                </div>
              </div>
            )}
            
            {/* Selection overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewFile(file);
                  }}
                >
                  <ImageIcon className="w-4 h-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>

            {/* Selection checkbox */}
            <div className="absolute top-2 left-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleFileSelection(file.id)}
                className="bg-white/90"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Type badge */}
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="capitalize text-xs">
                {file.type}
              </Badge>
            </div>

            {/* Usage indicator */}
            {file.usageCount > 0 && (
              <div className="absolute bottom-2 left-2">
                <Badge variant="default" className="text-xs">
                  {file.usageCount} use{file.usageCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
          
          <CardContent className="p-3">
            <p className="font-medium text-sm truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const FileRow = ({ file }: { file: MediaFile }) => {
    const Icon = typeIcons[file.type];
    const isSelected = selectedFiles.includes(file.id);

    return (
      <tr
        className={cn(
          'border-b hover:bg-muted/50 transition-colors cursor-pointer',
          isSelected && 'bg-primary/5'
        )}
        onClick={() => toggleFileSelection(file.id)}
      >
        <td className="p-4 w-12">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleFileSelection(file.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
        <td className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', typeColors[file.type])}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">{file.name}</p>
              {file.metadata.title && file.metadata.title !== file.name && (
                <p className="text-sm text-muted-foreground">{file.metadata.title}</p>
              )}
            </div>
          </div>
        </td>
        <td className="p-4">
          <Badge variant="outline" className="capitalize">
            {file.type}
          </Badge>
        </td>
        <td className="p-4 text-sm text-muted-foreground">
          {formatFileSize(file.size)}
        </td>
        <td className="p-4 text-sm text-muted-foreground">
          {new Date(file.uploadedAt).toLocaleDateString()}
        </td>
        <td className="p-4">
          <Badge variant={file.usageCount > 0 ? 'default' : 'secondary'}>
            {file.usageCount}
          </Badge>
        </td>
        <td className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Media Gallery</h1>
          <p className="text-muted-foreground">
            Manage your images, videos, and documents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            onClick={() => setIsCreateFolderOpen(true)}
            className="gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-medium">Uploading...</p>
            {Object.entries(uploadProgress).map(([id, progress]) => (
              <div key={id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">File {id.slice(-4)}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Breadcrumb & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              {currentFolderId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentFolder(undefined)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                variant={!currentFolderId ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentFolder(undefined)}
              >
                <Folder className="w-4 h-4 mr-1" />
                All Files
              </Button>
              {currentFolder && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <Button variant="secondary" size="sm">
                    <Folder className="w-4 h-4 mr-1" />
                    {currentFolder.name}
                  </Button>
                </>
              )}
            </div>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* View & Filter Controls */}
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="w-4 h-4" />
                    Filter
                    {(filterType || searchQuery) && (
                      <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {(filterType ? 1 : 0) + (searchQuery ? 1 : 0)}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filter Media</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-3">File Type</h4>
                      <div className="space-y-2">
                        {(['image', 'video', 'document', 'audio'] as const).map((type) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={filterType === type}
                              onCheckedChange={() =>
                                setFilterType(filterType === type ? undefined : type)
                              }
                            />
                            <span className="capitalize">{type}s</span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={!filterType}
                            onCheckedChange={() => setFilterType(undefined)}
                          />
                          <span>All Types</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-3">Sort By</h4>
                      <div className="space-y-2">
                        {([
                          { field: 'date', label: 'Date Uploaded' },
                          { field: 'name', label: 'Name' },
                          { field: 'size', label: 'File Size' },
                          { field: 'usage', label: 'Usage Count' },
                        ] as { field: MediaSortField; label: string }[]).map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => handleSort(field)}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                              sortBy === field
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted'
                            )}
                          >
                            <span>{label}</span>
                            {sortBy === field && (
                              sortOrder === 'asc' ? (
                                <SortAsc className="w-4 h-4" />
                              ) : (
                                <SortDesc className="w-4 h-4" />
                              )
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
                <TabsList>
                  <TabsTrigger value="grid" className="gap-2">
                    <Grid3X3 className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list" className="gap-2">
                    <List className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Folders */}
      {!currentFolderId && folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setCurrentFolder(folder.id)}
              className="flex items-center gap-3 p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <Folder className="w-8 h-8 text-primary" />
              <div className="min-w-0">
                <p className="font-medium truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground">
                  {files.filter(f => f.folderId === folder.id).length} files
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selection Actions */}
      {selectedFiles.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <button
            onClick={clearSelection}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
          <span className="text-sm text-muted-foreground">
            {selectedFiles.length} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      )}

      {/* Files Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square" />
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : filteredFiles.length === 0 ? (
            <div className="col-span-full py-12 text-center">
              <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No files found</p>
              <Button variant="outline" onClick={() => { setSearchQuery(''); setFilterType(undefined); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            filteredFiles.map((file) => <FileCard key={file.id} file={file} />)
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllFiles(filteredFiles.map((f) => f.id));
                        } else {
                          selectAllFiles([]);
                        }
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">File</th>
                  <th className="text-left p-4 text-sm font-medium">Type</th>
                  <th className="text-left p-4 text-sm font-medium">Size</th>
                  <th className="text-left p-4 text-sm font-medium">Date</th>
                  <th className="text-left p-4 text-sm font-medium">Usage</th>
                  <th className="w-12 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={7} className="p-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No files found</p>
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => <FileRow key={file.id} file={file} />)
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-4">
              {previewFile.type === 'image' ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.metadata.alt || previewFile.name}
                  className="w-full max-h-[60vh] object-contain"
                />
              ) : (
                <div className="flex items-center justify-center p-12 bg-muted rounded-lg">
                  <div className={cn('p-8 rounded-lg', typeColors[previewFile.type])}>
                    {(() => {
                      const Icon = typeIcons[previewFile.type];
                      return <Icon className="w-24 h-24" />;
                    })()}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{previewFile.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Size</p>
                  <p className="font-medium">{formatFileSize(previewFile.size)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Uploaded</p>
                  <p className="font-medium">{new Date(previewFile.uploadedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usage</p>
                  <p className="font-medium">{previewFile.usageCount} times</p>
                </div>
                {previewFile.metadata.title && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Title</p>
                    <p className="font-medium">{previewFile.metadata.title}</p>
                  </div>
                )}
                {previewFile.metadata.description && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Description</p>
                    <p className="font-medium">{previewFile.metadata.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
