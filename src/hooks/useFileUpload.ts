import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { filesService, describeUploadViolations } from '@/services/files.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import type { UploadedFile } from '@/types/file.types';

/**
 * Standard file-upload hook. Uploads via POST /files/upload and surfaces
 * per-file UPLOAD_POLICY_VIOLATION reasons. Resolves to the uploaded files, or
 * null on failure.
 */
export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(async (files: File[]): Promise<UploadedFile[] | null> => {
    if (files.length === 0) return [];
    setIsUploading(true);
    try {
      const res = await filesService.upload(files);
      return res.data;
    } catch (err) {
      const violations =
        err instanceof ApiError && err.code === 'UPLOAD_POLICY_VIOLATION'
          ? describeUploadViolations(err.details)
          : null;
      toast.error(violations ?? getApiErrorMessage(err));
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { isUploading, upload };
}
