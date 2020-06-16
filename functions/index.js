const functions = require("firebase-functions");
const firebase = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const Keyv = require("keyv");

const app = express();
const keyv = new Keyv();

const serviceAccount = require("./buddy-champ-jj-firebase-adminsdk-mhr7h-5216cae11b.json");
const secretKey = firebase.credential.cert(serviceAccount);

const firebaseApp = firebase.initializeApp({
  credential: firebase.credential.cert(secretKey),
  databaseURL: "https://buddy-champ-jj.firebaseio.com",
});

let whitelist = new Set([
  "https://buddy-champ-jj.firebaseapp.com",
  "https://buddy-champ-jj.web.app",
]);

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.has(origin)) {
      return callback(null, true);
    } else {
      // return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    }
  },
};
app.use(express.urlencoded());
app.use(express.json());
app.options("*", cors());

async function getCached() {
  const key = "cache";
  const resultsCached = await keyv.get(key);
  if (!resultsCached) {
    console.log("Fetching cached results");
    const ref = firebaseApp.database().ref("cache");
    return ref.once("value").then((snap) => {
      const cached = snap.val();
      keyv.set(key, cached, 43200);
      return cached;
    });
  } else {
    return resultsCached;
  }
}

async function getGameVersion() {
  const key = "gameVersion";
  const gameVersionCached = await keyv.get(key);
  if (!gameVersionCached) {
    console.log("Fetching game version");
    const ref = firebaseApp.database().ref(key);
    return ref.once("value").then((snap) => {
      const gameVersion = snap.val();
      keyv.set(key, gameVersion, 43200);
      return gameVersion;
    });
  } else {
    return gameVersionCached;
  }
}

async function getGameCount() {
  const key = "gameCount";
  const gameCountCached = await keyv.get(key);
  if (!gameCountCached) {
    console.log("Fetching game count");
    const ref = firebaseApp.database().ref(key);
    return ref.once("value").then((snap) => {
      const gameCount = snap.val();
      keyv.set(key, gameCount, 43200);
      return gameCount;
    });
  } else {
    return gameCountCached;
  }
}

async function getChampions() {
  const key = "champions";
  const championsCached = await keyv.get(key);
  if (!championsCached) {
    const ref = firebaseApp.database().ref(key);
    return ref.once("value").then((snap) => {
      const champions = snap.val();
      keyv.set(key, champions, 43200);
      return champions;
    });
  } else {
    return championsCached;
  }
}

function createMsg(status, msg) {
  return { status, msg };
}

app.get("/", cors(corsOptions), (req, res) => {
  res.json(createMsg("ok", "server running"));
});

const ROLE_MAP = {
  jungle: "jg",
  support: "sup",
  top: "top",
  mid: "mid",
  ad: "ad",
};

app.post("/api/load-combination-win-rate", cors(corsOptions), (req, res) => {
  res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  const params = req.body;
  const role = ROLE_MAP[params.role.toLowerCase()]; // ad
  const buddyRole = ROLE_MAP[params.buddyRole.toLowerCase()]; // sup
  const champion = params.champion; // Ashe
  const roleCombination = [role, buddyRole].sort().join("-"); // ad-sup

  if (!role || !buddyRole) {
    const msg = createMsg("error", "unknown roles");
    res.json(msg);
    return msg;
  }

  getCached()
    .then((cached) => {
      let winRateObjects = cached[roleCombination];
      winRateObjects = winRateObjects.filter((obj) => obj[role] === champion);
      winRateObjects = winRateObjects.map((obj) => ({
        // just renaming
        champ: obj[role],
        buddyChamp: obj[buddyRole],
        winRate: obj.winRate,
        total: obj.total,
      }));
      const msg = createMsg("ok", winRateObjects);
      res.json(msg);
      return msg;
    })
    .catch((error) => {
      res.json(createMsg("error", error));
    });
});

app.get("/api/game-version", cors(corsOptions), (req, res) => {
  getGameVersion()
    .then((gameVersion) => {
      const msg = createMsg("ok", gameVersion);
      res.json(msg);
      return msg;
    })
    .catch((error) => res.json(createMsg("error", error)));
});

app.get("/api/get-champions", cors(corsOptions), (req, res) => {
  getChampions()
    .then((champions) => {
      const msg = createMsg("ok", champions);
      res.json(msg);
      return msg;
    })
    .catch((error) => res.json(createMsg("error", error)));
});

app.get("/api/game-count", cors(corsOptions), (req, res) => {
  getGameCount()
    .then((gameCount) => {
      const msg = createMsg("ok", gameCount);
      res.json(msg);
      return msg;
    })
    .catch((error) => res.json(createMsg("error", error)));
});

app.post(
  "/api/load-all-combination-win-rate",
  cors(corsOptions),
  (req, res) => {
    const params = req.body;
    const combination = params.combination;

    getCached()
      .then((cached) => {
        let winRateObjects = cached[combination];
        winRateObjects = winRateObjects.filter((obj) => obj.total >= 200); 
        winRateObjects = winRateObjects.slice(0, 10);
        const msg = createMsg("ok", winRateObjects);
        res.json(msg);
        return msg;
      })
      .catch((error) => {
        res.json(createMsg("error", error));
      });
  }
);

exports.app = functions.https.onRequest(app);
