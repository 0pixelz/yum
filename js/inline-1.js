// Inline manifest as blob so single-file works.
// Uses a unique branded YUM dice icon (no emojis).
    const _yumIconSvg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
      + "<defs>"
      + "<linearGradient id='b' x1='0' y1='0' x2='1' y2='1'>"
      + "<stop offset='0%25' stop-color='%23f5a623'/><stop offset='100%25' stop-color='%23e94560'/>"
      + "</linearGradient>"
      + "</defs>"
      + "<rect width='100' height='100' rx='20' fill='%231a1a2e'/>"
      + "<rect x='22' y='22' width='56' height='56' rx='12' fill='url(%23b)'/>"
      + "<circle cx='38' cy='38' r='6' fill='%23111827'/>"
      + "<circle cx='62' cy='38' r='6' fill='%23111827'/>"
      + "<circle cx='50' cy='50' r='6' fill='%23111827'/>"
      + "<circle cx='38' cy='62' r='6' fill='%23111827'/>"
      + "<circle cx='62' cy='62' r='6' fill='%23111827'/>"
      + "</svg>";
    const manifest = {
      name: "YAM IO",
      short_name: "YAM IO",
      description: "Yam / Yahtzee scorecard with dice scanner and predictions",
      start_url: ".",
      display: "standalone",
      background_color: "#1a1a2e",
      theme_color: "#1a1a2e",
      orientation: "portrait",
      icons: [
        { src: "data:image/svg+xml," + _yumIconSvg, sizes: "192x192", type: "image/svg+xml" },
        { src: "data:image/svg+xml," + _yumIconSvg, sizes: "512x512", type: "image/svg+xml" }
      ]
    };
    const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
    const manifestURL = URL.createObjectURL(blob);
    document.querySelector('link[rel="manifest"]').href = manifestURL;
