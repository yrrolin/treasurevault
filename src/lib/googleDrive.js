const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

export const DRIVE_FOLDERS = [
  { key: 'projects', name: 'Project Files' },
  { key: 'transitions', name: 'Transitions' },
  { key: 'footage', name: 'Footages' },
  { key: 'broll', name: 'B-roll' },
  { key: 'sfx', name: 'Sound Effects' },
  { key: 'music', name: 'Background Music' },
  { key: 'images', name: 'Images & Graphics' },
  { key: 'archives', name: 'Archives' },
]

const extensionMap = {
  prproj: 'projects', aep: 'projects', drp: 'projects', drt: 'projects', capcut: 'projects', psd: 'projects', ai: 'projects',
  mogrt: 'transitions', prfpset: 'transitions', preset: 'transitions',
  mp4: 'footage', mov: 'footage', mxf: 'footage', avi: 'footage', mkv: 'footage', webm: 'footage', mts: 'footage',
  wav: 'sfx', aiff: 'sfx', mp3: 'music', flac: 'music', m4a: 'music', aac: 'music', ogg: 'music',
  jpg: 'images', jpeg: 'images', png: 'images', webp: 'images', gif: 'images', svg: 'images', tif: 'images', tiff: 'images',
  zip: 'archives', rar: 'archives', '7z': 'archives', tar: 'archives',
}

export function classifyFile(file) {
  const name = file.name.toLowerCase()
  const ext = name.split('.').pop() || ''
  if (/(^|[ _.-])b[-_ ]?roll([ _.-]|$)/.test(name)) return 'broll'
  if (/(^|[ _.-])transition([ _.-]|$)/.test(name)) return 'transitions'
  if (/(^|[ _.-])sfx([ _.-]|$)/.test(name)) return 'sfx'
  if (/(^|[ _.-])music([ _.-]|$)/.test(name)) return 'music'
  return extensionMap[ext] || (file.type.startsWith('audio/') ? 'music' : file.type.startsWith('image/') ? 'images' : 'footage')
}

function loadGoogleIdentity() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const existing = document.querySelector('script[data-google-identity]')
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection or browser settings.'))
    document.head.appendChild(script)
  })
}

async function driveRequest(token, path, options = {}) {
  const response = await fetch('https://www.googleapis.com/drive/v3/' + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error?.message || 'Google Drive request failed (' + response.status + ')')
  return body
}

async function findFolder(token, name, parentId = null) {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const parentClause = parentId ? " and '" + parentId + "' in parents" : " and 'root' in parents"
  const q = encodeURIComponent("name = '" + escaped + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" + parentClause)
  const result = await driveRequest(token, 'files?q=' + q + '&pageSize=100&fields=files(id,name,mimeType,webViewLink)')
  return result.files?.[0] || null
}

async function createFolder(token, name, parentId) {
  return driveRequest(token, 'files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
}

export async function connectGoogleDrive() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Google OAuth is not configured yet. Add VITE_GOOGLE_CLIENT_ID to your GitHub Actions variables first.')
  await loadGoogleIdentity()
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: response => response.error ? reject(new Error(response.error_description || response.error)) : resolve(response.access_token),
      error_callback: error => reject(new Error(error.message || 'Google authorization was cancelled.')),
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
  // Use the user's explicitly selected Editing Assets folder; never create a second root.
  const rootId = '18Ou82zi0rb2t93PlbUODRGfc9eeDU0KF'
  let root
  try {
    root = await driveRequest(token, 'files/' + rootId + '?fields=id,name,mimeType,trashed,webViewLink')
  } catch {
    throw new Error('TreasureVault could not access your selected Editing Assets folder. Make sure the Google account you connected has access to it.')
  }
  if (root.trashed || root.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('The selected Google Drive item is not an available folder. Check the folder link and try again.')
  }
  const folders = {}
  for (const folder of DRIVE_FOLDERS) {
    let found = await findFolder(token, folder.name, root.id)
    if (!found) found = await createFolder(token, folder.name, root.id)
    folders[folder.key] = found
  }
  return { token, root, folders }
}


export async function listDriveAssets(token, folders) {
  const assets = []
  for (const folder of DRIVE_FOLDERS) {
    const driveFolder = folders[folder.key]
    if (!driveFolder?.id) continue
    let pageToken = ''
    do {
      const params = new URLSearchParams({
        q: "'" + driveFolder.id + "' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'",
        pageSize: '1000',
        orderBy: 'modifiedTime desc',
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,imageMediaMetadata,videoMediaMetadata)',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const result = await driveRequest(token, 'files?' + params.toString())
      for (const file of (result.files || [])) {
        const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'FILE'
        const mime = file.mimeType || ''
        const kind = mime.startsWith('audio/') ? 'AUDIO' : mime.startsWith('video/') ? 'VIDEO' : mime.startsWith('image/') ? 'IMAGE' : folder.key === 'projects' ? 'PROJECT' : 'FILE'
        const bytes = Number(file.size || 0)
        const size = bytes >= 1073741824 ? (bytes / 1073741824).toFixed(1) + ' GB' : bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes ? bytes + ' B' : '—'
        const video = file.videoMediaMetadata || {}
        const image = file.imageMediaMetadata || {}
        const durationSeconds = video.durationMillis ? Math.round(Number(video.durationMillis) / 1000) : null
        const duration = durationSeconds == null ? '—' : new Date(durationSeconds * 1000).toISOString().slice(14, 19)
        const resolution = video.width && video.height ? video.width + '×' + video.height : image.width && image.height ? image.width + '×' + image.height : mime.split('/')[1]?.toUpperCase() || 'FILE'
        assets.push({
          id: file.id, name: file.name, type: folder.key, kind, ext, size, bytes,
          duration, resolution, tag: folder.name, color: 'blue',
          date: file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '—',
          webViewLink: file.webViewLink || 'https://drive.google.com/file/d/' + file.id + '/view',
          thumbnailLink: file.thumbnailLink || null, mimeType: mime,
          modifiedTime: file.modifiedTime || null,
        })
      }
      pageToken = result.nextPageToken || ''
    } while (pageToken)
  }
  return assets.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))
}

export async function uploadDriveFile(token, folderId, file) {
  const metadata = { name: file.name, mimeType: file.type || 'application/octet-stream', parents: [folderId] }
  const boundary = 'treasurevault_upload_boundary'
  const body = new Blob([
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n',
    '--' + boundary + '\r\nContent-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n',
    file,
    '\r\n--' + boundary + '--',
  ])
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error?.message || 'Upload failed (' + response.status + ')')
  return result
}
