const WEDGE_NAMES: Record<string, string> = {
  pw: 'Pitching Wedge',
  gw: 'Gap Wedge',
  aw: 'Approach Wedge',
  sw: 'Sand Wedge',
  lw: 'Lob Wedge',
}

export function formatClubType(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (s === 'd') return 'Driver'
  if (WEDGE_NAMES[s]) return WEDGE_NAMES[s]
  const wood = s.match(/^(\d+)w$/)
  if (wood) return `${wood[1]}-Wood`
  const hybrid = s.match(/^(\d+)h$/)
  if (hybrid) return `${hybrid[1]}-Hybrid`
  const iron = s.match(/^(\d+)i$/)
  if (iron) return `${iron[1]}-Iron`
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
