import { useMemo, useState } from 'react'
import {
  Aperture, ArrowDownUp, AudioLines, Bookmark, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clapperboard, Cloud, Command,
  Disc3, FileArchive, FileImage, FileVideo, Filter, Folder, FolderOpen,
  Grid2X2, HardDrive, Headphones, Image, LayoutGrid, List, Music2,
  Plus, Search, Settings2, SlidersHorizontal, Sparkles, Star, Upload,
  Video, Waves, X
} from 'lucide-react'

const categories = [
  { id: 'all', label: 'All assets', icon: LayoutGrid, count: '2,486' },
  { id: 'projects', label: 'Project files', icon: FolderOpen, count: '128' },
  { id: 'transitions', label: 'Transitions', icon: Waves, count: '342' },
  { id: 'footage', label: 'Footages', icon: Video, count: '684' },
  { id: 'broll', label: 'B-roll', icon: Clapperboard, count: '516' },
  { id: 'sfx', label: 'Sound effects', icon: AudioLines, count: '491' },
  { id: 'music', label: 'Background music', icon: Music2, count: '325' },
]

const samples = [
  { id: 1, name: 'Midnight city aerial', type: 'footage', kind: 'VIDEO', ext: 'MP4', duration: '00:18', size: '84.2 MB', resolution: '4K', tag: 'Cinematic', color: 'violet', date: 'Today' },
  { id: 2, name: 'Ethereal light leaks', type: 'transitions', kind: 'VIDEO', ext: 'MOV', duration: '00:04', size: '28.6 MB', resolution: '4K', tag: 'Overlay', color: 'amber', date: 'Today' },
  { id: 3, name: 'Soft piano atmosphere', type: 'music', kind: 'AUDIO', ext: 'WAV', duration: '02:46', size: '46.1 MB', resolution: 'WAV', tag: 'Emotional', color: 'blue', date: 'Yesterday' },
  { id: 4, name: 'Rain on window close-up', type: 'broll', kind: 'VIDEO', ext: 'MP4', duration: '00:24', size: '112 MB', resolution: '4K', tag: 'Moody', color: 'cyan', date: 'Yesterday' },
  { id: 5, name: 'Impact whoosh collection', type: 'sfx', kind: 'AUDIO', ext: 'WAV', duration: '00:02', size: '8.4 MB', resolution: '48 kHz', tag: 'Impact', color: 'orange', date: 'Nov 22' },
  { id: 6, name: 'Brand film — final edit', type: 'projects', kind: 'PROJECT', ext: 'PRPROJ', duration: '—', size: '18.7 MB', resolution: 'Premiere', tag: 'Client work', color: 'green', date: 'Nov 21' },
  { id: 7, name: 'Mountain drone sequence', type: 'footage', kind: 'VIDEO', ext: 'MOV', duration: '00:32', size: '196 MB', resolution: '4K', tag: 'Nature', color: 'green', date: 'Nov 20' },
  { id: 8, name: 'Analog film grain 04', type: 'transitions', kind: 'VIDEO', ext: 'MOV', duration: '00:12', size: '64 MB', resolution: '4K', tag: 'Texture', color: 'pink', date: 'Nov 19' },
]

const navGroups = [
  { title: 'LIBRARY', items: categories },
]

function Thumb({ item }) {
  const Icon = item.kind === 'AUDIO' ? AudioLines : item.kind === 'PROJECT' ? FileArchive : item.type === 'transitions' ? Aperture : FileVideo
  return <div className={`thumb thumb-${item.color}`}>
    <div className="thumb-orb" />
    <div className="thumb-grid" />
    <Icon size={25} strokeWidth={1.45} />
    <span className="thumb-ext">{item.ext}</span>
    {item.kind === 'VIDEO' && <span className="play-mark">▶</span>}
  </div>
}

