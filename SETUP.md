# PodcastFlow - Guide d'installation

## Prérequis

Node.js (v18+) est requis. Pour l'installer sur macOS :

```bash
# Option 1 — Homebrew (recommandé)
brew install node

# Option 2 — Téléchargement direct
# https://nodejs.org/  →  choisir "LTS"
```

---

## Installation

```bash
# 1. Se placer dans le dossier du projet
cd "PWA PODCASTS"

# 2. Installer les dépendances
npm install

# 3. Copier et remplir la config
cp .env.example .env
```

---

## Configuration Telegram

### Étape 1 — Créer le bot

1. Ouvrez Telegram
2. Cherchez **@BotFather**
3. Envoyez `/newbot`
4. Suivez les instructions → vous obtenez un **token** : `123456789:ABCdef...`

### Étape 2 — Obtenir votre Chat ID

1. Démarrez votre bot (envoyez `/start`)
2. Ouvrez dans un navigateur :
   ```
   https://api.telegram.org/bot<VOTRE_TOKEN>/getUpdates
   ```
3. Cherchez `"chat":{"id": XXXXXXX}` — copiez ce nombre

### Étape 3 — Remplir le `.env`

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
PORT=3000
```

> **Note :** Vous pouvez aussi configurer Telegram directement depuis l'interface
> de l'app (onglet Alertes) sans modifier le `.env`.

---

## Lancement

```bash
# Mode production
npm start

# Mode développement (rechargement auto)
npm run dev
```

Ouvrez ensuite **http://localhost:3000** dans votre navigateur.

### Installer comme PWA sur mobile

1. Ouvrez http://`<ip-de-votre-mac>`:3000 sur votre téléphone
   (trouvez votre IP avec : `ifconfig | grep "inet "`)
2. Safari/Chrome → menu → **"Sur l'écran d'accueil"**
3. L'app s'installe comme une vraie application native

---

## Utilisation

### Ajouter un flux RSS

1. Onglet **Accueil** → **+ Ajouter**
2. Entrez l'URL RSS de votre podcast
3. L'app valide le flux et récupère les épisodes

### Exemples de flux RSS populaires

| Podcast | URL RSS |
|---------|---------|
| France Inter 7/9 | `https://radiofrance-podcast.net/podcast09/rss_14007.xml` |
| No Limit Secu | `https://www.nolimitsecu.fr/feed/podcast` |
| Choses à Savoir | `https://feed.ausha.co/4mhMTiWqOp7R` |
| Cortex | `https://www.relay.fm/cortex/feed` |

### Configurer les alertes

1. Onglet **Alertes**
2. Saisissez votre **Token** et **Chat ID** Telegram
3. Cliquez **Sauvegarder** (un message de test est envoyé)
4. Activez/désactivez les horaires souhaités

### Horaires d'alerte automatiques

Les alertes sont envoyées automatiquement (fuseau Europe/Paris) à :

| Heure | Cron |
|-------|------|
| 08:00 | `0 8 * * *` |
| 10:00 | `0 10 * * *` |
| 12:00 | `0 12 * * *` |
| 16:00 | `0 16 * * *` |
| 18:00 | `0 18 * * *` |
| 20:00 | `0 20 * * *` |

Chaque alerte envoie le **nombre d'épisodes publiés dans les 24 dernières heures**,
groupé par podcast.

### Exemple de message Telegram reçu

```
🎙️ PodcastFlow - 18:00
📊 5 nouveaux épisodes dans les 24 dernières heures

📻 France Inter 7/9 (1 ép.)
  • Invité : [Nom de l'invité]

📻 No Limit Secu (2 ép.)
  • Épisode 42 - La sécurité des APIs
  • Épisode 43 - Zero Trust Architecture

📻 Choses à Savoir (2 ép.)
  • Pourquoi dort-on ?
  • Comment fonctionne un GPS ?
```

---

## Structure du projet

```
PWA PODCASTS/
├── public/              # Frontend PWA
│   ├── index.html       # Interface principale
│   ├── css/styles.css   # Thème noir/gris/orange
│   ├── js/app.js        # Logique frontend
│   ├── sw.js            # Service Worker (offline)
│   ├── manifest.json    # Config PWA
│   └── icons/           # Icônes de l'app
├── server/              # Backend Node.js
│   ├── index.js         # Serveur Express
│   ├── rss.js           # Parseur RSS
│   ├── telegram.js      # Bot Telegram
│   └── scheduler.js     # Cron jobs
├── .env                 # Config (à créer)
├── .env.example         # Modèle de config
└── package.json
```

---

## Garder le serveur actif

Pour que les alertes fonctionnent 24h/24, gardez le serveur actif :

```bash
# Option 1 — PM2 (gestionnaire de processus)
npm install -g pm2
pm2 start server/index.js --name podcastflow
pm2 startup   # démarrage automatique au boot

# Option 2 — Screen (terminal persistant)
screen -S podcastflow
npm start
# Ctrl+A puis D pour détacher
```
