import { useEffect, useMemo, useState } from 'react'
import { connectGoogleDrive, uploadDriveFile, classifyFile, listDriveAssets, moveDriveFile, downloadDriveFile, DRIVE_FOLDERS } from './lib/googleDrive'
import { supabase } from './lib/supabase'
import { findScriptImages, downloadScriptImagePack } from './lib/scriptImages'
import {
  Aperture, ArrowDownUp, AudioLines, Bookmark, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clapperboard, Cloud, Command,
  Disc3, Download, ExternalLink, FileArchive, FileImage, FileVideo, Filter, Folder, FolderInput, FolderOpen,
  Grid2X2, HardDrive, Headphones, Image, LayoutGrid, List, Music2,
  Plus, Search, Settings2, SlidersHorizontal, Sparkles, Star, Upload,
  Video, Waves, X
} from 'lucide-react'

const categories = [
  { id: 'all', label: 'All assets', icon: LayoutGrid },
  { id: 'projects', label: 'Project files', icon: FolderOpen },
  { id: 'transitions', label: 'Transitions', icon: Waves },
  { id: 'footage', label: 'Footages', icon: Video },
  { id: 'broll', label: 'B-roll', icon: Clapperboard },
  { id: 'sfx', label: 'Sound effects', icon: AudioLines },
  { id: 'music', label: 'Background music', icon: Music2 },
  { id: 'images', label: 'Images & graphics', icon: FileImage },
  { id: 'archives', label: 'Archives', icon: FileArchive },
]

const samples = []

const navGroups = [
  { title: 'LIBRARY', items: categories },
]

function Thumb({ item }) {
  const Icon = item.kind === 'AUDIO' ? AudioLines : item.kind === 'PROJECT' ? FileArchive : item.kind === 'IMAGE' ? FileImage : item.type === 'transitions' ? Aperture : item.kind === 'FILE' ? FileArchive : FileVideo
  return <div className={`thumb thumb-${item.color}`}>
    <div className="thumb-orb" />
    <div className="thumb-grid" />
    <Icon size={25} strokeWidth={1.45} />
    <span className="thumb-ext">{item.ext}</span>
    {item.kind === 'VIDEO' && <span className="play-mark">▶</span>}
  </div>
}

