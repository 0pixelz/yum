# 🎲 YAM IO — Multiplayer Dice Scorecard Game

**YAM IO** is a mobile-friendly Yam / Yahtzee-style web game where you can play against a smart bot, or with friends in real-time multiplayer. It includes live rooms, QR-code lobby sharing, dice rolling, score tracking, AI-powered move prediction, real-dice scanning, achievements, daily rewards, daily challenges, credits, and a dice Skin Store.

🔗 **Live App:** [0pixelz.github.io/yum](https://0pixelz.github.io/yum)

---

## 🚀 What the Game Does

YAM IO lets players roll five dice up to three times per turn, hold dice between rolls, and score one category per turn. The goal is to build the best scorecard by choosing the right categories at the right time.

The game supports:

- **Play vs Bot** with an AI opponent
- **Real-time multiplayer rooms** with friends
- **Room codes and QR codes** for easy joining
- **Live dice and score syncing** through Firebase
- **Score suggestions and AI predictions** using Monte Carlo simulations
- **Camera dice scan** for reading real dice from a photo
- **Achievements and progression**
- **Google / Apple login support**
- **Credits, daily bonus, daily challenge, and Skin Store**
- **PWA install support** for Android and iOS

---

## 🕹️ Game Modes

### 🎮 Host / Create Multiplayer Game
Create a multiplayer room and invite friends using a short room code or QR code. The host can choose the game mode and start the game when players are ready.

### 👥 Join Multiplayer Game
Join an existing room by typing the room code or scanning the host’s QR code with your camera.

### 🤖 Play vs Bot
Play against a bot that uses the same prediction logic as the helper system. The bot evaluates possible dice holds and scoring options to make strong decisions.

---

## ✨ Main Features

### 🎲 Dice Roller
- Roll up to **3 times per turn**
- Hold/unhold individual dice between rolls
- Animated dice rolling
- Held dice are visually highlighted
- Dice faces use classic dot-style dice symbols

### 📷 Dice Scanner
- Take a photo of real dice
- The app reads the dice values using AI vision
- Useful when playing with physical dice but tracking scores digitally

### 🔮 AI Move Prediction
- Runs Monte Carlo-style simulations to evaluate possible moves
- Suggests the best dice to hold
- Helps estimate expected score outcomes
- Highlights strong scoring opportunities, including YAM chances

### 🧮 Smart Scorecard
- Full Yam / Yahtzee-style scorecard
- Upper section: Ones, Twos, Threes, Fours, Fives, Sixes
- Lower section: 3 of a Kind, 4 of a Kind, Full House, Small Straight, Large Straight, YAM!, Chance
- Upper bonus tracker: **63+ points = +35 bonus**
- Score percentage indicators
- Colour-coded score progress bars
- Scratch/strike support for 0-point categories
- Popup score confirmation before saving a category

### 🎁 Upper Bonus Helper
- Shows how close you are to the upper bonus
- Displays how many dice of a number you may need to stay on track
- Helps players make better upper-section decisions

---

## 🌐 Multiplayer Features

### 🔥 Real-Time Firebase Rooms
- Multiplayer rooms are synced through Firebase Realtime Database
- Dice rolls update live for all players
- Scores update in real time
- Turn-based play prevents the wrong player from rolling/scoring

### 🏠 Lobby System
- Host creates a room
- Players join with a room code
- QR code is generated for quick joining
- Copy/share lobby support
- Ready check support in the waiting room
- Host can start the game

### 👀 Opponent Viewer
- Tap an opponent to view their scorecard
- See opponent progress, filled categories, and total score

### 💬 Reactions
- Send emoji reactions during multiplayer
- Adds a more social/fun feeling during live games

### 📋 Session History
- Keeps track of games played during the session
- View match summaries
- Compare player scorecards after a game
- See wins, totals, and per-game score details

---

## 🤖 Bot Mode

The bot opponent can:

- Roll dice like a real player
- Hold dice strategically
- Score categories automatically
- Show thinking/loading feedback
- Animate its dice rolls in the main dice roller

Bot mode is useful when you want to practice without needing another player online.

---

## 🏆 Achievements & Progression

YAM IO includes progression features to make the game more rewarding:

- Achievement tracking
- Progress bar / completion percentage
- Points earned through gameplay milestones
- Achievement menu from the main game screen
- Skin and credit progression tied to play activity

Examples of progression goals can include things like winning games, scoring strong categories, getting YAMs, playing daily, or completing challenges.

---

## 🔐 Login Features

YAM IO supports account-based features through:

- **Google login**
- **Apple login**
- Local device profile fallback

When logged in, the game can unlock account-based features such as:

- Skin Store access
- Daily Bonus
- Daily Challenge
- Credit wallet
- User-specific progression features

If not logged in, the game can still be played with a local device profile.

---

## 🎨 Skin Store & Dice Customization

The Skin Store lets logged-in players customize their dice.

### Free Original Dice Customization
- Original dice stay free
- Players can choose dice colors from a color palette
- Dice keep the classic dot faces

### Premium Skins
The game includes unlockable dice skins purchased with credits, such as:

- Gold
- Neon
- Ice
- Fire
- Galaxy
- Candy
- Ocean
- Midnight
- Lava
- Rose Gold
- Diamond

Skin visuals are applied to the dice while keeping gameplay the same.

---

## 🎁 Daily Bonus & Daily Challenge

Logged-in players can earn credits through daily engagement features.

### Daily Bonus
- Available only when signed in
- Rewards players with credits
- Supports streak-style rewards

### Daily Challenge
- Gives players a small objective to complete
- Rewards credits when completed
- Encourages players to come back and play daily

Credits can be used for Skin Store unlocks.

---

## ⚡ Power-Up / Alternate Multiplayer Mode

The multiplayer lobby includes a game mode selector with support for normal play and power-up style play.

This allows the game to expand beyond classic Yam rules with special abilities or alternate multiplayer rules.

---

## 📱 Install as an App

YAM IO is built as a **Progressive Web App (PWA)**.

### Android
1. Open [0pixelz.github.io/yum](https://0pixelz.github.io/yum) in Chrome
2. Tap the install banner if it appears
3. Or open the browser menu and choose **Add to Home Screen**

### iPhone / iPad
1. Open the site in Safari
2. Tap the share button
3. Choose **Add to Home Screen**

Once installed, the game opens like an app from your home screen.

---

## 🧠 How to Play Yam

| Category | How to Score |
|---|---|
| Ones – Sixes | Sum only the dice matching that number |
| Upper Bonus | Score 63+ in the upper section to earn +35 points |
| 3 of a Kind | At least 3 matching dice → sum all dice |
| 4 of a Kind | At least 4 matching dice → sum all dice |
| Full House | 3 of one number + 2 of another → 25 points |
| Small Straight | 4 sequential dice → 30 points |
| Large Straight | 5 sequential dice → 40 points |
| YAM! | 5 dice the same → 50 points |
| Chance | Any dice combination → sum all dice |

Each category can only be used **once**. If you cannot or do not want to score, you can scratch a category for **0 points**.

---

## 🛠️ Tech Stack

| Technology | Used For |
|---|---|
| **HTML** | App structure |
| **CSS** | Mobile-first styling, animations, PWA UI |
| **JavaScript** | Game logic, scoring, lobby, bot, predictions |
| **Firebase Realtime Database** | Multiplayer rooms, live dice, player sync |
| **Firebase Auth** | Google / Apple login support |
| **QRCode.js** | QR room code generation |
| **AI Vision / API integration** | Dice photo scanning |
| **Monte Carlo simulation** | Prediction engine and bot decision-making |
| **PWA Manifest** | Installable Android / iOS app experience |

---

## 📁 Project Structure

Common files/folders include:

```text
index.html              # Main app layout
manifest.json           # PWA install settings
css/style.css           # Main styling
js/app.js               # Main game logic
js/profile-login.js     # Google / Apple profile login
js/login-feature-finalizer.js # Login-gated features, daily rewards, Skin Store, lobby enhancements
js/skin-store-upgrade.js # Dice skin visuals and color customization
js/skin-sync.js         # Multiplayer dice skin sync
```

---

## 🚀 Deployment

This app is designed to run directly from GitHub Pages.

### GitHub Pages
1. Push the project to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from branch**
4. Choose `main` and `/root`
5. Open the generated GitHub Pages URL

### Firebase Setup
To use multiplayer and login features, configure Firebase:

1. Create a Firebase project
2. Add a web app
3. Enable **Realtime Database**
4. Enable **Google Authentication** if using Google login
5. Enable **Apple Authentication** if using Apple login
6. Add your Firebase config to the project

---

## 👤 Author

Built by **Jonathan (0pixelz)**.
