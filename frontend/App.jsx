import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* =========================
   CONFIG
========================= */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* =========================
   HERO TEXT ROTATION
========================= */

const phrases = [
  "Scan your collection instantly",
  "Track every game, figure & card",
  "Build your ultimate archive"
];

/* =========================
   MAIN APP
========================= */

export default function App() {
  const [index, setIndex] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const res = await fetch(`${API_BASE}/collection/`);
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (err) {
      console.error("Failed to load collections:", err);
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleItemAdded = () => {
    fetchCollections();
  };

  return (
    <>
      <Navbar onBrowse={() => setBrowsing(true)} hasCollections={collections.length > 0} />

      <div className="container">
        {/* HERO */}
        <section className="hero">
          <h1>Collector</h1>
          <motion.h2
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {phrases[index]}
          </motion.h2>

          <div className="hero-actions">
            <button className="cta" onClick={() => setScanning(true)}>
              Scan Item
            </button>
            {collections.length > 0 && (
              <button className="cta cta--outline" onClick={() => setBrowsing(true)}>
                View Collections
              </button>
            )}
          </div>
        </section>

        {/* FEATURES */}
        <Section
          title="Scan Anything"
          text="Use your camera to instantly recognize games, gacha characters, figurines, and trading cards."
        />
        <Section
          title="AI-Powered Lookup"
          text="Gemini identifies your item and searches the web to find exactly how many exist in the world."
        />
        <Section
          title="Track Your Progress"
          text="Watch your completion percentage climb as you build toward owning every item in a category."
        />

        {/* COLLECTIONS SUMMARY */}
        <section className="section">
          <h3>Your Collections</h3>

          {loadingCollections ? (
            <p style={{ color: "#777", marginTop: "20px" }}>Loading...</p>
          ) : collections.length === 0 ? (
            <p style={{ color: "#777", marginTop: "20px" }}>
              No items yet — scan something to get started!
            </p>
          ) : (
            <div className="collections-grid">
              {collections.map((col) => (
                <CollectionCard
                  key={col.category}
                  collection={col}
                  onClick={() => setBrowsing(true)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* SCANNER OVERLAY */}
      <AnimatePresence>
        {scanning && (
          <Scanner
            onClose={() => setScanning(false)}
            onItemAdded={handleItemAdded}
          />
        )}
      </AnimatePresence>

      {/* COLLECTION BROWSER OVERLAY */}
      <AnimatePresence>
        {browsing && (
          <CollectionBrowser
            onClose={() => setBrowsing(false)}
            collections={collections}
            apiBase={API_BASE}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* =========================
   COLLECTION BROWSER
========================= */

function CollectionBrowser({ onClose, collections, apiBase }) {
  const [selectedCategory, setSelectedCategory] = useState(
    collections.length > 0 ? collections[0].category : null
  );
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchDetail = useCallback(async (category) => {
    setLoadingDetail(true);
    setDetailData(null);
    try {
      const res = await fetch(`${apiBase}/collection/${category}`);
      const data = await res.json();
      setDetailData(data);
    } catch (err) {
      console.error("Failed to fetch collection detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (selectedCategory) fetchDetail(selectedCategory);
  }, [selectedCategory, fetchDetail]);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const selectedMeta = collections.find(c => c.category === selectedCategory);

  return (
    <motion.div
      className="browser-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={handleBackdrop}
    >
      <motion.div
        className="browser-modal"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* MODAL HEADER */}
        <div className="browser-header">
          <div>
            <h2 className="browser-title">Collections</h2>
            <p className="browser-subtitle">Select a category to browse your progress</p>
          </div>
          <button className="browser-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="browser-body">
          {/* SIDEBAR */}
          <div className="browser-sidebar">
            {collections.map((col) => (
              <button
                key={col.category}
                className={`browser-cat-btn ${selectedCategory === col.category ? "active" : ""}`}
                onClick={() => setSelectedCategory(col.category)}
              >
                <span className="browser-cat-name">{col.display_name}</span>
                <span className="browser-cat-count">
                  {col.owned_count}/{col.total_count}
                </span>
                <div className="browser-cat-bar">
                  <div
                    className="browser-cat-fill"
                    style={{ width: `${col.progress_percent}%` }}
                  />
                </div>
              </button>
            ))}
          </div>

          {/* MAIN CONTENT */}
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
                <div className="browser-progress-ring-wrap">
                  <ProgressRing
                    percent={selectedMeta.progress_percent}
                    owned={selectedMeta.owned_count}
                    total={selectedMeta.total_count}
                  />
                </div>
              </div>
            )}

            {loadingDetail ? (
              <div className="browser-loading">
                <motion.div
                  className="spinner"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
                <p>Loading collection…</p>
              </div>
            ) : detailData ? (
              <CollectionGrid detail={detailData} />
            ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =========================
   PROGRESS RING
========================= */

function ProgressRing({ percent, owned, total }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <svg className="progress-ring" viewBox="0 0 88 88" width="88" height="88">
      <circle cx="44" cy="44" r={r} className="ring-track" />
      <motion.circle
        cx="44" cy="44" r={r}
        className="ring-fill"
        strokeDasharray={circ}
        strokeDashoffset={circ}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        style={{ transformOrigin: "44px 44px", rotate: "-90deg" }}
      />
      <text x="44" y="40" className="ring-text-big" textAnchor="middle" dominantBaseline="middle">
        {Math.round(percent)}%
      </text>
      <text x="44" y="55" className="ring-text-small" textAnchor="middle">
        {owned}/{total}
      </text>
    </svg>
  );
}

/* =========================
   COLLECTION GRID
========================= */

function CollectionGrid({ detail }) {
  const { items, total_count, owned_count } = detail;
  const ownedNames = new Set(items.map(i => i.name.toLowerCase()));

  // Build grid: owned items first, then placeholders
  const ownedItems = items;
  const placeholderCount = Math.max(0, total_count - owned_count);

  return (
    <div className="coll-grid-wrap">
      <div className="coll-grid">
        {ownedItems.map((item, i) => (
          <motion.div
            key={item._id || item.name}
            className="coll-item owned"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
          >
            <div className="coll-item-inner">
              <div className="coll-item-icon">✓</div>
              <p className="coll-item-name">{item.name}</p>
              {item.metadata && Object.keys(item.metadata).length > 0 && (
                <p className="coll-item-meta">
                  {Object.entries(item.metadata).slice(0, 1).map(([k, v]) => `${v}`).join(" · ")}
                </p>
              )}
            </div>
          </motion.div>
        ))}

        {Array.from({ length: placeholderCount }).map((_, i) => (
          <motion.div
            key={`ph-${i}`}
            className="coll-item placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: Math.min(ownedItems.length * 0.03 + i * 0.01, 0.6) }}
          >
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

/* =========================
   COLLECTION CARD
========================= */

function CollectionCard({ collection, onClick }) {
  const { display_name, owned_count, total_count, progress_percent } = collection;

  return (
    <motion.div
      className="collection-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      whileHover={{ y: -3 }}
    >
      <h4>{display_name}</h4>
      <p className="collection-count">
        {owned_count} <span>/ {total_count}</span>
      </p>

      <div className="progress-bar-track">
        <motion.div
          className="progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress_percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <p className="progress-label">{progress_percent}% complete</p>
    </motion.div>
  );
}

/* =========================
   SCANNER OVERLAY
========================= */

function Scanner({ onClose, onItemAdded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState("camera");
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [addMsg, setAddMsg] = useState("");

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMsg("Camera access denied. Please allow camera permissions.");
      setPhase("error");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);

    canvas.toBlob((blob) => {
      setCapturedBlob(blob);
    }, "image/jpeg", 0.9);

    stopCamera();
    setPhase("preview");
  };

  const retake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setResult(null);
    setPhase("camera");
    startCamera();
  };

  const identify = async () => {
    if (!capturedBlob) return;
    setPhase("identifying");

    try {
      const formData = new FormData();
      formData.append("file", capturedBlob, "capture.jpg");

      const res = await fetch(`${API_BASE}/identify/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Identification failed");
      }

      const data = await res.json();
      setResult(data);
      setPhase("result");
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
      setPhase("error");
    }
  };

  const addToCollection = async () => {
    if (!result) return;
    setPhase("adding");

    try {
      const res = await fetch(`${API_BASE}/collection/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: result.category,
          name: result.name,
          description: result.description,
          confidence: result.confidence,
          metadata: result.metadata,
        }),
      });

      const data = await res.json();
      setAddMsg(data.message);
      setPhase("done");
      onItemAdded();
    } catch (err) {
      setErrorMsg("Failed to add to collection.");
      setPhase("error");
    }
  };

  return (
    <motion.div
      className="scanner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {phase === "camera" && (
        <div className="scanner-camera-view">
          <video ref={videoRef} autoPlay playsInline muted className="scanner-video" />
          <div className="scanner-frame" />
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
          <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
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
          <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
          <p className="scanner-hint">Adding to collection...</p>
        </div>
      )}

      {phase === "done" && (
        <div className="scanner-result-view">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="done-icon">✓</motion.div>
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

/* =========================
   NAVBAR
========================= */

function Navbar({ onBrowse, hasCollections }) {
  return (
    <div className="navbar">
      <strong>Collector</strong>
      {hasCollections && (
        <button className="navbar-browse-btn" onClick={onBrowse}>
          Browse Collections
        </button>
      )}
    </div>
  );
}

/* =========================
   ANIMATED SECTION
========================= */

function Section({ title, text }) {
  return (
    <motion.section
      className="section"
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.section>
  );
}
