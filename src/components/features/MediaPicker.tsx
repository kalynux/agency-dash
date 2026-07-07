import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Search,
  Check,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Upload,
  Folder,
  Grid3X3,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useMediaStore } from '@/store';
import { cn, formatFileSize } from '@/lib/utils';
import type { MediaFile } from '@/types';

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: MediaFile[]) => void;
  multiple?: boolean;
  acceptedTypes?: ('image' | 'video' | 'document' | 'audio')[];
  maxFiles?: number;
}

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

export function MediaPicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  acceptedTypes = ['image', 'video', 'document', 'audio'],
  maxFiles,
}: MediaPickerProps) {
  const {
    files,
    folders,
    isLoading,
    uploadProgress,
    currentFolderId,
    viewMode,
    sortBy,
    sortOrder,
    searchQuery,
    fetchFiles,
    uploadFile,
    setViewMode,
    setSearchQuery,
    setCurrentFolder,
  } = useMediaStore();

  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [localFilterType, setLocalFilterType] = useState<'image' | 'video' | 'document' | 'audio' | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchFiles();
      setSelectedFiles([]);
    }
  }, [open, fetchFiles]);

  // Apply accepted types filter
  useEffect(() => {
    if (acceptedTypes.length < 4) {
      setLocalFilterType(acceptedTypes[0]);
    }
  }, [acceptedTypes]);

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

  const toggleSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId);
      }
      if (!multiple) {
        return [fileId];
      }
      if (maxFiles && prev.length >= maxFiles) {
        return prev;
      }
      return [...prev, fileId];
    });
  };

  const handleSelect = () => {
    const selected = files.filter((f) => selectedFiles.includes(f.id));
    onSelect(selected);
    onClose();
  };

  // Filter and sort files
  const filteredFiles = files
    .filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.metadata.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = localFilterType ? file.type === localFilterType : acceptedTypes.includes(file.type);
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

  const FileCard = ({ file }: { file: MediaFile }) => {
    const Icon = typeIcons[file.type];
    const isSelected = selectedFiles.includes(file.id);

    return (
      <div
        className={cn(
          'group relative overflow-hidden cursor-pointer rounded-lg border-2 transition-all',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-transparent hover:border-muted'
        )}
        onClick={() => toggleSelection(file.id)}
      >
        <div className="relative aspect-square bg-muted rounded-t-lg overflow-hidden">
          {file.type === 'image' && file.thumbnailUrl ? (
            <img
              src={file.thumbnailUrl}
              alt={file.metadata.alt || file.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className={cn('p-4 rounded-lg', typeColors[file.type])}>
                <Icon className="w-10 h-10" />
              </div>
            </div>
          )}
          
          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          )}

          {/* Type badge */}
          <div className="absolute bottom-2 left-2">
            <Badge variant="secondary" className="capitalize text-xs">
              {file.type}
            </Badge>
          </div>
        </div>
        
        <div className="p-3">
          <p className="font-medium text-sm truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>
    );
  };

  const FileRow = ({ file }: { file: MediaFile }) => {
    const Icon = typeIcons[file.type];
    const isSelected = selectedFiles.includes(file.id);

    return (
      <div
        className={cn(
          'flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-transparent hover:border-muted hover:bg-muted/50'
        )}
        onClick={() => toggleSelection(file.id)}
      >
        <div className={cn('p-2 rounded-lg', typeColors[file.type])}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
          </p>
        </div>

        {isSelected && (
          <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4" />
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Select Media</DialogTitle>
            <div className="flex items-center gap-2">
              {multiple && (
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.length} selected
                  {maxFiles && ` / ${maxFiles} max`}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="px-6 py-3 border-b bg-muted/30">
            <p className="text-sm font-medium mb-2">Uploading...</p>
            {Object.entries(uploadProgress).slice(0, 2).map(([id, progress]) => (
              <div key={id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">File {id.slice(-4)}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-3 border-b flex flex-col sm:flex-row gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            {currentFolderId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentFolder(undefined)}
              >
                <Folder className="w-4 h-4 mr-1" />
                All
              </Button>
            )}
            {currentFolder && (
              <Badge variant="secondary">
                <Folder className="w-3 h-3 mr-1" />
                {currentFolder.name}
              </Badge>
            )}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={acceptedTypes.map(t => `${t}/*`).join(',')}
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>

          {/* View Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
            <TabsList className="h-9">
              <TabsTrigger value="grid" className="px-2">
                <Grid3X3 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-2">
                <List className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Folders */}
          {!currentFolderId && folders.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-6">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolder(folder.id)}
                  className="flex items-center gap-2 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                >
                  <Folder className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Files */}
          {isLoading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
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
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No files found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearchQuery(''); setLocalFilterType(undefined); }}
                className="mt-3"
              >
                Clear filters
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredFiles.map((file) => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <FileRow key={file.id} file={file} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={selectedFiles.length === 0}
          >
            Select {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
