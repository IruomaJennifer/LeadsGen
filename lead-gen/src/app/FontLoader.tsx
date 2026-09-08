"use client";

import { useEffect } from "react";

// A plain <link rel="stylesheet"> in <head> is render-blocking — the browser
// won't paint anything until that external stylesheet resolves. Injecting it
// after hydration instead means first paint never waits on Google Fonts;
// text just renders in the system-font fallback and swaps to Inter once it
// arrives (a deliberate FOUC trade for never blocking on an external host).
export function FontLoader() {
  useEffect(() => {
    if (document.getElementById("inter-font-stylesheet")) return;
    const link = document.createElement("link");
    link.id = "inter-font-stylesheet";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  return null;
}
