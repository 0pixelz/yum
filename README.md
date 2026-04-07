# 🎲 YUM! — Multiplayer Scorecard App

A full-featured **Yum / Yahtzee scorecard web app** built as a single HTML file. Play solo, against a bot, or with friends in real-time multiplayer — all from your phone browser with no installation required.

🔗 **Live App:** [0pixelz.github.io/yum](https://0pixelz.github.io/yum)

---

## 🕹️ Game Modes

### 🎮 Create Multiplayer Game
Host a real-time multiplayer game. A 4-letter room code and QR code are generated for friends to join instantly. All players see each other's dice rolling live and scores update in real time via Firebase.

### 👥 Join Game
Enter a room code manually or scan the host's QR code with your camera to join instantly.

### 🤖 Play vs Bot
Play against an AI opponent powered by a Monte Carlo simulation engine. The bot evaluates all 32 possible hold combinations and simulates hundreds of rolls to pick the optimal strategy each turn.

### 🎲 Practice Mode
Free play mode — set dice manually by tapping, scan real dice with your camera, get predictions, and experiment with no rules enforced.

---

## ✨ Features

### Dice Roller
- Roll up to 3 times per turn
- **HOLD** individual dice between rolls
- Tap any die to manually set its value (Practice mode only)
- **📷 SCAN** — take a photo of your real dice and Claude AI reads the values automatically

### AI Predictions (🔮 PREDICT)
- Runs **600 Monte Carlo simulations** per option across all 32 hold combinations
- Shows top recommended moves ranked by expected score percentage
- **YUM! chance** is always highlighted with its own dedicated card
- Updates instantly as you set or roll dice

### Multiplayer (Firebase Realtime)
- Live dice sync — watch opponents roll and hold in real time
- Reaction system — tap a player's name to send emoji reactions (👍🔥😂🎲🏆 and more)
- Tap any opponent's name to view their full scorecard with every category and score
- QR code sharing in the waiting room
- Turn-based enforcement — only the active player can roll or score

### VS Bot
- Smart AI using the same prediction engine as the PREDICT button
- Watch the bot's dice animate live in the dice roller as it plays
- Bot rolls are shown step by step with thinking indicators

### Scorecard
- Full Yum scoring: Upper section (1s–6s + bonus), Lower section (3-of-a-kind, 4-of-a-kind, Full House, Small/Large Straight, YUM!, Chance)
- Upper bonus tracker (63 pts → +35 bonus)
- Scored categories show **% of max** with a colour-coded progress bar
- Scratched categories show ~~strikethrough~~ text
- Score popup shows only valid options: your current roll result or Strike (0 pts)

### Session History (📋 HISTORY)
- Tracks all games played in the current session
- **Summary tab** — standings with wins, total score, average per game
- **Per-game tabs** — full side-by-side scorecard table for every game, with the best score per row highlighted in gold
- Available after every game via the floating button or the game over screen

### Game Start — Who Goes First
- Animated overlay at the start of every game
- Each player taps their own die to roll
- Bot / opponents roll automatically
- On a tie, both dice reset and re-roll until a winner is found

### Game Over
- Full-screen popup showing 🏆 winner, scores, and a podium
- **REMATCH** — resets everything and starts a new game instantly
- **VIEW SCORESHEETS** — opens session history without closing the popup
- **QUIT** — returns to the lobby

---

## 📱 Install as an App (Android & iOS)

This is a **Progressive Web App (PWA)**. To install:

1. Open [0pixelz.github.io/yum](https://0pixelz.github.io/yum) in **Chrome** (Android) or **Safari** (iOS)
2. An **INSTALL** banner will appear at the bottom — tap it
3. Or: tap the browser menu → **Add to Home Screen**
4. The app installs to your home screen, opens fullscreen, and works offline

---

## 🔧 Tech Stack

| Technology | Usage |
|---|---|
| **HTML / CSS / JS** | Single-file app, no build tools |
| **Firebase Realtime Database** | Multiplayer sync, live dice, reactions |
| **Anthropic Claude API** | Dice photo scanning (vision), QR code reading |
| **QRCode.js** | QR code generation for room sharing |
| **Monte Carlo Simulation** | AI prediction engine (600 simulations/option) |

---

## 🚀 Setup & Deployment

### Deploy to GitHub Pages
1. Fork or upload `index.html` to a public GitHub repository
2. Go to **Settings → Pages**
3. Set source to **Deploy from branch → main → / (root)**
4. Your app will be live at `https://YOUR-USERNAME.github.io/REPO-NAME`

### Firebase Setup (for Multiplayer)
1. Go to [firebase.google.com](https://firebase.google.com) → Create project
2. Add a web app → copy the `firebaseConfig`
3. Enable **Realtime Database** in test mode
4. Replace the `firebaseConfig` object in `index.html` with your own

### Claude API (for Dice Scan & QR Scan)
The app calls the Anthropic API directly from the browser. The API key is handled automatically when hosted on Claude.ai artifacts. For self-hosting, add your own API key to the fetch headers in the `handleCamImage()` and `scanQrCode()` functions.

---

## 🎮 How to Play Yum

| Category | How to Score |
|---|---|
| Ones – Sixes | Sum of matching dice (e.g. three 4s = 12) |
| Upper Bonus | Score 63+ in upper section → +35 pts |
| 3 of a Kind | 3+ matching dice → sum all 5 dice |
| 4 of a Kind | 4+ matching dice → sum all 5 dice |
| Full House | 3 of one + 2 of another → 25 pts |
| Small Straight | 4 sequential dice → 30 pts |
| Large Straight | 5 sequential dice → 40 pts |
| YUM! | All 5 dice the same → 50 pts |
| Chance | Any roll → sum all 5 dice |

Each category can only be used **once**. If you can't or don't want to score, you must **Strike** (scratch) a category for 0 pts.

---

## 👤 Author

Built by **Jonathan (0pixelz)** with Claude AI.
