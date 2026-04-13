// "04/03/2026 5:55 PM" → { date: "April 3rd, 2026", time: "5:55 PM" }
export function parseSessionDate(raw: string) {
  const [datePart, ...rest] = raw.split(' ')
  const time = rest.join(' ')
  const [mm, dd, yyyy] = datePart.split('/').map(Number)
  const month = new Date(yyyy, mm - 1, dd).toLocaleDateString('en-US', { month: 'long' })
  const suffix = dd === 1 || dd === 21 || dd === 31 ? 'st'
    : dd === 2 || dd === 22 ? 'nd'
    : dd === 3 || dd === 23 ? 'rd'
    : 'th'
  return { date: `${month} ${dd}${suffix}, ${yyyy}`, time }
}
