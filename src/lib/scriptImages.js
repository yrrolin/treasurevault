const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function invokeScriptImages(body, driveToken) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured. Add its URL and publishable key to GitHub Actions variables.')
  const response = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/script-to-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    body: JSON.stringify({ ...body, driveAccessToken: driveToken }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Script-to-Images request failed (' + response.status + ')')
  return data
}

export async function findScriptImages(script, drive) {
  if (!drive?.token || !drive?.folders?.images?.id) throw new Error('Connect Google Drive first.')
  return invokeScriptImages({ action: 'search', script, imageFolderId: drive.folders.images.id }, drive.token)
}

export async function downloadScriptImagePack(selected, drive) {
  if (!selected.length) throw new Error('Select at least one image.')
  const response = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/script-to-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    body: JSON.stringify({ action: 'download', selected, driveAccessToken: drive.token }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Could not build the ZIP file (' + response.status + ')')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'TreasureVault_Script_Images.zip'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
