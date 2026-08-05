import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FiCompass } from 'react-icons/fi'
import { Button, Card, Code, EmptyState, PageHeader, Stack } from '@open-family/ui'

/**
 * An unknown URL says so. Previously any unmatched path silently redirected to
 * the studio, which hid a mistyped or stale link instead of reporting it.
 */
export default function NotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <Stack gap="sections">
      <PageHeader title="Page not found" description="This URL does not match any page in the lab." />
      <Card>
        <EmptyState
          icon={<FiCompass size={24} />}
          title="Nothing lives here"
          description={(
            <>
              {'No page is routed at '}
              <Code>{pathname}</Code>
              {'. Every page in this product is reachable from the rail on the left, or as a tab of a page that is.'}
            </>
          )}
          actions={(
            <>
              <Button variant="primary" onClick={() => navigate('/overview')}>Go to Overview</Button>
              <Button onClick={() => navigate('/results')}>Go to Results</Button>
            </>
          )}
        />
      </Card>
    </Stack>
  )
}