function App() {
  const [active, setActive] = useState('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [sort, setSort] = useState('Recently added')
  const [favorites, setFavorites] = useState([2, 5])
  const [selected, setSelected] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [toast, setToast] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = samples.filter(item => (active === 'all' || item.type === active) &&
      (!q || [item.name, item.tag, item.ext, item.type, item.resolution].join(' ').toLowerCase().includes(q)))
    if (sort === 'Name A–Z') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [active, query, sort])

  const currentCategory = categories.find(c => c.id === active)?.label || 'All assets'
  const toggleFavorite = id => setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id])
  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 2600) }

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
            <Icon size={17} strokeWidth={1.7} /><span>{item.label}</span><small>{item.count}</small>
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
        <div className="storage-top"><div className="drive-icon"><HardDrive size={15} /></div><span>STORAGE</span><span className="connect-status"><i /> Not connected</span></div>
        <div className="storage-title">Connect your Google Drive</div>
        <p>Your files stay in your Drive. TreasureVault organizes and finds them.</p>
        <button className="connect-button" onClick={() => notify('Google Drive connection is the next integration step.')}>Connect Drive <ArrowDownUp size={13} /></button>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => notify('Settings will be added as integrations are connected.')}><Settings2 size={17} /><span>Settings</span></button>
        <button className="profile-row"><div className="avatar">Y</div><div><strong>Your workspace</strong><span>Local preview</span></div><CircleHelp size={16} /></button>
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
          <button className="primary-button" onClick={() => setShowUpload(true)}><Plus size={16} /> Add assets</button>
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
          <div className="stat"><div className="stat-icon"><Grid2X2 size={16} /></div><div><strong>2,486</strong><span>Total assets</span></div></div>
          <div className="stat"><div className="stat-icon"><Cloud size={16} /></div><div><strong>—</strong><span>Drive storage used</span></div></div>
          <div className="stat"><div className="stat-icon"><Star size={16} /></div><div><strong>{favorites.length}</strong><span>Favorites</span></div></div>
          <div className="stat"><div className="stat-icon"><Sparkles size={16} /></div><div><strong>Not active</strong><span>AI indexing</span></div></div>
        </section>

        <section className="assets-section">
          <div className="section-toolbar">
            <div><h2>{active === 'all' ? 'Recently added' : currentCategory}</h2><span className="result-count">{visible.length} sample assets <span>·</span> sorted by {sort.toLowerCase()}</span></div>
            <div className="toolbar-actions">
              <button className={showFilters ? 'tool-button selected' : 'tool-button'} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={15} /> Filters</button>
              <div className="sort-control"><ArrowDownUp size={14} /><select value={sort} onChange={e => setSort(e.target.value)}><option>Recently added</option><option>Name A–Z</option></select><ChevronDown size={13} /></div>
              <div className="view-toggle"><button className={view === 'grid' ? 'chosen' : ''} onClick={() => setView('grid')}><Grid2X2 size={15} /></button><button className={view === 'list' ? 'chosen' : ''} onClick={() => setView('list')}><List size={16} /></button></div>
            </div>
          </div>

          {showFilters && <div className="filter-bar"><span>TYPE</span><button onClick={() => setActive('all')}>All</button><button onClick={() => setActive('footage')}>Video</button><button onClick={() => setActive('sfx')}>Audio</button><button onClick={() => setActive('projects')}>Project files</button><span className="filter-note">More filters arrive with live asset metadata.</span></div>}

          {selected.length > 0 && <div className="selection-bar"><span>{selected.length} selected</span><button onClick={() => setSelected([])}>Clear selection</button></div>}

          {visible.length ? <div className={view === 'grid' ? 'asset-grid' : 'asset-list'}>
            {visible.map(item => <article key={item.id} className={`asset-card ${selected.includes(item.id) ? 'asset-selected' : ''}`}>
              <div className="asset-preview-wrap" onClick={() => setSelected(old => old.includes(item.id) ? old.filter(x => x !== item.id) : [...old, item.id])}>
                <Thumb item={item} />
                <span className="source-badge"><HardDrive size={11} /> DRIVE</span>
                <button className={`favorite-button ${favorites.includes(item.id) ? 'is-favorite' : ''}`} onClick={e => { e.stopPropagation(); toggleFavorite(item.id) }} title="Toggle favorite"><Star size={15} fill={favorites.includes(item.id) ? 'currentColor' : 'none'} /></button>
                {item.duration !== '—' && <span className="duration">{item.duration}</span>}
              </div>
              <div className="asset-info">
                <div className="asset-title-row"><h3 title={item.name}>{item.name}</h3><button className="more-button" onClick={() => notify('Asset actions will be available when files are connected.')}>···</button></div>
                <div className="asset-meta"><span>{item.ext}</span><i />{item.size}<i />{item.resolution}</div>
                <div className="asset-foot"><span className="asset-tag">{item.tag}</span><span>{item.date}</span></div>
              </div>
            </article>)}
          </div> : <div className="empty-state"><Search size={24} /><h3>No assets found</h3><p>Try another search or switch to a different library section.</p><button onClick={() => { setQuery(''); setActive('all') }}>Clear search</button></div>}
        </section>
        <footer className="page-footer"><span>Showing sample interface data</span><span>TreasureVault <b>·</b> Built for your workflow</span></footer>
      </div>
    </main>

    {showUpload && <div className="modal-backdrop" onClick={() => setShowUpload(false)}><div className="upload-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setShowUpload(false)}><X size={17} /></button>
      <div className="modal-icon"><Upload size={21} /></div><h2>Add assets to your vault</h2><p>Connect Google Drive to import files directly into your personal library. Your original files will remain in Drive.</p>
      <button className="primary-button modal-cta" onClick={() => { setShowUpload(false); notify('Drive OAuth setup is next. No files have been uploaded yet.') }}>Set up Google Drive <ChevronRight size={16} /></button>
      <span className="modal-footnote"><Check size={13} /> Your files stay in your own Google Drive</span>
    </div></div>}
    {toast && <div className="toast"><Check size={15} />{toast}</div>}
  </div>
}

export default App
