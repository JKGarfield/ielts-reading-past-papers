export const LEGACY_SITE_HOST = 'ielts-reading-past-papers.vercel.app'
export const NEW_SITE_URL = 'https://ielts.ttop5.cc'
// Retirement destination for this standalone reading site. The legacy URL above
// remains separate because the router also uses it as its canonical origin.
export const REPLACEMENT_SITE_URL = 'https://jkielts.pages.dev/app/home'

export function isLegacySiteHost(hostname: string | null | undefined): boolean {
  return (hostname ?? '').toLowerCase() === LEGACY_SITE_HOST
}

export function shouldShowMigrationNotice(
  locationLike: Pick<Location, 'hostname'> | undefined = typeof window !== 'undefined' ? window.location : undefined
): boolean {
  return isLegacySiteHost(locationLike?.hostname)
}