function AssetPreview({ item }) {
  const [failed, setFailed] = useState(false)
  const previewUrl = item.thumbnailLink || (item.kind === 'IMAGE' || item.kind === 'VIDEO'
    ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(item.id) + '&sz=w800'
    : '')
  if (!previewUrl || failed) return <Thumb item={item} />
  return <div className="drive-preview">
    <img
      src={previewUrl}
      alt={item.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
    {item.kind === 'VIDEO' && <span className="video-preview-play"><Video size={19} fill="currentColor" /></span>}
  </div>
}


function ScriptImageStudio({ drive, onClose, notify }) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your TreasureVault creative assistant. Paste a video script and I'll break it into visual scenes, search your Drive library first, then find high-resolution images online for anything missing." }
  ])
  const [selected, setSelected] = useState([])
  const lastProvider = [...messages].reverse().find(message => message.aiProvider)?.aiProvider
  const selectedItems = messages.flatMap(message => (message.results?.scenes || []).flatMap(scene =>
    (scene.images || []).filter(image => selected.includes(image.selectionId))
      .map(image => ({ ...image, driveFileId: image.sourceType === 'drive' ? image.id : undefined, sceneTitle: scene.title }))
  ))
  const runSearch = async () => {
    const script = prompt.trim()
    if (!script || busy) return
    if (!drive) { notify('Connect Google Drive first.'); return }
    if (script.length > 12000) { notify('Please keep each script under 12,000 characters.'); return }
    setMessages(old => [...old, { role: 'user', text: script }])
    setPrompt('')
    setBusy(true)
    try {
      const data = await findScriptImages(script, drive)
      const all = (data.scenes || []).flatMap(scene => scene.images || [])
      setSelected(all.slice(0, 20).map(image => image.selectionId))
      setMessages(old => [...old, {
        role: 'assistant',
        text: data.aiProvider === 'Groq GPT-OSS 20B'
          ? "Gemini was unavailable, so I automatically switched to the Groq backup model. I've analysed your script and found visual options for each scene. Select the images you want in your pack."
          : all.length
            ? "I've analysed your script and found visual options for each scene. Select the images you want in your pack."
            : "I broke your script into scenes, but couldn't find qualifying high-resolution images. Try adding more visual detail.",
        results: data,
        aiProvider: data.aiProvider || 'AI assistant',
      }])
    } catch (error) {
      setMessages(old => [...old, { role: 'assistant', text: error.message || 'I could not complete the image search. Please try again.' }])
    } finally { setBusy(false) }
  }
  const toggle = id => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : old.length >= 20 ? old : [...old, id])
  const download = async () => {
    if (!selectedItems.length || downloading) return
    setDownloading(true)
    try { await downloadScriptImagePack(selectedItems, drive); notify('Your image ZIP is ready.') }
    catch (error) { notify(error.message || 'ZIP download failed.') }
    finally { setDownloading(false) }
  }
  return <div className="modal-backdrop script-modal-backdrop" onClick={onClose}>
    <div className="script-studio script-chat-workspace" onClick={event => event.stopPropagation()}>
      <header className="script-chat-header">
        <div className="script-chat-brand">
          <div className="script-chat-mark"><Sparkles size={17}/></div>
          <div><span className="eyebrow">TREASUREVAULT AI</span><h2>Creative Assistant</h2><p>Script breakdown · Image discovery · Asset packs</p></div>
        </div>
        <div className="script-chat-header-actions">
          <span className="script-provider-pill"><i/>{lastProvider || 'Gemini + Groq backup'}</span>
          {selectedItems.length > 0 && <button className="primary-button script-download-top" onClick={download} disabled={downloading}><Download size={14}/>{downloading ? 'Preparing ZIP…' : 'Download ' + selectedItems.length}</button>}
          <button className="modal-close" onClick={onClose} aria-label="Close assistant"><X size={18}/></button>
        </div>
      </header>
      <div className="script-chat-context"><HardDrive size={14}/><span>{drive ? 'Drive connected · Your library is searched before Google Images' : 'Connect Google Drive to search your personal library'}</span><span className="script-quality-pill">1920×1080 minimum</span></div>
      <main className="script-chat-messages">
        {messages.map((message, index) => <article className={'script-chat-message ' + message.role} key={index}>
          <div className="script-chat-avatar">{message.role === 'assistant' ? <Sparkles size={15}/> : 'Y'}</div>
          <div className="script-chat-body">
            <div className="script-chat-author">{message.role === 'assistant' ? 'TreasureVault' : 'You'}{message.aiProvider && <span>{message.aiProvider}</span>}</div>
            <p className="script-chat-text">{message.text}</p>
            {message.results && <div className="script-chat-results">
              <div className="script-results-summary"><strong>{message.results.scenes?.length || 0} scenes identified</strong><span>{message.results.libraryImageCount || 0} high-resolution Drive images scanned</span></div>
              {(message.results.scenes || []).map((scene, sceneIndex) => <section className="script-scene" key={scene.id || sceneIndex}>
                <div className="script-scene-heading"><span>SCENE {String(sceneIndex + 1).padStart(2, '0')}</span><h4>{scene.title}</h4><p>{scene.visualBrief}</p></div>
                <div className="script-image-grid">{(scene.images || []).map(image => <label className={'script-image-card ' + (selected.includes(image.selectionId) ? 'selected' : '')} key={image.selectionId}>
                  <div className="script-image-thumb"><img src={image.thumbnailUrl} alt={image.title} loading="lazy"/><input type="checkbox" checked={selected.includes(image.selectionId)} disabled={!selected.includes(image.selectionId) && selected.length >= 20} onChange={() => toggle(image.selectionId)}/></div>
                  <div className="script-image-info"><strong title={image.title}>{image.title}</strong><span>{image.width && image.height ? image.width + ' × ' + image.height : 'Resolution unavailable'} · {image.sourceType === 'drive' ? 'Your Drive' : image.sourceName || 'Google Images'}</span>{image.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>View source ↗</a>}</div>
                </label>)}</div>
                {!scene.images?.length && <p className="script-no-images">No qualifying images found for this scene.</p>}
              </section>)}
              <p className="script-disclaimer">Google Images results are not pre-cleared for reuse. Check original source permissions before publishing.</p>
            </div>}
          </div>
        </article>)}
        {busy && <div className="script-thinking"><span/><span/><span/> Analysing script and searching for images…</div>}
      </main>
      <footer className="script-chat-composer-wrap">
        {!drive && <p className="script-warning">Connect Google Drive from the main library before using the assistant.</p>}
        <div className="script-chat-composer">
          <textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); runSearch() } }} placeholder="Paste your video script here… (Enter to send, Shift + Enter for a new line)" rows={3} disabled={busy}/>
          <div className="script-composer-bottom"><span>Up to 12,000 characters · Images only · High resolution</span><button className="primary-button" onClick={runSearch} disabled={busy || !prompt.trim() || !drive}>{busy ? 'Working…' : 'Find images'} <Sparkles size={15}/></button></div>
        </div>
        <p className="script-chat-footnote">AI suggestions can be imperfect. Always review image sources and usage rights.</p>
      </footer>
    </div>
  </div>
}
function App() {
  const [active, setActive] = useState('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [sort, setSort] = useState('Recently added')
  const [favorites, setFavorites] = useState([])
  const [assets, setAssets] = useState([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [selected, setSelected] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [toast, setToast] = useState('')
  const [drive, setDrive] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState([])
  const [uploadCategory, setUploadCategory] = useState('auto')
  const [dragging, setDragging] = useState(false)
  const [activeAsset, setActiveAsset] = useState(null)
  const [movingAsset, setMovingAsset] = useState(false)
  const [downloadingAsset, setDownloadingAsset] = useState(false)
  const [showScriptStudio, setShowScriptStudio] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = assets.filter(item => (active === 'all' || item.type === active) &&
      (!q || [item.name, item.tag, item.ext, item.type, item.resolution].join(' ').toLowerCase().includes(q)))
    if (sort === 'Name A–Z') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [assets, active, query, sort])

  const currentCategory = categories.find(c => c.id === active)?.label || 'All assets'
  const moveSelectedAsset = async destinationKey => {
    if (!activeAsset || !drive || movingAsset) return
    const destination = drive.folders[destinationKey]
    if (!destination) { notify('Destination folder is not available. Reconnect Drive.'); return }
    if (destination.id === activeAsset.folderId) { notify('This file is already in that folder.'); return }
    setMovingAsset(true)
    try {
      await moveDriveFile(drive.token, activeAsset.id, activeAsset.folderId, destination.id)
      const refreshed = await listDriveAssets(drive.token, drive.folders)
      setAssets(refreshed)
      setActiveAsset(refreshed.find(item => item.id === activeAsset.id) || null)
      notify('Moved to ' + destination.name + '.')
    } catch (error) { notify(error.message || 'Could not move file.') }
    finally { setMovingAsset(false) }
  }
  const downloadSelectedAsset = async () => {
    if (!activeAsset || !drive || downloadingAsset) return
    setDownloadingAsset(true)
    try { await downloadDriveFile(drive.token, activeAsset.id, activeAsset.name); notify('Download started.') }
    catch (error) { notify(error.message || 'Download failed.') }
    finally { setDownloadingAsset(false) }
  }
  const toggleFavorite = id => setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id])
  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 4200) }
  const connectDrive = async () => {
    setConnecting(true)
    try {
      const connected = await connectGoogleDrive()
      setDrive(connected)
      setLoadingAssets(true)
      const driveAssets = await listDriveAssets(connected.token, connected.folders)
      setAssets(driveAssets)
      notify('Google Drive connected. Loaded ' + driveAssets.length + ' real file(s).')
    } catch (error) {
      notify(error.message || 'Could not connect Google Drive.')
    } finally { setConnecting(false); setLoadingAssets(false) }
  }
  const handleUpload = async () => {
    if (!drive) { notify('Connect Google Drive before uploading.'); return }
    if (!uploadFiles.length) { notify('Choose at least one file to upload.'); return }
    setUploading(true)
    let completed = 0
    try {
      for (const file of uploadFiles) {
        const key = uploadCategory === 'auto' ? classifyFile(file) : uploadCategory
        const folder = drive.folders[key]
        if (!folder) throw new Error('Destination folder missing. Reconnect Google Drive.')
        const uploaded = await uploadDriveFile(drive.token, folder.id, file)
        const sessionResult = supabase ? await supabase.auth.getSession() : null
        const session = sessionResult?.data?.session
        if (session?.user) {
          const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : null
          const typeMap = { projects: 'project', transitions: 'transition', footage: 'footage', broll: 'broll', sfx: 'sfx', music: 'music', images: 'image', archives: 'archive' }
          const { error } = await supabase.from('assets').upsert({
            user_id: session.user.id, drive_file_id: uploaded.id, drive_name: uploaded.name,
            display_name: uploaded.name, asset_type: typeMap[key] || 'other',
            mime_type: uploaded.mimeType, file_extension: ext,
            file_size_bytes: Number(uploaded.size || file.size),
            drive_web_view_link: uploaded.webViewLink || null,
            metadata: { drive_folder: folder.name, root_folder: drive.root.name },
          }, { onConflict: 'user_id,drive_file_id' })
          if (error) throw error
        }
        completed++
      }
      const refreshedAssets = await listDriveAssets(drive.token, drive.folders)
      setAssets(refreshedAssets)
      const sessionResult = supabase ? await supabase.auth.getSession() : null
      const hasSession = !!sessionResult?.data?.session
      notify('Uploaded ' + completed + ' file(s) to Google Drive.' + (hasSession ? ' Metadata saved.' : ' Supabase sign-in is still needed to sync metadata.'))
      setUploadFiles([])
      setShowUpload(false)
    } catch (error) {
      notify('Upload stopped after ' + completed + ' file(s): ' + (error.message || 'Unknown error'))
    } finally { setUploading(false) }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Aperture size={19} strokeWidth={1.8} /></div>
        <div><div className="brand-name">treasurevault<span>.</span></div><div className="brand-caption">CREATIVE ASSET LIBRARY</div></div>
      </div>

      <button className="workspace-switch">
        <div className="workspace-icon">T</div>
        <div className="workspace-copy"><strong>Personal workspace</strong><span>Free workspace</span></div>
        <ChevronDown size={15} />
      </button>

      <div className="nav-scroll">
        <div className="nav-label">LIBRARY</div>
        {categories.map(item => {
          const Icon = item.icon
          return <button key={item.id} onClick={() => { setActive(item.id); setSelected([]) }} className={`nav-item ${active === item.id ? 'active' : ''}`}>
            <Icon size={17} strokeWidth={1.7} /><span>{item.label}</span><small>{item.id === 'all' ? assets.length : assets.filter(asset => asset.type === item.id).length}</small>
          </button>
        })}

        <div className="nav-label nav-label-spaced">YOUR SPACE</div>
        <button className="nav-item" onClick={() => notify('Favorites view is coming with the database connection.')}><Star size={17} /><span>Favorites</span></button>
        <button className="nav-item" onClick={() => notify('Collections will be available in the next build.')}><Bookmark size={17} /><span>Collections</span></button>
        <button className="nav-item" onClick={() => notify('Upload history will appear when Drive is connected.')}><Upload size={17} /><span>Upload history</span></button>

        <div className="nav-label nav-label-spaced">DISCOVER</div>
        <button className="nav-item" onClick={() => notify('Stock marketplace integrations are coming soon.')}><Sparkles size={17} /><span>Stock marketplace</span><span className="soon-pill">SOON</span></button>
      </div>

      <div className="storage-card">
        <div className="storage-top"><div className="drive-icon"><HardDrive size={15} /></div><span>STORAGE</span><span className="connect-status"><i /> {drive ? "Connected" : "Not connected"}</span></div>
        <div className="storage-title">{drive ? "Editing Assets is ready" : "Connect your Google Drive"}</div>
        <p>{drive ? "Your Editing Assets folders are connected." : "Your files stay in your Drive. TreasureVault organizes and finds them."}</p>
        <button className="connect-button" disabled={connecting} onClick={connectDrive}>{connecting ? "Connecting…" : drive ? "Reconnect Drive" : "Connect Drive"} <ArrowDownUp size={13} /></button>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => notify('Settings will be added as integrations are connected.')}><Settings2 size={17} /><span>Settings</span></button>
        <button className="profile-row"><div className="avatar">Y</div><div><strong>Your workspace</strong><span>Google Drive library</span></div><CircleHelp size={16} /></button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><span>Library</span><ChevronRight size={14} /><strong>{currentCategory}</strong></div>
        <div className="top-actions"><div className="index-status"><span /> Indexing inactive</div><button className="icon-button" title="Help" onClick={() => notify('TreasureVault help is coming soon.')}><CircleHelp size={17} /></button><div className="top-avatar">Y</div></div>
      </header>

      <div className="content-wrap">
        <section className="page-heading">
          <div><div className="eyebrow">YOUR CREATIVE UNIVERSE</div><h1>{currentCategory}</h1><p>Everything you need for your next edit, in one place.</p></div>
          <div className="heading-actions"><button className="secondary-ai-button" onClick={() => setShowScriptStudio(true)}><Sparkles size={15}/> Script to images</button><button className="primary-button" onClick={() => setShowUpload(true)}><Plus size={16} /> Add assets</button></div>
        </section>

        <section className="search-panel">
          <div className="search-icon"><Sparkles size={18} /></div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, mood, scene, sound or describe what you need..." />
          <kbd><Command size={11} /> K</kbd>
          <div className="search-divider" />
          <span className="ai-search-label">AI SEARCH</span>
          <button className="search-submit" onClick={() => notify('Semantic search will activate after the Supabase and AI indexing setup.')}><Search size={17} /></button>
        </section>
        <div className="search-hints"><span>TRY</span><button onClick={() => setQuery('dark cinematic')}>dark cinematic</button><i>·</i><button onClick={() => setQuery('emotional piano')}>emotional piano</button><i>·</i><button onClick={() => setQuery('drone mountains')}>drone mountains</button><i>·</i><button onClick={() => setQuery('whoosh')}>whoosh</button></div>

        <section className="stats-row">
          <div className="stat"><div className="stat-icon"><Grid2X2 size={16} /></div><div><strong>{assets.length.toLocaleString()}</strong><span>Total assets</span></div></div>
          <div className="stat"><div className="stat-icon"><Cloud size={16} /></div><div><strong>{assets.reduce((sum, item) => sum + (item.bytes || 0), 0) ? (assets.reduce((sum, item) => sum + (item.bytes || 0), 0) / 1073741824).toFixed(2) + ' GB' : '—'}</strong><span>Indexed folder size</span></div></div>
          <div className="stat"><div className="stat-icon"><Star size={16} /></div><div><strong>{favorites.length}</strong><span>Favorites</span></div></div>
          <div className="stat"><div className="stat-icon"><Sparkles size={16} /></div><div><strong>Not active</strong><span>AI indexing</span></div></div>
        </section>

        <section className="assets-section">
          <div className="section-toolbar">
            <div><h2>{active === 'all' ? 'Recently added' : currentCategory}</h2><span className="result-count">{visible.length} files from Google Drive <span>·</span> sorted by {sort.toLowerCase()}</span></div>
            <div className="toolbar-actions">
              <button className={showFilters ? 'tool-button selected' : 'tool-button'} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={15} /> Filters</button>
              <div className="sort-control"><ArrowDownUp size={14} /><select value={sort} onChange={e => setSort(e.target.value)}><option>Recently added</option><option>Name A–Z</option></select><ChevronDown size={13} /></div>
              <div className="view-toggle"><button className={view === 'grid' ? 'chosen' : ''} onClick={() => setView('grid')}><Grid2X2 size={15} /></button><button className={view === 'list' ? 'chosen' : ''} onClick={() => setView('list')}><List size={16} /></button></div>
            </div>
          </div>

          {showFilters && <div className="filter-bar"><span>TYPE</span><button onClick={() => setActive('all')}>All</button><button onClick={() => setActive('footage')}>Video</button><button onClick={() => setActive('sfx')}>Audio</button><button onClick={() => setActive('projects')}>Project files</button><span className="filter-note">More filters arrive with live asset metadata.</span></div>}

          {selected.length > 0 && <div className="selection-bar"><span>{selected.length} selected</span><button onClick={() => setSelected([])}>Clear selection</button></div>}

          {loadingAssets ? <div className="empty-state"><Cloud size={24} /><h3>Reading your Drive library…</h3><p>Fetching files from your Editing Assets folders.</p></div> : visible.length ? <div className={view === 'grid' ? 'asset-grid' : 'asset-list'}>
            {visible.map(item => <article key={item.id} className={`asset-card ${selected.includes(item.id) ? 'asset-selected' : ''}`}>
              <div className="asset-preview-wrap" onClick={() => setActiveAsset(item)}>
                <AssetPreview item={item} />
                <span className="source-badge"><HardDrive size={11} /> DRIVE</span>
                <button className={`favorite-button ${favorites.includes(item.id) ? 'is-favorite' : ''}`} onClick={e => { e.stopPropagation(); toggleFavorite(item.id) }} title="Toggle favorite"><Star size={15} fill={favorites.includes(item.id) ? 'currentColor' : 'none'} /></button>
                {item.duration !== '—' && <span className="duration">{item.duration}</span>}
              </div>
              <div className="asset-info">
                <div className="asset-title-row"><h3 title={item.name}>{item.name}</h3><a className="more-button" href={item.webViewLink} target="_blank" rel="noreferrer" title="Open in Google Drive">↗</a></div>
                <div className="asset-meta"><span>{item.ext}</span><i />{item.size}<i />{item.resolution}</div>
                <div className="asset-foot"><span className="asset-tag">{item.tag}</span><span>{item.date}</span></div>
              </div>
            </article>)}
          </div> : <div className="empty-state"><Search size={24} /><h3>No assets found</h3><p>Try another search or switch to a different library section.</p><button onClick={() => { setQuery(''); setActive('all') }}>Clear search</button></div>}
        </section>
        <footer className="page-footer"><span>{drive ? 'Live Google Drive library' : 'Connect Google Drive to load your files'}</span><span>TreasureVault <b>·</b> Built for your workflow</span></footer>
      </div>
    </main>

    {showScriptStudio && <ScriptImageStudio drive={drive} onClose={() => setShowScriptStudio(false)} notify={notify} />}
    {activeAsset && <div className="drawer-backdrop" onClick={() => setActiveAsset(null)}><aside className="asset-drawer" onClick={e => e.stopPropagation()}>
      <div className="drawer-header"><div><span className="eyebrow">ASSET DETAILS</span><h2>Preview</h2></div><button className="modal-close" onClick={() => setActiveAsset(null)} aria-label="Close details"><X size={18} /></button></div>
      <div className="drawer-preview"><AssetPreview item={activeAsset} /><span className="drawer-kind">{activeAsset.kind}</span></div>
      <div className="drawer-file-title"><h3>{activeAsset.name}</h3><a href={activeAsset.webViewLink} target="_blank" rel="noreferrer" title="Open in Google Drive"><ExternalLink size={16} /></a></div>
      <div className="drawer-actions"><button className="primary-button" onClick={downloadSelectedAsset} disabled={downloadingAsset}><Download size={15} />{downloadingAsset ? 'Preparing…' : 'Download'}</button><a className="drawer-drive-link" href={activeAsset.webViewLink} target="_blank" rel="noreferrer">Open in Drive <ExternalLink size={13} /></a></div>
      <section className="drawer-section"><h4>FILE INFORMATION</h4><div className="detail-row"><span>File type</span><strong>{activeAsset.ext || '—'}</strong></div><div className="detail-row"><span>Format</span><strong>{activeAsset.mimeType || 'Unknown'}</strong></div><div className="detail-row"><span>File size</span><strong>{activeAsset.size || '—'}</strong></div><div className="detail-row"><span>Resolution</span><strong>{activeAsset.resolution || '—'}</strong></div><div className="detail-row"><span>Duration</span><strong>{activeAsset.duration || '—'}</strong></div><div className="detail-row"><span>Modified</span><strong>{activeAsset.date || '—'}</strong></div><div className="detail-row"><span>Current folder</span><strong>{activeAsset.folderName || activeAsset.tag || '—'}</strong></div></section>
      <section className="drawer-section"><h4><FolderInput size={14} /> MOVE TO FOLDER</h4><p className="drawer-help">Move this file to another folder inside Editing Assets.</p><select className="move-select" value={activeAsset.type} disabled={movingAsset} onChange={e => moveSelectedAsset(e.target.value)}>{DRIVE_FOLDERS.map(folder => <option key={folder.key} value={folder.key}>{folder.name}</option>)}</select>{movingAsset && <span className="moving-note">Moving file…</span>}</section>
    </aside></div>}
    {showUpload && <div className="modal-backdrop" onClick={() => setShowUpload(false)}><div className="upload-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setShowUpload(false)}><X size={17} /></button>
      <div className="modal-icon"><Upload size={21} /></div><h2>Upload assets to your vault</h2><p>Files are automatically sorted into the matching folder inside My Drive / Editing Assets. Original files stay in your Drive.</p>
      {!drive ? <button className="primary-button modal-cta" onClick={connectDrive} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect Google Drive'} <ChevronRight size={16} /></button> : <>
        <div className={dragging ? 'drop-zone drop-zone-active' : 'drop-zone'} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); setUploadFiles(old => [...old, ...Array.from(e.dataTransfer.files)]) }}>
          <Upload size={23} /><strong>Drop files here</strong><span>or choose files from your computer</span>
          <label className="choose-files">Choose files<input type="file" multiple onChange={e => setUploadFiles(old => [...old, ...Array.from(e.target.files || [])])} /></label>
        </div>
        {uploadFiles.length > 0 && <div className="upload-file-list">{uploadFiles.map((file, i) => <div key={i}><span>{file.name}</span><small>{(file.size / 1048576).toFixed(1)} MB · {uploadCategory === 'auto' ? DRIVE_FOLDERS.find(f => f.key === classifyFile(file))?.name : DRIVE_FOLDERS.find(f => f.key === uploadCategory)?.name}</small><button onClick={() => setUploadFiles(old => old.filter((_, index) => index !== i))}>×</button></div>)}</div>}
        <label className="upload-category">Destination folder<select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}><option value="auto">Automatically detect from file type</option>{DRIVE_FOLDERS.map(folder => <option key={folder.key} value={folder.key}>{folder.name}</option>)}</select></label>
        <button className="primary-button modal-cta" disabled={uploading || !uploadFiles.length} onClick={handleUpload}>{uploading ? 'Uploading…' : 'Upload ' + uploadFiles.length + ' file' + (uploadFiles.length === 1 ? '' : 's') + ' to Drive'} <Upload size={15} /></button>
      </>}
      <span className="modal-footnote"><Check size={13} /> Uploads go directly to your Google Drive</span>
    </div></div>}
    {toast && <div className="toast"><Check size={15} />{toast}</div>}
  </div>
}

export default App
