import React, { useEffect, useRef, useState } from 'react';

/**
 * React entry point for the original SmartCare prototype.
 *
 * The original prototype was written as three classic browser scripts
 * (qr.js, script.js and chatbot.js). They are loaded after React mounts so
 * their existing global state/router can render inside this React component.
 * This preserves the complete existing UI and behavior while making the
 * application a Vite + React project.
 */
export default function App() {
  const mounted = useRef(false);
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    // Served from /public/legacy so they are copied into the production build.
    // api.js (SmartCare API client) must load before script.js.
    const files = [
      '/legacy/qr.js',
      '/legacy/api.js',
      '/legacy/script.js',
      '/legacy/chatbot.js',
    ];

    const load = (src) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-smartcare="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.dataset.smartcare = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(el);
    });

    (async () => {
      try {
        for (const file of files) await load(file);
      } catch (err) {
        console.error(err);
        setFailed(err.message);
      }
    })();
  }, []);

  return (
    <>
      <div id="smartcare-mount" aria-live="polite" />
      {failed && (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
          <h2>SmartCare failed to start</h2>
          <p>{failed}</p>
          <p>Check that the Vite dev server is running from the project root.</p>
        </div>
      )}
    </>
  );
}
