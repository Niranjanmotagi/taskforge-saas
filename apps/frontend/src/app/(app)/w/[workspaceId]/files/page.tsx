'use client';

import { useCallback, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  File as FileIcon,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatBytes } from '@taskforge/shared-utils';
import { api, get, post, del, apiErrorMessage } from '@/lib/api';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface FolderRow {
  id: string;
  name: string;
  _count: { attachments: number; children: number };
}

interface FileRow {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  thumbnailUrl: string | null;
  version: number;
  createdAt: string;
  uploader: { id: string; name: string; avatarUrl: string | null };
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('pdf') || mimeType.startsWith('text/')) return FileText;
  return FileIcon;
}

export default function FilesPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const queryClient = useQueryClient();
  const [path, setPath] = useState<Array<{ id: string; name: string }>>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderId = path[path.length - 1]?.id;

  const { data, isPending } = useQuery({
    queryKey: ['files', workspaceId, folderId ?? 'root'],
    queryFn: () =>
      get<{ folders: FolderRow[]; files: FileRow[] }>(`/workspaces/${workspaceId}/files`, {
        folderId,
      }),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['files', workspaceId, folderId ?? 'root'] });

  const upload = useMutation({
    mutationFn: async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        if (folderId) form.append('folderId', folderId);
        await api.post(`/workspaces/${workspaceId}/files`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    },
    onSuccess: () => {
      toast.success('Upload complete');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const createFolder = useMutation({
    mutationFn: (name: string) => post(`/workspaces/${workspaceId}/folders`, { name, parentId: folderId }),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const deleteFile = useMutation({
    mutationFn: (attachmentId: string) => del(`/workspaces/${workspaceId}/attachments/${attachmentId}`),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) upload.mutate(e.dataTransfer.files);
    },
    [upload]
  );

  return (
    <>
      <Topbar title="Files" />
      <div
        className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-thin"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {/* Breadcrumbs + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex items-center gap-1 text-sm">
            <button onClick={() => setPath([])} className="flex items-center gap-1 rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <Home className="h-3.5 w-3.5" /> Files
            </button>
            {path.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                <button
                  onClick={() => setPath(path.slice(0, i + 1))}
                  className="rounded px-1.5 py-1 hover:bg-accent"
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const name = window.prompt('Folder name');
                if (name?.trim()) createFolder.mutate(name.trim());
              }}
            >
              <FolderPlus /> New folder
            </Button>
            <Button size="sm" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
              <Upload /> Upload
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)}
            />
          </div>
        </div>

        {/* Drop zone hint */}
        <div
          className={cn(
            'rounded-lg border-2 border-dashed p-3 text-center text-xs text-muted-foreground transition-colors',
            dragging && 'border-primary bg-primary/5 text-primary'
          )}
        >
          Drag & drop files anywhere on this page to upload
        </div>

        {isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : !data?.folders.length && !data?.files.length ? (
          <EmptyState
            icon={Folder}
            title="This folder is empty"
            description="Upload files or create folders to organize your workspace assets."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.folders.map((folder) => (
              <button
                key={folder.id}
                onDoubleClick={() => setPath([...path, { id: folder.id, name: folder.name }])}
                onClick={() => setPath([...path, { id: folder.id, name: folder.name }])}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-card transition-shadow hover:shadow-popover"
              >
                <Folder className="h-8 w-8 shrink-0 fill-primary/20 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{folder.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {folder._count.attachments} files · {folder._count.children} folders
                  </p>
                </div>
              </button>
            ))}
            {data.files.map((file) => {
              const Icon = fileIcon(file.mimeType);
              return (
                <div key={file.id} className="group relative rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-popover">
                  <a href={file.url} target="_blank" rel="noreferrer" className="block">
                    {file.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.thumbnailUrl} alt={file.name} className="mb-2 h-16 w-full rounded object-cover" />
                    ) : (
                      <Icon className="mb-2 h-8 w-8 text-muted-foreground" />
                    )}
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {formatBytes(file.sizeBytes)} · v{file.version} · {format(new Date(file.createdAt), 'MMM d')}
                    </p>
                  </a>
                  <div className="mt-2 flex items-center justify-between">
                    <UserAvatar user={file.uploader} className="h-5 w-5" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() => {
                        if (window.confirm(`Delete "${file.name}"?`)) deleteFile.mutate(file.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
