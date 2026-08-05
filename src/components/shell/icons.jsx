import React from 'react'
import {
  FiGrid, FiLayers, FiPlay, FiBarChart2, FiTrendingUp, FiColumns, FiShield, FiUser,
} from 'react-icons/fi'

/**
 * One glyph, one destination. The collapsed rail is icon-only, so a shared glyph
 * makes two destinations indistinguishable — the audit found nine collisions in
 * a sibling dashboard's rail.
 */
const GLYPHS = {
  grid: FiGrid,
  layers: FiLayers,
  play: FiPlay,
  chart: FiBarChart2,
  trend: FiTrendingUp,
  columns: FiColumns,
  shield: FiShield,
  user: FiUser,
}

export function navIcon(name) {
  const Glyph = GLYPHS[name]
  return Glyph ? <Glyph /> : null
}

/** Every glyph name in use, so a test can assert none is shared. */
export const GLYPH_NAMES = Object.keys(GLYPHS)
