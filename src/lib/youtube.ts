const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

function validVideoId(value: string | null | undefined) {
  return value && VIDEO_ID_PATTERN.test(value) ? value : null
}

export function parseYouTubeVideoId(input: string) {
  const trimmed = input.trim()
  if (!trimmed || trimmed.length > 2_048) return null

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return validVideoId(url.pathname.split('/').filter(Boolean)[0])
  }
  if (!YOUTUBE_HOSTS.has(host)) return null

  if (url.pathname === '/watch') return validVideoId(url.searchParams.get('v'))
  const [route, videoId] = url.pathname.split('/').filter(Boolean)
  if (route === 'shorts' || route === 'embed' || route === 'live') return validVideoId(videoId)
  return null
}

export function getYouTubeEmbedUrl(videoId: string, autoplay = false) {
  const parameters = new URLSearchParams({ rel: '0', playsinline: '0' })
  if (autoplay) parameters.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`
}

export function getYouTubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
}
