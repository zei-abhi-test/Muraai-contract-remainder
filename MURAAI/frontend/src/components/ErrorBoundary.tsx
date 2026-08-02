import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="alert">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">
              An error occurred while rendering this component. Please try again.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-sm font-medium cursor-pointer mb-2">Error details</summary>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
