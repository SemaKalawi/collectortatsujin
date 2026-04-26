import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const phrases = [
  "Scan your collection instantly",
  "Track every game, figure & card",
  "Build your ultimate archive"
];

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
  common: "#999",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  super_rare: "#c084fc",
  ultra_rare: "#f97316",
  legendary: "#d4ff00",
  unknown: "#444",
};

/* =========================
   AUTH HELPERS
========================= */

function getToken() { return localStorage.getItem("ct_token"); }
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

/* =========================
   AUTH SCREEN
========================= */

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <motion.div className="auth-card"
        initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>

        <h1 className="auth-logo">Collector</h1>
        <p className="auth-tagline">Your personal collection tracker</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); }}>Log In</button>
          <button className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => { setMode("register"); setError(""); }}>Register</button>
        </div>

        <div className="auth-fields">
          <input
            className="auth-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            autoFocus
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="cta auth-submit" onClick={submit} disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
        </button>
      </motion.div>
    </div>
  );
}

/* =========================
   MAIN APP
========================= */

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [username, setUsername] = useState(getUsername() || "");
  const [index, setIndex] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  const handleAuth = (uname) => { setUsername(uname); setAuthed(true); };
  const handleLogout = () => { clearAuth(); setAuthed(false); setUsername(""); setCollections([]); };

  useEffect(() => {
    const iv = setInterval(() => setIndex(p => (p + 1) % phrases.length), 2500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { if (authed) fetchCollections(); }, [authed]);

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const res = await fetch(`${API_BASE}/collection/`, { headers: authHeaders() });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (e) { console.error(e); }
    finally { setLoadingCollections(false); }
  };

  if (!authed) return <AuthScreen onAuth={handleAuth} />;

  return (
    <>
      <Navbar onBrowse={() => setBrowsing(true)} hasCollections={collections.length > 0}
        username={username} onLogout={handleLogout} />
      <div className="container">
        <section className="hero">
          <h1>Collector</h1>
          <motion.h2 key={index}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}>
            {phrases[index]}
          </motion.h2>
          <div className="hero-actions">
            <button className="cta" onClick={() => setScanning(true)}>Scan Item</button>
            {collections.length > 0 && (
              <button className="cta cta--outline" onClick={() => setBrowsing(true)}>
                View Collections
              </button>
            )}
          </div>
        </section>

        <Section title="Scan Anything" text="Use your camera to instantly recognize games, gacha characters, figurines, and trading cards." />
        <Section title="AI-Powered Lookup" text="Gemini identifies your item and searches the web to find exactly how many exist in the world." />
        <Section title="Track Your Progress" text="Watch your completion percentage climb as you build toward owning every item in a category." />

        <section className="section">
          <h3>Your Collections</h3>
          {loadingCollections ? (
            <p style={{ color: "#777", marginTop: "20px" }}>Loading...</p>
          ) : collections.length === 0 ? (
            <p style={{ color: "#777", marginTop: "20px" }}>No items yet — scan something to get started!</p>
          ) : (
            <div className="collections-grid">
              {collections.map(col => (
                <CollectionCard key={col.category} collection={col} onClick={() => setBrowsing(true)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {scanning && <Scanner onClose={() => setScanning(false)} onItemAdded={fetchCollections} />}
      </AnimatePresence>
      <AnimatePresence>
        {browsing && (
          <CollectionBrowser onClose={() => setBrowsing(false)} collections={collections}
            apiBase={API_BASE} onCollectionDeleted={fetchCollections} />
        )}
      </AnimatePresence>
    </>
  );
}

/* =========================
   COLLECTION BROWSER
========================= */

const SORT_OPTIONS = [
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
    default:            return arr;
  }
}

function CollectionBrowser({ onClose, collections, apiBase, onCollectionDeleted }) {
  const [selectedCategory, setSelectedCategory] = useState(collections[0]?.category ?? null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sortMode, setSortMode] = useState("recent");
  const [selectedItem, setSelectedItem] = useState(null);
  const [localCollections, setLocalCollections] = useState(collections);
  const [confirmDelete, setConfirmDelete] = useState(null); // category string
  const [deleting, setDeleting] = useState(false);

  const fetchDetail = useCallback(async (category) => {
    setLoadingDetail(true); setDetailData(null);
    try {
      const res = await fetch(`${apiBase}/collection/${category}`, { headers: authHeaders() });
      setDetailData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingDetail(false); }
  }, [apiBase]);

  useEffect(() => { if (selectedCategory) fetchDetail(selectedCategory); }, [selectedCategory, fetchDetail]);

  const handleDeleteCollection = async (category) => {
    setDeleting(true);
    try {
      await fetch(`${apiBase}/collection/${category}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const updated = localCollections.filter(c => c.category !== category);
      setLocalCollections(updated);
      onCollectionDeleted();
      if (selectedCategory === category) {
        setSelectedCategory(updated[0]?.category ?? null);
        setDetailData(null);
      }
    } catch (e) { console.error(e); }
    finally { setDeleting(false); setConfirmDelete(null); }
  };

  const selectedMeta = localCollections.find(c => c.category === selectedCategory);

  return (
    <motion.div className="browser-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div className="browser-modal"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>

        <div className="browser-header">
          <div>
            <h2 className="browser-title">Collections</h2>
            <p className="browser-subtitle">Select a category to browse your progress</p>
          </div>
          <button className="browser-close" onClick={onClose}>✕</button>
        </div>

        <div className="browser-body">
          <div className="browser-sidebar">
            {localCollections.length === 0 && (
              <p style={{ color: "#555", fontSize: "0.8rem", padding: "8px" }}>No collections yet.</p>
            )}
            {localCollections.map(col => (
              <div key={col.category} className="browser-cat-item">
                <button
                  className={`browser-cat-btn ${selectedCategory === col.category ? "active" : ""}`}
                  onClick={() => setSelectedCategory(col.category)}>
                  <span className="browser-cat-name">{col.display_name}</span>
                  <span className="browser-cat-count">{col.owned_count}/{col.total_count}</span>
                  <div className="browser-cat-bar">
                    <div className="browser-cat-fill" style={{ width: `${col.progress_percent}%` }} />
                  </div>
                </button>
                <button
                  className="browser-cat-delete"
                  title={`Delete ${col.display_name} collection`}
                  onClick={() => setConfirmDelete(col.category)}>
                  🗑
                </button>
              </div>
            ))}
          </div>

          <div className="browser-content">
            {selectedMeta && (
              <div className="browser-collection-header">
                <div>
                  <h3 className="browser-collection-name">{selectedMeta.display_name}</h3>
                  <p className="browser-collection-stats">
                    <span className="stat-accent">{selectedMeta.owned_count}</span>
                    <span className="stat-sep"> of </span>
                    <span className="stat-accent">{selectedMeta.total_count}</span>
                    <span className="stat-sep"> collected — </span>
                    <span className="stat-accent">{selectedMeta.progress_percent}%</span>
                  </p>
                </div>
                <ProgressRing percent={selectedMeta.progress_percent}
                  owned={selectedMeta.owned_count} total={selectedMeta.total_count} />
              </div>
            )}

            {detailData && detailData.items.length > 0 && (
              <div className="sort-bar">
                <span className="sort-label">Sort</span>
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.key}
                    className={`sort-btn ${sortMode === opt.key ? "active" : ""}`}
                    onClick={() => setSortMode(opt.key)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {loadingDetail ? (
              <div className="browser-loading">
                <motion.div className="spinner" animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
                <p>Loading collection…</p>
              </div>
            ) : detailData ? (
              <CollectionGrid detail={detailData} sortMode={sortMode} onSelectItem={setSelectedItem} />
            ) : localCollections.length === 0 ? (
              <div className="browser-loading"><p style={{ color: "#555" }}>All collections deleted.</p></div>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div className="confirm-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
            <motion.div className="confirm-dialog"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}>
              <h3 className="confirm-title">Delete collection?</h3>
              <p className="confirm-body">
                This will permanently remove all <strong style={{ color: "#f0f0f0" }}>
                  {localCollections.find(c => c.category === confirmDelete)?.display_name}
                </strong> items from your collection. This cannot be undone.
              </p>
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                  Cancel
                </button>
                <button className="confirm-delete" onClick={() => handleDeleteCollection(confirmDelete)} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
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

/* =========================
   ITEM DETAIL MODAL
========================= */

function ItemDetailModal({ item, onClose }) {
  const [imageExpanded, setImageExpanded] = useState(false);
  const rarityColor = RARITY_COLORS[item.rarity_tier] ?? "#aaa";
  const rarityLabel = RARITY_LABELS[item.rarity_tier] ?? "—";

  const formattedDate = item.added_at
    ? new Date(item.added_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown";

  return (
    <motion.div className="item-modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="item-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>

        <button className="item-modal-close" onClick={onClose}>✕</button>

        <div className="item-modal-body">
          <div className="item-modal-img-wrap">
            {item.image_data ? (
              <>
                <img
                  src={`data:image/jpeg;base64,${item.image_data}`}
                  alt={item.name}
                  className="item-modal-img"
                  onClick={() => setImageExpanded(true)}
                  title="Click to view full image"
                />
                <div className="item-modal-img-hint">click to enlarge</div>
              </>
            ) : (
              <div className="item-modal-img-placeholder"><span>?</span></div>
            )}
            {item.rarity_tier && item.rarity_tier !== "unknown" && (
              <span className="item-modal-rarity-badge"
                style={{ background: rarityColor + "22", color: rarityColor, borderColor: rarityColor + "55" }}>
                {item.rarity || rarityLabel}
              </span>
            )}
          </div>

          <div className="item-modal-info">
            <h2 className="item-modal-name">{item.name}</h2>
            {item.description && <p className="item-modal-desc">{item.description}</p>}

            <div className="item-modal-stats">
              {item.rarity_tier && item.rarity_tier !== "unknown" && (
                <div className="item-stat-row">
                  <span className="item-stat-label">Rarity</span>
                  <span className="item-stat-value" style={{ color: rarityColor }}>
                    {item.rarity || rarityLabel}
                  </span>
                </div>
              )}
              {item.price_estimate != null && (
                <div className="item-stat-row">
                  <span className="item-stat-label">Est. Value</span>
                  <span className="item-stat-value" style={{ color: "var(--accent)" }}>
                    ${item.price_estimate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {item.price_note && <span className="item-stat-note">{item.price_note}</span>}
                  </span>
                </div>
              )}
              <div className="item-stat-row">
                <span className="item-stat-label">Collected</span>
                <span className="item-stat-value">{formattedDate}</span>
              </div>
              {item.confidence != null && (
                <div className="item-stat-row">
                  <span className="item-stat-label">AI Confidence</span>
                  <span className="item-stat-value">{Math.round(item.confidence * 100)}%</span>
                </div>
              )}
            </div>

            {item.metadata && Object.keys(item.metadata).length > 0 && (
              <div className="item-modal-meta">
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

      {/* Full-size image lightbox */}
      <AnimatePresence>
        {imageExpanded && (
          <motion.div className="lightbox"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setImageExpanded(false)}>
            <motion.img
              src={`data:image/jpeg;base64,${item.image_data}`}
              alt={item.name}
              className="lightbox-img"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
            />
            <button className="lightbox-close" onClick={() => setImageExpanded(false)}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* =========================
   PROGRESS RING
========================= */

function ProgressRing({ percent, owned, total }) {
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <svg className="progress-ring" viewBox="0 0 88 88" width="88" height="88">
      <circle cx="44" cy="44" r={r} className="ring-track" />
      <motion.circle cx="44" cy="44" r={r} className="ring-fill"
        strokeDasharray={circ} strokeDashoffset={circ}
        animate={{ strokeDashoffset: circ - (percent / 100) * circ }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        style={{ transformOrigin: "44px 44px", rotate: "-90deg" }} />
      <text x="44" y="40" className="ring-text-big" textAnchor="middle" dominantBaseline="middle">
        {Math.round(percent)}%
      </text>
      <text x="44" y="55" className="ring-text-small" textAnchor="middle">{owned}/{total}</text>
    </svg>
  );
}

/* =========================
   COLLECTION GRID
========================= */

function CollectionGrid({ detail, sortMode, onSelectItem }) {
  const { items, total_count, owned_count } = detail;
  const sorted = sortItems(items, sortMode);
  const placeholderCount = Math.max(0, total_count - owned_count);

  return (
    <div className="coll-grid-wrap">
      <div className="coll-grid">
        {sorted.map((item, i) => (
          <OwnedCard key={item._id || item.name} item={item} index={i} onClick={() => onSelectItem(item)} />
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <motion.div key={`ph-${i}`} className="coll-item placeholder"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: Math.min(sorted.length * 0.02 + i * 0.008, 0.5) }}>
            <div className="coll-item-inner">
              <div className="coll-item-icon ph-icon">?</div>
              <p className="coll-item-name ph-name">???</p>
            </div>
          </motion.div>
        ))}
      </div>
      {placeholderCount > 0 && (
        <p className="coll-grid-footer">
          {placeholderCount} item{placeholderCount !== 1 ? "s" : ""} still to discover
        </p>
      )}
    </div>
  );
}

function OwnedCard({ item, index, onClick }) {
  const rarityColor = RARITY_COLORS[item.rarity_tier] ?? null;
  return (
    <motion.div className="coll-item owned"
      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.025 }}
      whileHover={{ scale: 1.04, transition: { duration: 0.12 } }}
      onClick={onClick}
      style={rarityColor ? { borderColor: rarityColor + "44" } : {}}>
      <div className="coll-item-inner">
        {item.image_data ? (
          <div className="coll-item-img-wrap">
            <img src={`data:image/jpeg;base64,${item.image_data}`}
              alt={item.name} className="coll-item-img" />
          </div>
        ) : (
          <div className="coll-item-icon"
            style={rarityColor ? { borderColor: rarityColor + "55", color: rarityColor } : {}}>
            ✓
          </div>
        )}
        <p className="coll-item-name">{item.name}</p>
        {item.rarity_tier && item.rarity_tier !== "unknown" && (
          <span className="coll-item-rarity" style={{ color: rarityColor }}>
            {item.rarity || RARITY_LABELS[item.rarity_tier]}
          </span>
        )}
        {item.price_estimate != null && (
          <span className="coll-item-price">
            ${item.price_estimate % 1 === 0 ? item.price_estimate : item.price_estimate.toFixed(2)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* =========================
   COLLECTION CARD (hero)
========================= */

function CollectionCard({ collection, onClick }) {
  const { display_name, owned_count, total_count, progress_percent } = collection;
  return (
    <motion.div className="collection-card"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }} onClick={onClick}
      style={{ cursor: "pointer" }} whileHover={{ y: -3 }}>
      <h4>{display_name}</h4>
      <p className="collection-count">{owned_count} <span>/ {total_count}</span></p>
      <div className="progress-bar-track">
        <motion.div className="progress-bar-fill"
          initial={{ width: 0 }} animate={{ width: `${progress_percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }} />
      </div>
      <p className="progress-label">{progress_percent}% complete</p>
    </motion.div>
  );
}

/* =========================
   SCANNER
========================= */

function Scanner({ onClose, onItemAdded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState("camera");
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedBase64, setCapturedBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [addMsg, setAddMsg] = useState("");

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

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
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    setCapturedBase64(dataUrl.split(",")[1]);
    canvas.toBlob(blob => setCapturedBlob(blob), "image/jpeg", 0.85);
    stopCamera(); setPhase("preview");
  };

  const retake = () => {
    setCapturedImage(null); setCapturedBlob(null); setCapturedBase64(null); setResult(null);
    setPhase("camera"); startCamera();
  };

  const identify = async () => {
    if (!capturedBlob) return;
    setPhase("identifying");
    try {
      const fd = new FormData();
      fd.append("file", capturedBlob, "capture.jpg");
      const res = await fetch(`${API_BASE}/identify/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Failed"); }
      setResult(await res.json()); setPhase("result");
    } catch (e) { setErrorMsg(e.message || "Something went wrong."); setPhase("error"); }
  };

  const addToCollection = async () => {
    if (!result) return;
    setPhase("adding");
    try {
      const res = await fetch(`${API_BASE}/collection/add`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          category: result.category, name: result.name,
          description: result.description, confidence: result.confidence,
          rarity: result.rarity, rarity_tier: result.rarity_tier,
          price_estimate: result.price_estimate, price_note: result.price_note,
          image_data: capturedBase64, metadata: result.metadata,
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

      {phase === "camera" && (
        <div className="scanner-camera-view">
          <video ref={videoRef} autoPlay playsInline muted className="scanner-video" />
          <p className="scanner-hint">Point at a game, figure, or card</p>
          <div className="scanner-actions">
            <button className="capture-btn" onClick={capturePhoto}>● Capture</button>
            <button className="close-btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
      {phase === "preview" && (
        <div className="scanner-result-view">
          <p className="scanner-hint">Does this look good?</p>
          <img src={capturedImage} alt="Captured" className="captured-img" />
          <div className="scanner-actions">
            <button className="cta" onClick={identify}>Identify This</button>
            <button className="close-btn" onClick={retake}>Retake</button>
          </div>
        </div>
      )}
      {phase === "identifying" && (
        <div className="scanner-result-view">
          <motion.div className="spinner" animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
          <p className="scanner-hint">Asking Gemini...</p>
        </div>
      )}
      {phase === "result" && result && (
        <div className="scanner-result-view">
          <img src={capturedImage} alt="Captured" className="captured-img captured-img--small" />
          <div className="result-card">
            <span className="result-badge">{result.display_name}</span>
            <h2 className="result-name">{result.name}</h2>
            <p className="result-desc">{result.description}</p>
            <div className="result-stats">
              <div className="result-stat">
                <span className="stat-label">Total in existence</span>
                <span className="stat-value">{result.total_in_existence.toLocaleString()}</span>
              </div>
              <div className="result-stat">
                <span className="stat-label">Confidence</span>
                <span className="stat-value">{Math.round(result.confidence * 100)}%</span>
              </div>
              {result.rarity && (
                <div className="result-stat">
                  <span className="stat-label">Rarity</span>
                  <span className="stat-value" style={{ color: RARITY_COLORS[result.rarity_tier] ?? "#aaa" }}>
                    {result.rarity}
                  </span>
                </div>
              )}
              {result.price_estimate != null && (
                <div className="result-stat">
                  <span className="stat-label">Est. Value</span>
                  <span className="stat-value">${result.price_estimate.toFixed(2)}</span>
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
            <button className="cta" onClick={addToCollection}>Add to Collection</button>
            <button className="close-btn" onClick={retake}>Retake</button>
            <button className="close-btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
      {phase === "adding" && (
        <div className="scanner-result-view">
          <motion.div className="spinner" animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
          <p className="scanner-hint">Adding to collection...</p>
        </div>
      )}
      {phase === "done" && (
        <div className="scanner-result-view">
          <motion.div className="done-icon"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}>✓</motion.div>
          <p className="scanner-hint">{addMsg}</p>
          <div className="scanner-actions">
            <button className="cta" onClick={retake}>Scan Another</button>
            <button className="close-btn" onClick={onClose}>Done</button>
          </div>
        </div>
      )}
      {phase === "error" && (
        <div className="scanner-result-view">
          <p className="error-msg">⚠ {errorMsg}</p>
          <div className="scanner-actions">
            <button className="cta" onClick={retake}>Try Again</button>
            <button className="close-btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Navbar({ onBrowse, hasCollections, username, onLogout }) {
  return (
    <div className="navbar">
      <strong>Collector</strong>
      <div className="navbar-right">
        {hasCollections && (
          <button className="navbar-browse-btn" onClick={onBrowse}>Browse Collections</button>
        )}
        <div className="navbar-user">
          <span className="navbar-username">{username}</span>
          <button className="navbar-logout-btn" onClick={onLogout}>Log Out</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, text }) {
  return (
    <motion.section className="section"
      initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }} viewport={{ once: true }}>
      <h3>{title}</h3><p>{text}</p>
    </motion.section>
  );
}
