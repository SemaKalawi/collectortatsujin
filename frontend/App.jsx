import React, { useEffect, useRef, useState } from "react";
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
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Rotate hero text
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Load collections on mount
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
      <Navbar />

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

          <button className="cta" onClick={() => setScanning(true)}>
            Scan Item
          </button>
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

        {/* COLLECTIONS */}
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
                <CollectionCard key={col.category} collection={col} />
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
    </>
  );
}

/* =========================
   COLLECTION CARD
========================= */

function CollectionCard({ collection }) {
  const { display_name, owned_count, total_count, progress_percent } = collection;

  return (
    <motion.div
      className="collection-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
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

  const [phase, setPhase] = useState("camera"); // camera | preview | identifying | result | adding | done | error
  const [capturedImage, setCapturedImage] = useState(null); // base64 for display
  const [capturedBlob, setCapturedBlob] = useState(null);   // blob for upload
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [addMsg, setAddMsg] = useState("");

  // Start camera
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

    // Convert to blob for upload
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

      {/* CAMERA PHASE */}
      {phase === "camera" && (
        <div className="scanner-camera-view">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="scanner-video"
          />
          <div className="scanner-frame" />
          <p className="scanner-hint">Point at a game, figure, or card</p>
          <div className="scanner-actions">
            <button className="capture-btn" onClick={capturePhoto}>
              ● Capture
            </button>
            <button className="close-btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}

      {/* PREVIEW PHASE */}
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

      {/* IDENTIFYING PHASE */}
      {phase === "identifying" && (
        <div className="scanner-result-view">
          <motion.div
            className="spinner"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <p className="scanner-hint">Asking Gemini...</p>
        </div>
      )}

      {/* RESULT PHASE */}
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
                  <span key={k} className="meta-tag">
                    {k}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="scanner-actions">
            <button className="cta" onClick={addToCollection}>
              Add to Collection
            </button>
            <button className="close-btn" onClick={retake}>Retake</button>
            <button className="close-btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}

      {/* ADDING PHASE */}
      {phase === "adding" && (
        <div className="scanner-result-view">
          <motion.div
            className="spinner"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <p className="scanner-hint">Adding to collection...</p>
        </div>
      )}

      {/* DONE PHASE */}
      {phase === "done" && (
        <div className="scanner-result-view">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="done-icon"
          >
            ✓
          </motion.div>
          <p className="scanner-hint">{addMsg}</p>
          <div className="scanner-actions">
            <button className="cta" onClick={retake}>Scan Another</button>
            <button className="close-btn" onClick={onClose}>Done</button>
          </div>
        </div>
      )}

      {/* ERROR PHASE */}
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

function Navbar() {
  return (
    <div className="navbar">
      <strong>Collector</strong>
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
