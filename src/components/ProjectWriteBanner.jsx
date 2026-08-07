import React from 'react'
import { Banner } from '@open-family/ui'

/** Shown on write surfaces when the switcher is All or multi-select. */
export default function ProjectWriteBanner({ hasConcreteProject }) {
  if (hasConcreteProject) return null
  return (
    <Banner tone="warning" title="Select one project to run or save">
      Creates and updates need exactly one project. All projects and multi-select are list-only — pick a single project in the switcher.
    </Banner>
  )
}
