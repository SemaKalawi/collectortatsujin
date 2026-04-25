import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";

/* =========================
   HERO TEXT ROTATION
========================= */

const phrases = [
  "Scan your collection instantly",
  "Track value in real time",
  "Build your anime archive"
];

/* =========================
   MAIN APP
========================= */

export default function App() {
  const [index, setIndex] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [collection, setCollection] = useState([]);

  // rotate hero text
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

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
        </section>

        {/* FEATURES */}
        <Section
          title="Scan Anything"
          text="Use your camera to instantly recognize manga, figures, and games."
        />

        <Section
          title="Know the Value"
          text="See real-time pricing pulled from online marketplaces."
        />

        <Section
          title="Track Your Collection"
          text="Organize and view your entire collection in one place."
        />

        {/* TRY IT NOW SECTION */}
        <section className="section">
          <h3>Try It Now</h3>
          
          <button className="cta" onClick={() => setScanning(true)}>
            Scan Item
          </button>

          {collection.length === 0 ? (
            <p style={{ marginTop: "20px" }}>Click above to scan your first item!</p>
          ) : (
            <>
              <div className="grid">
                {collection.map((item, i) => (
                  <div className="card" key={i}>
                    <img src={item.image} alt={item.name} />
                    <h4>{item.name}</h4>
                    <p>${item.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <h4 className="total">
                Total Value: $
                {collection
                  .reduce((sum, item) => sum + item.price, 0)
                  .toFixed(2)}
              </h4>
            </>
          )}
        </section>
      </div>

      {/* SCANNER OVERLAY */}
      {scanning && (
        <Scanner
          onClose={() => setScanning(false)}
          onScan={(item) =>
            setCollection((prev) => [...prev, item])
          }
        />
      )}
    </>
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
   SCANNER (WITH QR CODE)
========================= */

function Scanner({ onClose, onScan }) {
  useEffect(() => {
    const scanner = new Html5Qrcode("reader");

    scanner.start(
      { facingMode: "environment" }, // use back camera
      {
        fps: 5,
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0
      },
      (decodedText) => {
        console.log("Scanned:", decodedText);

        // simulate lookup using barcode
        const item = {
          name: "Scanned Item (" + decodedText + ")",
          price: Math.random() * 50 + 10,
          image: "https://via.placeholder.com/150"
        };

        onScan(item);
        scanner.stop();
        onClose();
      },
      (error) => {
        console.log("Scan error:", error);
      }
    ).catch((err) => {
      console.error("Scanner init error:", err);
    });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="scanner">
      <div id="reader" className="scanner-preview"></div>

      <p>Point your camera at a barcode</p>

      <button className="close-btn" onClick={onClose}>
        Cancel
      </button>
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