import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DOLL_LAYERS } from '@/lib/rig/doll-layers'

describe('слои куклы грузятся параллельно с rig.json', () => {
  it('список имён совпадает со слоями rig.json (источник правды — design/mascot/doll_build.py)', () => {
    const rig = JSON.parse(readFileSync('public/mascot/doll/rig.json', 'utf8')) as { parts: { tex: string }[] }
    expect([...DOLL_LAYERS]).toEqual(rig.parts.map((p) => p.tex))
  })
})
