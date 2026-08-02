import { memo, Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageHeader } from './PageHeader'
import { LoadingState } from './LoadingSpinner'

interface PageLayoutProps {
  title: string
  description?: string
  breadcrumbs?: { label: string; page?: string; params?: Record<string, any> }[]
  action?: React.ReactNode
  children: React.ReactNode
  isLoading?: boolean
  loadingMessage?: string
  error?: string | null
  onRetry?: () => void
  maxWidth?: string
  className?: string
}

export const PageLayout = memo(function PageLayout({
  title,
  description,
  breadcrumbs,
  action,
  children,
  isLoading,
  loadingMessage,
  error,
  onRetry,
  className,
}: PageLayoutProps) {
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <PageHeader
          title={title}
          description={description}
          breadcrumbs={breadcrumbs}
          action={action}
        />

        {isLoading ? (
          <LoadingState message={loadingMessage || `Loading ${title.toLowerCase()}...`} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="font-semibold text-foreground text-lg mb-1">Failed to load {title.toLowerCase()}</p>
            <p className="text-sm mb-4">{typeof error === 'string' ? error : error?.message || 'An unexpected error occurred.'}</p>
            {onRetry && (
              <button onClick={onRetry} className="text-sm text-primary hover:underline">
                Try again
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </ErrorBoundary>
  )
})
