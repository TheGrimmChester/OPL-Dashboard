import React from 'react'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'
import { Button, Card, EmptyState } from '@open-family/ui'

/**
 * The last line of defence. Built from kit components rather than its own
 * stylesheet — the deleted `ErrorBoundary.css` referenced eleven custom
 * properties that no stylesheet in this repository ever defined, so the crash
 * screen was itself rendering with dropped declarations.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="opl-boundary">
          <Card>
            <EmptyState
              icon={<FiAlertTriangle size={24} />}
              title="This page stopped rendering"
              description="Something in the interface threw. Nothing was sent to the API and no run was affected — reloading restores the page."
              actions={(
                <>
                  <Button variant="primary" icon={<FiRefreshCw />} onClick={() => window.location.reload()}>
                    Reload the page
                  </Button>
                  <Button onClick={() => window.location.assign('/overview')}>Go to Overview</Button>
                </>
              )}
            />
            {import.meta.env.DEV && this.state.error && (
              <details className="opl-raw">
                <summary>Error detail</summary>
                <pre className="opl-code-well">{this.state.error.toString()}</pre>
              </details>
            )}
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
