import { useState, useRef } from 'react'
import { useOneDriveFiles, useUploadToOneDrive, useDeleteOneDriveFile } from '@/hooks/useMicrosoft'

interface Props {
  configured: boolean
}

export function OneDrivePanel({ configured }: Props) {
  const [folder, setFolder] = useState('/')
  const { data, isLoading } = useOneDriveFiles(configured ? folder : undefined)
  const uploadMutation = useUploadToOneDrive()
  const deleteMutation = useDeleteOneDriveFile()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    uploadMutation.mutate({ file, destination: `${folder}/${file.name}` })
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!configured) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">AZURE_TENANT_ID</code>,{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">AZURE_CLIENT_ID</code>,{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">AZURE_CLIENT_SECRET</code>{' '}
        environment variables to enable OneDrive file browsing and upload.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="/"
          className="flex-1 px-3 py-1.5 text-xs border border-input rounded-lg bg-background"
        />
        <button
          onClick={() => setFolder('/')}
          className="text-xs px-2 py-1.5 border border-input rounded-lg hover:bg-accent"
        >
          Root
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" className="flex-1 text-xs" />
        <button
          onClick={handleUpload}
          disabled={uploadMutation.isPending}
          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading files...</p>}

      {data && data.files.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground py-4 text-center">No files found in this folder.</p>
      )}

      {data && data.files.length > 0 && (
        <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
          {data.files.map((file: any) => (
            <div key={file.id} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs truncate">{file.name}</span>
                {file.size && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(file.id)}
                className="text-xs text-destructive hover:text-destructive/80 shrink-0 ml-2"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
