import React from 'react'
import { FiExternalLink } from 'react-icons/fi'
import { Button } from '@open-family/ui'
import { loadRunTracesHref } from '../utils/entityLinks'

/**
 * Cross-product deep link: the OPA trace explorer, filtered by `load_run_id`.
 * Renders nothing when no OPA origin is configured — OPL never requires OPA.
 */
export default function OpaTracesLink({ runId, children, size = 'sm' }) {
  const href = loadRunTracesHref(runId)
  if (!href) return null
  return (
    <Button
      size={size}
      variant="ghost"
      icon={<FiExternalLink />}
      onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
    >
      {children || 'Open in OPA'}
    </Button>
  )
}
