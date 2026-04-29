// Inline manifest as blob so single-file works
    const manifest = {
      name: "YUM! Scorecard",
      short_name: "YUM!",
      description: "Yum / Yahtzee scorecard with dice scanner and predictions",
      start_url: ".",
      display: "standalone",
      background_color: "#1a1a2e",
      theme_color: "#1a1a2e",
      orientation: "portrait",
      icons: [
        { src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231a1a2e'/><text y='.9em' font-size='80' x='10'>🎲</text></svg>", sizes: "192x192", type: "image/svg+xml" },
        { src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231a1a2e'/><text y='.9em' font-size='80' x='10'>🎲</text></svg>", sizes: "512x512", type: "image/svg+xml" }
      ]
    };
    const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
    const manifestURL = URL.createObjectURL(blob);
    document.querySelector('link[rel="manifest"]').href = manifestURL;
