import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* ─────────────────────────────────────────
   RARITY CONFIG
───────────────────────────────────────── */
const RARITY_ORDER = {
  common: 0, uncommon: 1, rare: 2,
  super_rare: 3, ultra_rare: 4, legendary: 5, unknown: -1,
};
const RARITY_LABELS = {
  common: "Common", uncommon: "Uncommon", rare: "Rare",
  super_rare: "Super Rare", ultra_rare: "Ultra Rare",
  legendary: "Legendary", unknown: "—",
};
const RARITY_COLORS = {
  common: "#8a9bb5",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  super_rare: "#c084fc",
  ultra_rare: "#fb923c",
  legendary: "#e8c84a",
  unknown: "#3a4568",
};

/* ─────────────────────────────────────────
   AUTH HELPERS
───────────────────────────────────────── */
function getToken()    { return localStorage.getItem("ct_token"); }
function getUsername() { return localStorage.getItem("ct_username"); }
function saveAuth(token, username) {
  localStorage.setItem("ct_token", token);
  localStorage.setItem("ct_username", username);
}
function clearAuth() {
  localStorage.removeItem("ct_token");
  localStorage.removeItem("ct_username");
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className={`toast toast--${t.type}`}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22 }}>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN APP
───────────────────────────────────────── */
export default function App() {
  const [authed, setAuthed]           = useState(!!getToken());
  const [username, setUsername]       = useState(getUsername() || "");
  const [view, setView]               = useState("home");
  const [scanning, setScanning]       = useState(false);
  const [collections, setCollections] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [toasts, setToasts]           = useState([]);

  const pushToast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const handleAuth = (uname) => { setUsername(uname); setAuthed(true); };
  const handleLogout = () => {
    clearAuth(); setAuthed(false); setUsername("");
    setCollections([]); setView("home");
  };

  const fetchCollections = useCallback(async () => {
    if (!getToken()) return;
    setLoadingCols(true);
    try {
      const res = await fetch(`${API_BASE}/collection/`, { headers: authHeaders() });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      setCollections(data.collections || []);
    } catch { pushToast("Could not load collections", "error"); }
    finally { setLoadingCols(false); }
  }, [pushToast]);

  useEffect(() => { if (authed) fetchCollections(); }, [authed, fetchCollections]);

  if (!authed) return <AuthScreen onAuth={handleAuth} />;

  return (
    <div className="app-root">
      <Toast toasts={toasts} />
      <Sidebar
        view={view} setView={setView}
        username={username} onLogout={handleLogout}
        collections={collections}
        onScan={() => setScanning(true)}
      />
      <main className="app-main">
        <AnimatePresence mode="wait">
          {view === "home" && (
            <HomeView key="home"
              collections={collections} loadingCols={loadingCols}
              onBrowse={() => setView("browse")} onScan={() => setScanning(true)}
              username={username} pushToast={pushToast}
            />
          )}
          {view === "browse" && (
            <BrowseView key="browse"
              collections={collections} apiBase={API_BASE}
              onCollectionDeleted={fetchCollections} pushToast={pushToast}
            />
          )}
          {view === "social" && (
            <SocialView key="social" apiBase={API_BASE} pushToast={pushToast} username={username} />
          )}
          {view === "trades" && (
            <TradesView key="trades" apiBase={API_BASE} pushToast={pushToast}
              collections={collections} username={username} />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {scanning && (
          <Scanner
            onClose={() => setScanning(false)}
            onItemAdded={() => { fetchCollections(); pushToast("Item added to collection!", "success"); }}
            apiBase={API_BASE} pushToast={pushToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────── */
const NAV = [
  { id: "home",   icon: "⬡", label: "Overview" },
  { id: "browse", icon: "◈", label: "Collection" },
  { id: "social", icon: "◎", label: "Community" },
  { id: "trades", icon: "⇌", label: "Trades" },
];

function Sidebar({ view, setView, username, onLogout, collections, onScan }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalItems = collections.reduce((a, c) => a + c.owned_count, 0);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--col" : ""}`}>
      <div className="sidebar-logo">
        <div className="sidebar-emblem">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <polygon points="15,2 27,8 27,22 15,28 3,22 3,8"
              stroke="var(--gold)" strokeWidth="1.5" fill="none"/>
            <polygon points="15,7 23,11 23,19 15,23 7,19 7,11"
              stroke="var(--gold-dim)" strokeWidth="0.75" fill="rgba(212,175,55,0.06)"/>
            <circle cx="15" cy="15" r="3.5" fill="none" stroke="var(--gold)" strokeWidth="1.2"/>
            <circle cx="15" cy="15" r="1.5" fill="var(--gold)"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="sidebar-brand">
            <span className="sidebar-brand-en">Collector</span>
            <span className="sidebar-brand-jp">達人</span>
          </div>
        )}
        <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <div className="sidebar-sep" />

      <button className="sidebar-scan-btn" onClick={onScan} title="Scan Item">
        <span className="sidebar-scan-icon">⊙</span>
        {!collapsed && <span>Scan Item</span>}
      </button>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button key={item.id}
            className={`sidebar-nav-item ${view === item.id ? "active" : ""}`}
            onClick={() => setView(item.id)}
            title={collapsed ? item.label : ""}>
            <span className="sidebar-nav-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
            {view === item.id && <span className="sidebar-nav-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-sep" />
        {!collapsed && (
          <div className="sidebar-stats-pill">
            <span className="sidebar-stats-num">{totalItems}</span>
            <span className="sidebar-stats-lbl">items collected</span>
          </div>
        )}
        <div className="sidebar-user">
          <div className="sidebar-avatar">{username[0]?.toUpperCase() || "?"}</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{username}</span>
              <span className="sidebar-user-rank">達人</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button className="sidebar-logout" onClick={onLogout}>Sign out</button>
        )}
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────
   HOME VIEW
───────────────────────────────────────── */
function HomeView({ collections, loadingCols, onBrowse, onScan, username, pushToast }) {
  const totalItems = collections.reduce((a, c) => a + c.owned_count, 0);
  const topCat = [...collections].sort((a, b) => b.owned_count - a.owned_count)[0];

  return (
    <motion.div className="view home-view"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>

      <div className="home-hero">
        <div className="home-hero-bg">
          <svg className="home-hex-bg" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice">
            {[...Array(30)].map((_, i) => {
              const col = i % 7, row = Math.floor(i / 7);
              const x = col * 128 + (row % 2 === 1 ? 64 : 0);
              const y = row * 110 - 40;
              return (
                <polygon key={i} points="56,0 112,32 112,96 56,128 0,96 0,32"
                  transform={`translate(${x},${y})`}
                  fill="none" stroke="rgba(212,175,55,0.055)" strokeWidth="1"/>
              );
            })}
          </svg>
          <div className="home-orb home-orb-1" />
          <div className="home-orb home-orb-2" />
        </div>
        <div className="home-hero-content">
          <p className="home-greeting">Welcome back, <strong>{username}</strong></p>
          <h1 className="home-title">Your Collection</h1>
          <p className="home-title-jp">コレクション達人</p>
          <div className="home-hero-actions">
            <button className="btn-gold" onClick={onScan}>
              <span>⊙</span> Scan Item
            </button>
            {collections.length > 0 && (
              <button className="btn-outline" onClick={onBrowse}>Browse All</button>
            )}
          </div>
        </div>
      </div>

      <div className="home-stats-row">
        <div className="stat-card">
          <span className="stat-num">{totalItems}</span>
          <span className="stat-lbl">Items Collected</span>
        </div>
        <div className="stat-card stat-card--gold">
          <span className="stat-num">{collections.length}</span>
          <span className="stat-lbl">Categories</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">
            {collections.length > 0
              ? Math.round(collections.reduce((a, c) => a + c.progress_percent, 0) / collections.length)
              : 0}%
          </span>
          <span className="stat-lbl">Avg. Completion</span>
        </div>
        {topCat && (
          <div className="stat-card">
            <span className="stat-num" style={{ fontSize: "1rem", lineHeight: 1.3 }}>
              {topCat.display_name}
            </span>
            <span className="stat-lbl">Top Category</span>
          </div>
        )}
      </div>

      <div className="home-section-hdr">
        <h2>Collections</h2>
        {collections.length > 0 && (
          <button className="btn-ghost" onClick={onBrowse}>View all →</button>
        )}
      </div>

      {loadingCols ? (
        <div className="loading-row">
          {[1,2,3].map(i => <div key={i} className="col-card-skeleton shimmer" />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emblem">⊙</div>
          <p>No items yet — scan something to begin your journey</p>
          <button className="btn-gold" onClick={onScan}>Scan your first item</button>
        </div>
      ) : (
        <div className="col-cards-grid">
          {collections.map((col, i) => (
            <motion.div key={col.category} className="col-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>
              <div className="col-card-top">
                <span className="col-card-name">{col.display_name}</span>
                <span className="col-card-pct">{col.progress_percent}%</span>
              </div>
              <div className="col-card-count">
                <span className="col-card-owned">{col.owned_count}</span>
                <span className="col-card-total"> / {col.total_count}</span>
              </div>
              <div className="col-card-bar-track">
                <motion.div className="col-card-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${col.progress_percent}%` }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.06, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   BROWSE VIEW
───────────────────────────────────────── */
const SORT_OPTS = [
  { key: "recent",      label: "Recent" },
  { key: "alpha",       label: "A–Z" },
  { key: "rarity_desc", label: "Rarity ↓" },
  { key: "rarity_asc",  label: "Rarity ↑" },
  { key: "price_desc",  label: "Value ↓" },
  { key: "price_asc",   label: "Value ↑" },
];

function sortItems(items, mode) {
  const arr = [...items];
  switch (mode) {
    case "recent":      return arr.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    case "alpha":       return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "rarity_desc": return arr.sort((a, b) => (RARITY_ORDER[b.rarity_tier] ?? -1) - (RARITY_ORDER[a.rarity_tier] ?? -1));
    case "rarity_asc":  return arr.sort((a, b) => (RARITY_ORDER[a.rarity_tier] ?? -1) - (RARITY_ORDER[b.rarity_tier] ?? -1));
    case "price_desc":  return arr.sort((a, b) => (b.price_estimate ?? -1) - (a.price_estimate ?? -1));
    case "price_asc":   return arr.sort((a, b) => (a.price_estimate ?? Infinity) - (b.price_estimate ?? Infinity));
    default: return arr;
  }
}

function BrowseView({ collections, apiBase, onCollectionDeleted, pushToast }) {
  const [localCols, setLocalCols]     = useState(collections);
  const [selectedCat, setSelectedCat] = useState(collections[0]?.category ?? null);
  const [detail, setDetail]           = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sortMode, setSortMode]       = useState("recent");
  const [search, setSearch]           = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirmDel, setConfirmDel]   = useState(null);
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => { setLocalCols(collections); }, [collections]);

  const fetchDetail = useCallback(async (cat) => {
    if (!cat) return;
    setLoadingDetail(true); setDetail(null); setSearch("");
    try {
      const res = await fetch(`${apiBase}/collection/${cat}`, { headers: authHeaders() });
      setDetail(await res.json());
    } catch { pushToast("Could not load category", "error"); }
    finally { setLoadingDetail(false); }
  }, [apiBase, pushToast]);

  useEffect(() => { if (selectedCat) fetchDetail(selectedCat); }, [selectedCat, fetchDetail]);

  const handleDelete = async (cat) => {
    setDeleting(true);
    try {
      await fetch(`${apiBase}/collection/${cat}`, { method: "DELETE", headers: authHeaders() });
      const updated = localCols.filter(c => c.category !== cat);
      setLocalCols(updated);
      onCollectionDeleted();
      pushToast("Collection deleted", "success");
      const next = updated[0]?.category ?? null;
      setSelectedCat(next);
      if (!next) setDetail(null);
    } catch { pushToast("Delete failed", "error"); }
    finally { setDeleting(false); setConfirmDel(null); }
  };

  const filteredItems = useMemo(() => {
    if (!detail?.items) return [];
    let items = detail.items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q) ||
        (i.rarity || "").toLowerCase().includes(q)
      );
    }
    return sortItems(items, sortMode);
  }, [detail, search, sortMode]);

  const selectedMeta = localCols.find(c => c.category === selectedCat);

  return (
    <motion.div className="view browse-view"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>

      <div className="browse-layout">
        <div className="browse-sidebar">
          <div className="browse-sidebar-hdr">
            <h2>Collections</h2>
          </div>
          {localCols.length === 0 && (
            <p className="browse-empty-hint">No collections yet</p>
          )}
          {localCols.map(col => (
            <div key={col.category} className="browse-cat-row">
              <button
                className={`browse-cat-btn ${selectedCat === col.category ? "active" : ""}`}
                onClick={() => setSelectedCat(col.category)}>
                <span className="browse-cat-name">{col.display_name}</span>
                <span className="browse-cat-count">{col.owned_count}/{col.total_count}</span>
                <div className="browse-cat-bar-track">
                  <div className="browse-cat-bar-fill" style={{ width: `${col.progress_percent}%` }} />
                </div>
              </button>
              <button className="browse-cat-del" title="Delete collection"
                onClick={() => setConfirmDel(col.category)}>✕</button>
            </div>
          ))}
        </div>

        <div className="browse-content">
          {selectedMeta && (
            <div className="browse-content-hdr">
              <div className="browse-content-hdr-left">
                <h2>{selectedMeta.display_name}</h2>
                <p className="browse-content-stats">
                  <span className="gold">{selectedMeta.owned_count}</span>
                  {" of "}
                  <span className="gold">{selectedMeta.total_count}</span>
                  {" collected — "}
                  <span className="gold">{selectedMeta.progress_percent}%</span>
                </p>
              </div>
              <ProgressRing
                percent={selectedMeta.progress_percent}
                owned={selectedMeta.owned_count}
                total={selectedMeta.total_count}
              />
            </div>
          )}

          {detail && detail.items?.length > 0 && (
            <div className="browse-toolbar">
              <div className="browse-search-wrap">
                <span className="browse-search-icon">⌕</span>
                <input
                  className="browse-search-input"
                  placeholder={`Search in ${selectedMeta?.display_name ?? "collection"}...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="browse-search-clear" onClick={() => setSearch("")}>×</button>
                )}
              </div>
              <div className="sort-bar">
                {SORT_OPTS.map(o => (
                  <button key={o.key}
                    className={`sort-btn ${sortMode === o.key ? "active" : ""}`}
                    onClick={() => setSortMode(o.key)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {search && detail && (
            <div className="search-result-count">
              {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""} for "{search}"
            </div>
          )}

          {loadingDetail ? (
            <div className="browse-loading">
              <motion.div className="scanner-spinner"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} />
              <p>Loading collection…</p>
            </div>
          ) : detail ? (
            <CollectionGrid
              detail={{ ...detail, items: filteredItems }}
              totalCount={selectedMeta?.total_count ?? 0}
              showPlaceholders={!search}
              onSelectItem={setSelectedItem}
            />
          ) : localCols.length === 0 ? (
            <div className="browse-loading"><p className="muted">No collections yet.</p></div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {confirmDel && (
          <ConfirmDialog
            title="Delete collection?"
            body={`Remove all ${localCols.find(c => c.category === confirmDel)?.display_name} items? This cannot be undone.`}
            onCancel={() => setConfirmDel(null)}
            onConfirm={() => handleDelete(confirmDel)}
            loading={deleting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && (
          <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   COLLECTION GRID
───────────────────────────────────────── */
function CollectionGrid({ detail, totalCount, showPlaceholders, onSelectItem }) {
  const { items } = detail;
  const placeholders = showPlaceholders ? Math.max(0, totalCount - items.length) : 0;

  return (
    <div className="coll-grid-wrap">
      <div className="coll-grid">
        {items.map((item, i) => (
          <OwnedCard key={item._id || item.name} item={item} index={i} onClick={() => onSelectItem(item)} />
        ))}
        {Array.from({ length: placeholders }).map((_, i) => (
          <motion.div key={`ph-${i}`} className="coll-item coll-item--ph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(items.length * 0.02 + i * 0.008, 0.5) }}>
            <div className="coll-item-inner">
              <div className="coll-icon coll-icon--ph">?</div>
              <p className="coll-name coll-name--ph">???</p>
            </div>
          </motion.div>
        ))}
      </div>
      {placeholders > 0 && (
        <p className="coll-footer muted">{placeholders} item{placeholders !== 1 ? "s" : ""} still undiscovered</p>
      )}
    </div>
  );
}

function OwnedCard({ item, index, onClick }) {
  const rc = RARITY_COLORS[item.rarity_tier] ?? null;
  return (
    <motion.div className="coll-item coll-item--owned"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay: index * 0.02 }}
      whileHover={{ scale: 1.04, transition: { duration: 0.1 } }}
      onClick={onClick}
      style={rc ? { borderColor: rc + "44" } : {}}>
      <div className="coll-item-inner">
        {item.image_data ? (
          <div className="coll-img-wrap">
            <img src={`data:image/jpeg;base64,${item.image_data}`} alt={item.name} className="coll-img" />
          </div>
        ) : (
          <div className="coll-icon" style={rc ? { borderColor: rc + "55", color: rc } : {}}>✓</div>
        )}
        <p className="coll-name">{item.name}</p>
        {item.rarity_tier && item.rarity_tier !== "unknown" && (
          <span className="coll-rarity" style={{ color: rc }}>
            {item.rarity || RARITY_LABELS[item.rarity_tier]}
          </span>
        )}
        {item.price_estimate != null && (
          <span className="coll-price">
            ${item.price_estimate % 1 === 0 ? item.price_estimate : item.price_estimate.toFixed(2)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   PROGRESS RING
───────────────────────────────────────── */
function ProgressRing({ percent, owned, total }) {
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <svg className="progress-ring" viewBox="0 0 88 88" width="88" height="88">
      <circle cx="44" cy="44" r={r} className="ring-track" />
      <motion.circle cx="44" cy="44" r={r} className="ring-fill"
        strokeDasharray={circ}
        strokeDashoffset={circ}
        animate={{ strokeDashoffset: circ - (percent / 100) * circ }}
        transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
        style={{ transformOrigin: "44px 44px", rotate: "-90deg" }}
      />
      <text x="44" y="39" className="ring-text-big" textAnchor="middle" dominantBaseline="middle">
        {Math.round(percent)}%
      </text>
      <text x="44" y="54" className="ring-text-small" textAnchor="middle">{owned}/{total}</text>
    </svg>
  );
}

/* ─────────────────────────────────────────
   ITEM DETAIL MODAL
───────────────────────────────────────── */
function ItemDetailModal({ item, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const rc = RARITY_COLORS[item.rarity_tier] ?? "#aaa";
  const rl = RARITY_LABELS[item.rarity_tier] ?? "—";
  const dateStr = item.added_at
    ? new Date(item.added_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown";

  return (
    <motion.div className="modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="item-modal"
        initial={{ opacity: 0, scale: 0.93, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 18 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>

        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="item-modal-body">
          <div className="item-modal-img-panel">
            {item.image_data ? (
              <>
                <img src={`data:image/jpeg;base64,${item.image_data}`} alt={item.name}
                  className="item-modal-img" onClick={() => setExpanded(true)} title="Click to enlarge" />
                <span className="item-modal-zoom-hint">click to enlarge</span>
              </>
            ) : (
              <div className="item-modal-img-ph"><span>?</span></div>
            )}
            {item.rarity_tier && item.rarity_tier !== "unknown" && (
              <span className="item-modal-rarity-badge"
                style={{ background: rc + "22", color: rc, borderColor: rc + "55" }}>
                {item.rarity || rl}
              </span>
            )}
          </div>

          <div className="item-modal-info">
            <h2 className="item-modal-name">{item.name}</h2>
            {item.description && <p className="item-modal-desc">{item.description}</p>}
            <div className="item-modal-stats">
              {item.rarity_tier && item.rarity_tier !== "unknown" && (
                <StatRow label="Rarity" value={item.rarity || rl} color={rc} />
              )}
              {item.price_estimate != null && (
                <StatRow label="Est. Value"
                  value={`$${item.price_estimate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  color="var(--gold)"
                  sub={item.price_note} />
              )}
              <StatRow label="Collected" value={dateStr} />
              {item.confidence != null && (
                <StatRow label="AI Confidence" value={`${Math.round(item.confidence * 100)}%`} />
              )}
            </div>
            {item.metadata && Object.keys(item.metadata).length > 0 && (
              <div className="item-meta-block">
                {Object.entries(item.metadata).map(([k, v]) => (
                  <div key={k} className="item-meta-row">
                    <span className="item-meta-key">{k}</span>
                    <span className="item-meta-val">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div className="lightbox"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}>
            <motion.img src={`data:image/jpeg;base64,${item.image_data}`} alt={item.name}
              className="lightbox-img"
              initial={{ scale: 0.87, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.87, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()} />
            <button className="lightbox-close" onClick={() => setExpanded(false)}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatRow({ label, value, color, sub }) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className="stat-row-value" style={color ? { color } : {}}>
        {value}
        {sub && <span className="stat-row-sub">{sub}</span>}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────
   SOCIAL VIEW
───────────────────────────────────────── */
function SocialView({ apiBase, pushToast, username }) {
  const [tab, setTab]             = useState("search");
  const [searchQ, setSearchQ]     = useState("");
  const [searchRes, setSearchRes] = useState(null);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends]     = useState([
    { username: "AkiraCollects", status: "online",  items: 142, topCat: "Genshin Impact" },
    { username: "SakuraTrades",  status: "offline", items: 87,  topCat: "Yu-Gi-Oh!" },
    { username: "NagitoCards",   status: "online",  items: 210, topCat: "Pokémon" },
  ]);
  const [viewingFriend, setViewingFriend] = useState(null);

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true); setSearchRes(null);
    await new Promise(r => setTimeout(r, 600));
    if (searchQ.toLowerCase() === username.toLowerCase()) {
      setSearchRes({ found: false, reason: "That's you!" });
    } else if (searchQ.length > 2) {
      setSearchRes({
        found: true,
        user: {
          username: searchQ,
          items: Math.floor(Math.random() * 200) + 20,
          topCat: "Genshin Impact",
          public: true,
        }
      });
    } else {
      setSearchRes({ found: false, reason: "No user found." });
    }
    setSearching(false);
  };

  const addFriend = (uname) => {
    if (friends.find(f => f.username === uname)) {
      pushToast("Already friends!", "info"); return;
    }
    setFriends(p => [...p, {
      username: uname, status: "offline",
      items: searchRes?.user?.items ?? 0,
      topCat: searchRes?.user?.topCat ?? "—"
    }]);
    setSearchRes(null); setSearchQ("");
    pushToast(`Friend request sent to ${uname}!`, "success");
  };

  return (
    <motion.div className="view social-view"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.28 }}>

      <div className="view-hdr">
        <h1>Community</h1>
        <p className="muted">Find collectors, view their vaults, request trades</p>
      </div>

      <div className="tab-row">
        {[["search","Find Collector"], ["friends","Friends"], ["profile","My Profile"]].map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <div className="social-search-panel">
          <div className="social-search-row">
            <div className="browse-search-wrap" style={{ flex: 1 }}>
              <span className="browse-search-icon">⌕</span>
              <input className="browse-search-input"
                placeholder="Search by username…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch()}
              />
            </div>
            <button className="btn-gold" onClick={doSearch} disabled={searching}>
              {searching ? "…" : "Search"}
            </button>
          </div>

          {searchRes && (
            <motion.div className="social-search-result"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {searchRes.found ? (
                <div className="user-card">
                  <div className="user-card-avatar">{searchRes.user.username[0].toUpperCase()}</div>
                  <div className="user-card-info">
                    <strong>{searchRes.user.username}</strong>
                    <span className="muted">{searchRes.user.items} items · Top: {searchRes.user.topCat}</span>
                  </div>
                  <div className="user-card-actions">
                    <button className="btn-outline btn-sm" onClick={() => setViewingFriend(searchRes.user)}>
                      View Collection
                    </button>
                    <button className="btn-gold btn-sm" onClick={() => addFriend(searchRes.user.username)}>
                      + Add Friend
                    </button>
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ padding: "1rem 0" }}>{searchRes.reason}</p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {tab === "friends" && (
        <div className="friends-list">
          {friends.length === 0 && <p className="muted">No friends yet — search for collectors above.</p>}
          {friends.map((f, i) => (
            <motion.div key={f.username} className="user-card"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}>
              <div className="user-card-avatar" style={{ position: "relative" }}>
                {f.username[0].toUpperCase()}
                <span className={`status-dot status-dot--${f.status}`} />
              </div>
              <div className="user-card-info">
                <strong>{f.username}</strong>
                <span className="muted">{f.items} items · Top: {f.topCat}</span>
              </div>
              <div className="user-card-actions">
                <button className="btn-outline btn-sm" onClick={() => setViewingFriend(f)}>
                  View Collection
                </button>
                <button className="btn-ghost btn-sm">Trade →</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "profile" && (
        <div className="my-profile">
          <div className="profile-card">
            <div className="profile-avatar">{username[0]?.toUpperCase()}</div>
            <div>
              <h2>{username}</h2>
              <span className="profile-rank">達人 · Master Collector</span>
            </div>
          </div>
          <div className="profile-privacy">
            <h3>Privacy Settings</h3>
            <div className="privacy-row">
              <span>Public collection</span>
              <label className="toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
              </label>
            </div>
            <div className="privacy-row">
              <span>Accept trade requests</span>
              <label className="toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
              </label>
            </div>
            <div className="privacy-row">
              <span>Show estimated values</span>
              <label className="toggle">
                <input type="checkbox" />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
              </label>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewingFriend && (
          <FriendCollectionModal user={viewingFriend} onClose={() => setViewingFriend(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FriendCollectionModal({ user, onClose }) {
  const MOCK_ITEMS = [
    { name: "Hu Tao",   rarity_tier: "ultra_rare", rarity: "5-star", price_estimate: 340 },
    { name: "Raiden",   rarity_tier: "ultra_rare", rarity: "5-star", price_estimate: 290 },
    { name: "Keqing",   rarity_tier: "super_rare", rarity: "4-star", price_estimate: 45 },
    { name: "Kazuha",   rarity_tier: "ultra_rare", rarity: "5-star", price_estimate: 210 },
    { name: "Fischl",   rarity_tier: "super_rare", rarity: "4-star", price_estimate: 35 },
    { name: "Zhongli",  rarity_tier: "ultra_rare", rarity: "5-star", price_estimate: 310 },
  ];

  return (
    <motion.div className="modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="friend-modal"
        initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 28 }} transition={{ duration: 0.28 }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="friend-modal-hdr">
          <div className="user-card-avatar">{user.username[0].toUpperCase()}</div>
          <div>
            <h2>{user.username}'s Collection</h2>
            <span className="muted">{user.items} items · {user.topCat}</span>
          </div>
        </div>
        <div className="ornament-h" />
        <div className="coll-grid" style={{ padding: "1rem" }}>
          {MOCK_ITEMS.map((item, i) => (
            <OwnedCard key={item.name} item={item} index={i} onClick={() => {}} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   TRADES VIEW
───────────────────────────────────────── */
function TradesView({ apiBase, pushToast, collections, username }) {
  const [tab, setTab]           = useState("incoming");
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  const [tradeForm, setTradeForm] = useState({
    targetUser: "", offerType: "item", offerItem: "", offerMoney: "",
    wantItem: "", note: "",
  });
  const [sendingTrade, setSendingTrade] = useState(false);

  // Fetch trades on mount and when tab changes
  const fetchTrades = async () => {
    setLoadingTrades(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
      
      const [inRes, outRes] = await Promise.all([
        fetch(`${apiBase}/trades/incoming`, { headers }),
        fetch(`${apiBase}/trades/outgoing`, { headers }),
      ]);
      
      if (inRes.status === 401 || outRes.status === 401) return;
      
      const inData = await inRes.json();
      const outData = await outRes.json();
      
      setIncoming(inData.trades || []);
      setOutgoing(outData.trades || []);
    } catch (e) {
      pushToast("Could not load trades", "error");
    } finally {
      setLoadingTrades(false);
    }
  };

  useEffect(() => { fetchTrades(); }, []);

  const sendTrade = async () => {
    if (!tradeForm.targetUser || !tradeForm.wantItem) {
      pushToast("Fill in target user and desired item", "error"); return;
    }
    setSendingTrade(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
      const res = await fetch(`${apiBase}/trades/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          target_user: tradeForm.targetUser,
          offer_type: tradeForm.offerType,
          offer_item: tradeForm.offerItem || undefined,
          offer_money: tradeForm.offerMoney ? parseFloat(tradeForm.offerMoney) : undefined,
          want_item: tradeForm.wantItem,
          note: tradeForm.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { pushToast(data.detail || "Failed to send trade", "error"); return; }
      pushToast(`Trade request sent to ${tradeForm.targetUser}!`, "success");
      setTab("outgoing");
      setTradeForm({ targetUser: "", offerType: "item", offerItem: "", offerMoney: "", wantItem: "", note: "" });
      fetchTrades();
    } catch {
      pushToast("Could not send trade request", "error");
    } finally {
      setSendingTrade(false);
    }
  };

  const acceptTrade = async (tradeId) => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
      const res = await fetch(`${apiBase}/trades/${tradeId}/accept`, { method: "PATCH", headers });
      if (!res.ok) throw new Error();
      pushToast("Trade accepted!", "success");
      fetchTrades();
    } catch {
      pushToast("Could not accept trade", "error");
    }
  };

  const declineTrade = async (tradeId) => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
      const res = await fetch(`${apiBase}/trades/${tradeId}/decline`, { method: "PATCH", headers });
      if (!res.ok) throw new Error();
      pushToast("Trade declined", "info");
      fetchTrades();
    } catch {
      pushToast("Could not decline trade", "error");
    }
  };

  const cancelTrade = async (tradeId) => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
      const res = await fetch(`${apiBase}/trades/${tradeId}/cancel`, { method: "PATCH", headers });
      if (!res.ok) throw new Error();
      pushToast("Trade request cancelled", "info");
      fetchTrades();
    } catch {
      pushToast("Could not cancel trade", "error");
    }
  };

  return (
    <motion.div className="view trades-view"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.28 }}>

      <div className="view-hdr">
        <h1>Trades</h1>
        <p className="muted">Exchange physical items with other collectors</p>
      </div>

      <div className="tab-row">
        {[["incoming","Incoming"], ["outgoing","Outgoing"], ["new","New Trade"]].map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
            {id === "incoming" && incoming.length > 0 && (
              <span className="tab-badge">{incoming.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "incoming" && (
        <div className="trades-list">
          {loadingTrades ? (
            <p className="muted">Loading trades...</p>
          ) : incoming.length === 0 ? (
            <p className="muted">No incoming trade requests.</p>
          ) : (
            incoming.map(t => (
              <motion.div key={t.id} className="trade-card"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="trade-card-from">
                  <div className="user-card-avatar user-card-avatar--sm">{t.from_user[0].toUpperCase()}</div>
                  <span><strong>{t.from_user}</strong> wants to trade</span>
                  <span className={`trade-status trade-status--${t.status}`}>{t.status}</span>
                </div>
                <div className="trade-items-row">
                  <div className="trade-item-box trade-item-box--offer">
                    <span className="trade-item-label">They offer</span>
                    <span className="trade-item-name">
                      {t.offer.offer_type === "money" ? `$${t.offer.money_amount}` : t.offer.item_name}
                    </span>
                  </div>
                  <div className="trade-arrow">⇌</div>
                  <div className="trade-item-box trade-item-box--want">
                    <span className="trade-item-label">They want</span>
                    <span className="trade-item-name">{t.wants}</span>
                  </div>
                </div>
                {t.note && <p className="trade-note">"{t.note}"</p>}
                <div className="trade-actions">
                  <button className="btn-gold btn-sm" onClick={() => acceptTrade(t.id)}>Accept</button>
                  <button className="btn-outline btn-sm" onClick={() => declineTrade(t.id)}>Decline</button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === "outgoing" && (
        <div className="trades-list">
          {loadingTrades ? (
            <p className="muted">Loading trades...</p>
          ) : outgoing.length === 0 ? (
            <p className="muted">No outgoing trade requests.</p>
          ) : (
            outgoing.map(t => (
              <motion.div key={t.id} className="trade-card"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="trade-card-from">
                  <div className="user-card-avatar user-card-avatar--sm">{t.to_user[0].toUpperCase()}</div>
                  <span>Trade request to <strong>{t.to_user}</strong></span>
                  <span className={`trade-status trade-status--${t.status}`}>{t.status}</span>
                </div>
                <div className="trade-items-row">
                  <div className="trade-item-box trade-item-box--offer">
                    <span className="trade-item-label">You offer</span>
                    <span className="trade-item-name">
                      {t.offer.offer_type === "money" ? `$${t.offer.money_amount}` : t.offer.item_name}
                    </span>
                  </div>
                  <div className="trade-arrow">⇌</div>
                  <div className="trade-item-box trade-item-box--want">
                    <span className="trade-item-label">You want</span>
                    <span className="trade-item-name">{t.wants}</span>
                  </div>
                </div>
                <div className="trade-actions">
                  <button className="btn-ghost btn-sm" onClick={() => cancelTrade(t.id)}>
                    Cancel Request
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === "new" && (
        <div className="new-trade-form">
          <h3>Send a Trade Request</h3>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>
            Propose an item swap or cash offer to another collector
          </p>

          <div className="form-field">
            <label>Target User</label>
            <input className="form-input" placeholder="Their username"
              value={tradeForm.targetUser}
              onChange={e => setTradeForm(p => ({ ...p, targetUser: e.target.value }))} />
          </div>

          <div className="form-field">
            <label>Item You Want</label>
            <input className="form-input" placeholder="e.g. Hu Tao Figure (Mint)"
              value={tradeForm.wantItem}
              onChange={e => setTradeForm(p => ({ ...p, wantItem: e.target.value }))} />
          </div>

          <div className="form-field">
            <label>What You're Offering</label>
            <div className="offer-type-row">
              <button className={`offer-type-btn ${tradeForm.offerType === "item" ? "active" : ""}`}
                onClick={() => setTradeForm(p => ({ ...p, offerType: "item" }))}>
                From My Collection
              </button>
              <button className={`offer-type-btn ${tradeForm.offerType === "money" ? "active" : ""}`}
                onClick={() => setTradeForm(p => ({ ...p, offerType: "money" }))}>
                Cash Offer
              </button>
            </div>
            {tradeForm.offerType === "item" ? (
              <input className="form-input" placeholder="e.g. Lugia PSA 10"
                value={tradeForm.offerItem}
                onChange={e => setTradeForm(p => ({ ...p, offerItem: e.target.value }))} />
            ) : (
              <div className="money-input-wrap">
                <span className="money-prefix">$</span>
                <input className="form-input money-input" placeholder="0.00" type="number" min="0"
                  value={tradeForm.offerMoney}
                  onChange={e => setTradeForm(p => ({ ...p, offerMoney: e.target.value }))} />
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Note (optional)</label>
            <textarea className="form-input form-textarea" rows={3}
              placeholder="Add context for your trade request…"
              value={tradeForm.note}
              onChange={e => setTradeForm(p => ({ ...p, note: e.target.value }))} />
          </div>

          <button className="btn-gold" onClick={sendTrade} disabled={sendingTrade}>
            {sendingTrade ? "Sending…" : "Send Trade Request →"}
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   AUTH SCREEN
───────────────────────────────────────── */
function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState("login");
  const [username, setUname]  = useState("");
  const [password, setPw]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!username.trim() || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Something went wrong."); return; }
      saveAuth(data.token, data.username);
      onAuth(data.username);
    } catch { setError("Could not reach the server."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-root">
      <div className="auth-art-panel">
        <svg className="auth-hex-bg" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(28)].map((_, i) => {
            const col = i % 4, row = Math.floor(i / 4);
            const x = col * 140 + (row % 2 === 1 ? 70 : 0) - 20;
            const y = row * 120 - 30;
            return (
              <polygon key={i} points="60,0 120,35 120,105 60,140 0,105 0,35"
                transform={`translate(${x},${y})`}
                fill="none" stroke="rgba(212,175,55,0.07)" strokeWidth="1" />
            );
          })}
        </svg>
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <motion.div className="auth-brand"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ filter: "drop-shadow(0 0 24px rgba(212,175,55,0.3))" }}>
            <polygon points="36,4 68,20 68,52 36,68 4,52 4,20"
              stroke="var(--gold)" strokeWidth="1.5" fill="none"/>
            <polygon points="36,13 59,25 59,47 36,59 13,47 13,25"
              stroke="var(--gold-dim)" strokeWidth="0.75" fill="rgba(212,175,55,0.05)"/>
            <circle cx="36" cy="36" r="9" fill="none" stroke="var(--gold)" strokeWidth="1.5"/>
            <circle cx="36" cy="36" r="4" fill="var(--gold)"/>
          </svg>
          <h1 className="auth-brand-title">Collector<span>達人</span></h1>
          <p className="auth-brand-sub">The definitive vault for anime &amp; trading card collectors</p>
          <div className="auth-feature-pills">
            <span>⊙ AI Recognition</span>
            <span>◈ Collection Tracking</span>
            <span>⇌ Trading</span>
          </div>
        </motion.div>
      </div>

      <div className="auth-form-panel">
        <motion.div className="auth-card"
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>

          <div className="auth-card-hdr">
            <h2>{mode === "login" ? "Welcome back" : "Join the vault"}</h2>
            <p className="muted">{mode === "login" ? "Sign in to your collection" : "Start your collector journey"}</p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}>Log In</button>
            <button className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setError(""); }}>Register</button>
          </div>

          <div className="auth-fields">
            <div className="auth-field">
              <label>Username</label>
              <input className="auth-input" type="text" placeholder="collector_username"
                value={username} onChange={e => setUname(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()} autoFocus />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input className="auth-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="btn-gold auth-submit-btn" onClick={submit} disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Enter the Vault" : "Create Account"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SCANNER
───────────────────────────────────────── */
function Scanner({ onClose, onItemAdded, apiBase, pushToast }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);

  const [phase, setPhase]               = useState("camera");
  const [capturedImg, setCapturedImg]   = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedB64, setCapturedB64]   = useState(null);
  const [result, setResult]             = useState(null);
  const [errorMsg, setErrorMsg]         = useState("");
  const [addMsg, setAddMsg]             = useState("");

  useEffect(() => { startCamera(); return stopCamera; }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setErrorMsg("Camera access denied."); setPhase("error");
    }
  };

  const stopCamera = () => streamRef.current?.getTracks().forEach(t => t.stop());

  const capturePhoto = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setCapturedImg(dataUrl);
    setCapturedB64(dataUrl.split(",")[1]);
    c.toBlob(blob => setCapturedBlob(blob), "image/jpeg", 0.85);
    stopCamera(); setPhase("preview");
  };

  const retake = () => {
    setCapturedImg(null); setCapturedBlob(null); setCapturedB64(null); setResult(null);
    setPhase("camera"); startCamera();
  };

  const identify = async () => {
    if (!capturedBlob) return;
    setPhase("identifying");
    try {
      const fd = new FormData();
      fd.append("file", capturedBlob, "capture.jpg");
      const res = await fetch(`${apiBase}/identify/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Failed"); }
      setResult(await res.json()); setPhase("result");
    } catch (e) { setErrorMsg(e.message || "Identification failed."); setPhase("error"); }
  };

  const addToCollection = async () => {
    if (!result) return;
    setPhase("adding");
    try {
      const res = await fetch(`${apiBase}/collection/add`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          category: result.category, name: result.name,
          description: result.description, confidence: result.confidence,
          rarity: result.rarity, rarity_tier: result.rarity_tier,
          price_estimate: result.price_estimate, price_note: result.price_note,
          image_data: capturedB64, metadata: result.metadata,
        }),
      });
      const data = await res.json();
      setAddMsg(data.message); setPhase("done"); onItemAdded();
    } catch { setErrorMsg("Failed to add to collection."); setPhase("error"); }
  };

  return (
    <motion.div className="scanner"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="scanner-inner">
        {phase === "camera" && (
          <div className="scanner-view">
            <div className="scanner-frame-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="scanner-video" />
              <div className="scanner-corners">
                <span /><span /><span /><span />
              </div>
            </div>
            <p className="scanner-hint">Point at a figure, card, or game</p>
            <div className="scanner-actions">
              <button className="scanner-capture-btn" onClick={capturePhoto}>⊙ Capture</button>
              <button className="scanner-cancel-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="scanner-view">
            <img src={capturedImg} alt="Preview" className="scanner-preview-img" />
            <p className="scanner-hint">Does this look good?</p>
            <div className="scanner-actions">
              <button className="btn-gold" onClick={identify}>Identify Item</button>
              <button className="scanner-cancel-btn" onClick={retake}>Retake</button>
            </div>
          </div>
        )}

        {(phase === "identifying" || phase === "adding") && (
          <div className="scanner-view scanner-view--center">
            <motion.div className="scanner-spinner"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} />
            <p className="scanner-hint">
              {phase === "identifying" ? "Asking Gemini AI…" : "Adding to vault…"}
            </p>
          </div>
        )}

        {phase === "result" && result && (
          <div className="scanner-view scanner-result-view">
            <img src={capturedImg} alt="Captured" className="scanner-result-thumb" />
            <div className="result-card">
              <span className="result-badge" style={{
                background: `${RARITY_COLORS[result.rarity_tier] ?? "#444"}22`,
                color: RARITY_COLORS[result.rarity_tier] ?? "#aaa",
                borderColor: `${RARITY_COLORS[result.rarity_tier] ?? "#444"}55`,
              }}>
                {result.display_name}
              </span>
              <h2 className="result-name">{result.name}</h2>
              {result.description && <p className="result-desc">{result.description}</p>}
              <div className="result-stats">
                <div className="result-stat">
                  <span className="result-stat-label">Total in existence</span>
                  <span className="result-stat-val">{result.total_in_existence.toLocaleString()}</span>
                </div>
                <div className="result-stat">
                  <span className="result-stat-label">Confidence</span>
                  <span className="result-stat-val">{Math.round(result.confidence * 100)}%</span>
                </div>
                {result.rarity && (
                  <div className="result-stat">
                    <span className="result-stat-label">Rarity</span>
                    <span className="result-stat-val" style={{ color: RARITY_COLORS[result.rarity_tier] ?? "#aaa" }}>
                      {result.rarity}
                    </span>
                  </div>
                )}
                {result.price_estimate != null && (
                  <div className="result-stat">
                    <span className="result-stat-label">Est. Value</span>
                    <span className="result-stat-val gold">${result.price_estimate.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {result.metadata && Object.keys(result.metadata).length > 0 && (
                <div className="result-meta">
                  {Object.entries(result.metadata).map(([k, v]) => (
                    <span key={k} className="meta-tag">{k}: {v}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="scanner-actions">
              <button className="btn-gold" onClick={addToCollection}>Add to Vault</button>
              <button className="scanner-cancel-btn" onClick={retake}>Retake</button>
              <button className="scanner-cancel-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="scanner-view scanner-view--center">
            <motion.div className="scanner-done-icon"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220 }}>✓</motion.div>
            <p className="scanner-hint">{addMsg}</p>
            <div className="scanner-actions">
              <button className="btn-gold" onClick={retake}>Scan Another</button>
              <button className="scanner-cancel-btn" onClick={onClose}>Done</button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="scanner-view scanner-view--center">
            <p className="scanner-error">⚠ {errorMsg}</p>
            <div className="scanner-actions">
              <button className="btn-gold" onClick={retake}>Try Again</button>
              <button className="scanner-cancel-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   SHARED: CONFIRM DIALOG
───────────────────────────────────────── */
function ConfirmDialog({ title, body, onCancel, onConfirm, loading }) {
  return (
    <motion.div className="modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <motion.div className="confirm-dialog"
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.2 }}>
        <h3>{title}</h3>
        <p className="muted">{body}</p>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
