import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE } from './scene'

// A midnight-blue night look, made for dark mode.
const { theme, problems } = makeColors({
  label: 'Christmas night',
  only: 'dark',
  roles: { accent: '#e8b84a', danger: '#e0525e', success: '#4fae6a', warning: '#e89a3c', pro: '#9a86e0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b1430',
        'surface-1': '#101a3a',
        'surface-2': '#152043',
        'surface-3': '#18244a',
        'text-primary': '#eef2fb',
        'text-secondary': '#c6cfe4',
        'text-muted': '#9ba7c6',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'christmas-night', glass: { blur: 14, tint: '#0b1430', opacity: 0.55 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)
    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        source={SCENE}
        alt="A snowy Christmas night: a glowing log cabin and a reindeer, a lit tree with presents, and Santa's sleigh flying past the full moon while snow falls"
        isInteractive
      />
    )
  })
}
