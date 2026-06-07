(() => {
  "use strict";


  const CONFIG = {
    canvas: {
      width: 480,
      height: 800
    },

    paths: {
      assets: "assets/"
    },

    gameplay: {
      // Velocidade inicial dos objetos.
      // Menor = jogo mais fácil.
      baseObjectSpeed: 3.6,

      // Intervalo inicial entre objetos.
      // Maior = aparecem menos objetos.
      initialSpawnInterval: 1000,

      // Intervalo mínimo entre objetos quando a dificuldade aumentar.
      minSpawnInterval: 650,

      // A cada quantos milissegundos a dificuldade aumenta.
      difficultyStepInterval: 9000,

      // Quanto a velocidade aumenta por etapa de dificuldade.
      speedBonusStep: 0.25,

      // Quanto o intervalo entre objetos diminui por etapa.
      spawnIntervalDecrease: 20,

      // Velocidade lateral do bebê.
      playerMoveSpeed: 14,

      // Tempo entre trocas de faixa.
      laneSwitchDelay: 140,

      // Quanto a fome cai por milissegundo.
      hungerLossPerMs: 0.013,

      // Quanto o score aumenta por milissegundo.
      distanceScorePerMs: 0.01,

      // Limite de delta para evitar saltos se o navegador engasgar.
      maxFrameDelta: 50
    },

    balance: {
      initialBottleChance: 0.65,
      minimumBottleChance: 0.38,
      bottleChanceDecrease: 0.04,

      guaranteedBottleInterval: 2600,
      maxGuaranteedBottleInterval: 3400,
      guaranteedBottleIncrease: 120,

      openingSpawnCount: 8
    },

    hunger: {
      max: 100,
      cryThreshold: 10,
      angryThreshold: 40,

      bottleGain: 30,
      obstacleLoss: 12,

      collisionCryDuration: 700
    },

    transformation: {
      // Tempo total da transformação.
      // Maior: demora mais antes de pedir o nome.
      duration: 4200,

      // Momento da transformação em que o dino cresce.
      flickerPhaseEnd: 0.42,

      startScale: 1.0,
      endScale: 3.0,

      // Config do Texto da transformação.      
      message: "Theo está virando Baby Dino!",
      messageFontSize: 28,
      messageY: 80
    },

    ui: {
      introTitleFontSize: 30,
      introTextFontSize: 28,
      introButtonFontSize: 36,
      introInstructionFontSize: 22,

      hudSmallFontSize: 22,
      hudScoreFontSize: 30,

      rankingTitleFontSize: 20,
      rankingFontSize: 24,

      titleFontSize: 36,
      normalFontSize: 30,
      smallFontSize: 22
    },

    ranking: {
      storageKey: "babyTheoRunnerRanking",
      maxEntries: 10,
      maxNameLength: 10
    },

    colors: {
      text: "white",
      textSecondary: "#d2e1f0",
      textDark: "#18222c",

      panelFill: "rgba(18,34,49,.63)",
      panelBorder: "rgba(255,255,255,.35)",

      button: "#44a3ff",
      buttonBorder: "white",

      hungerBackground: "#dee6ee",
      hungerHappy: "#4cd964",
      hungerAngry: "#ffcc00",
      hungerCry: "#ff4d4d"
    }
  };

  // =========================================================
  // ELEMENTOS HTML E CONSTANTES
  // =========================================================
  const W = CONFIG.canvas.width;
  const H = CONFIG.canvas.height;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const loading = document.getElementById("loading");
  const nameInput = document.getElementById("nameInput");

  const STATES = {
    INTRO: "intro",
    PLAYING: "playing",
    TRANSFORMING: "transforming",
    ENTER_NAME: "enter_name",
    GAME_OVER: "game_over"
  };

  const lanes = [W / 6, W / 2, W - W / 6];
  const allLanes = [0, 1, 2];

  const startButton = {
    x: W / 2 - 100,
    y: H / 2 + 120,
    w: 200,
    h: 60
  };

  const imageFiles = {
    background: "background.png",
    bottle: "bottle.png",
    toy: "toy.png",
    log: "log.png",
    cat_white: "cat_white.png",
    cat_black: "cat_black.png",

    baby_happy: "baby_happy.png",
    baby_angry: "baby_angry.png",
    baby_cry: "baby_cry.png",
    baby_dino: "baby_dino.png",

    baby_crawl_0: "baby_crawl_0.png",
    baby_crawl_1: "baby_crawl_1.png",
    baby_crawl_2: "baby_crawl_2.png",
    baby_crawl_3: "baby_crawl_3.png",

    baby_angry_crawl_0: "baby_angry_crawl_0.png",
    baby_angry_crawl_1: "baby_angry_crawl_1.png",
    baby_angry_crawl_2: "baby_angry_crawl_2.png",
    baby_angry_crawl_3: "baby_angry_crawl_3.png"
  };

  const soundFiles = {
    laugh: "laugh.wav",
    roar: "baby_roar.wav",
    cry: "baby_cry.wav",
    magic: "magic_transform1.wav",
    music: "music_loop.wav"
  };

  // =========================================================
  // ASSETS
  // =========================================================
  const img = {};
  const snd = {};

  let crawlFrames = [];
  let angryCrawlFrames = [];
  let obstacleImages = [];
  let backgroundHeight = H;

  let audioUnlocked = false;
  let musicStarted = false;

  function loadImage(name, src) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        img[name] = image;
        resolve(image);
      };

      image.onerror = () => reject(new Error(`Erro ao carregar imagem: ${src}`));
      image.src = CONFIG.paths.assets + src;
    });
  }

  function loadSounds() {
    for (const [key, file] of Object.entries(soundFiles)) {
      const audio = new Audio(CONFIG.paths.assets + file);
      audio.preload = "auto";
      snd[key] = audio;
    }

    snd.music.loop = true;
    snd.music.volume = 0.28;

    snd.laugh.volume = 0.45;
    snd.roar.volume = 0.48;
    snd.cry.volume = 0.35;
    snd.magic.volume = 0.9;
  }

  function unlockAudio() {
    if (audioUnlocked) return;

    audioUnlocked = true;

    Object.values(snd).forEach(audio => {
      try {
        audio.load();
      } catch (_) {}
    });
  }

  function playSound(key) {
    if (!audioUnlocked || !snd[key]) return;

    const audio = snd[key].cloneNode(true);
    audio.volume = snd[key].volume;
    audio.play().catch(() => {});
  }

  function startMusic() {
    if (!audioUnlocked || musicStarted || !snd.music) return;

    snd.music.play()
      .then(async () => {
        musicStarted = true;
      })
      .catch(() => {});
  }

  // =========================================================
  // VARIÁVEIS DE ESTADO
  // =========================================================
  let state;
  let ranking;
  let nameText;
  let lastScore;
  let saved;

  let playerLane;
  let targetLane;
  let playerX;
  let playerY;
  let playerRect;
  let laneCooldown;

  let frameIndex;
  let frameTimer;

  let hunger;
  let collisionTimer;
  let bottles;
  let obstacles;
  let spawnTimer;
  let score;
  let distanceScore;

  let difficultyTimer;
  let speedBonus;
  let spawnInterval;
  let currentBottleChance;
  let guaranteedBottleInterval;
  let timeSinceLastBottle;

  let lastSpawnType;
  let lastBottleLane;
  let openingSpawnCount;
  let bgScroll;
  let lastSoundState;

  let transformTimer;
  let transformStart;
  let particles;
  let dinoSoundPlayed;
  let magicSoundPlayed;
  let flashAlpha;
  let shakeX;
  let shakeY;

  let mouse = { x: 0, y: 0 };

  // Usado para diferenciar toque simples de arrastar/swipe no celular.
  let touchStartX = 0;
  let touchStartY = 0;

  const keys = new Set();

  // =========================================================
  // RANKING
  // =========================================================
  function hasFirebaseRanking() {
    return Boolean(window.db && window.firebaseFirestore);
  }

  function normalizeRankingItem(item) {
    return {
      name: String(item.name || item.nome || "SEM_NOME")
        .toUpperCase()
        .slice(0, CONFIG.ranking.maxNameLength),
      score: Number(item.score || 0)
    };
  }

  function sortAndLimitRanking(items) {
    return items
      .map(normalizeRankingItem)
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.ranking.maxEntries);
  }

  async function loadRanking() {
    if (hasFirebaseRanking()) {
      try {
        const {
          collection,
          getDocs,
          query,
          orderBy,
          limit
        } = window.firebaseFirestore;

        const rankingQuery = query(
          collection(window.db, "ranking"),
          orderBy("score", "desc"),
          limit(CONFIG.ranking.maxEntries)
        );

        const snapshot = await getDocs(rankingQuery);
        const data = snapshot.docs.map(doc => doc.data());

        ranking = sortAndLimitRanking(data);
        return ranking;
      } catch (error) {
        console.error("Erro ao carregar ranking do Firebase:", error);
      }
    }

    try {
      const raw = localStorage.getItem(CONFIG.ranking.storageKey) || "[]";
      const data = JSON.parse(raw) || [];

      ranking = sortAndLimitRanking(data);
      return ranking;
    } catch (_) {
      ranking = [];
      return ranking;
    }
  }

  function saveRankingLocal() {
    localStorage.setItem(
      CONFIG.ranking.storageKey,
      JSON.stringify(ranking.slice(0, CONFIG.ranking.maxEntries))
    );
  }

  function isHighScore(value) {
    return ranking.length < CONFIG.ranking.maxEntries ||
      value > ranking[ranking.length - 1].score;
  }

  async function addScore(name, value) {
    const cleanName = (name.trim().toUpperCase() || "SEM_NOME")
      .slice(0, CONFIG.ranking.maxNameLength);

    const newScore = {
      name: cleanName,
      score: Math.floor(value),
      data: new Date()
    };

    if (hasFirebaseRanking()) {
      try {
        const {
          collection,
          addDoc
        } = window.firebaseFirestore;

        await addDoc(collection(window.db, "ranking"), newScore);
        await loadRanking();
        return;
      } catch (error) {
        console.error("Erro ao salvar ranking no Firebase:", error);
      }
    }

    ranking.push(newScore);
    ranking = sortAndLimitRanking(ranking);
    saveRankingLocal();
  }

  // =========================================================
  // RESET
  // =========================================================
  function resetGame() {
    playerLane = 1;
    targetLane = 1;
    playerX = lanes[1];
    playerY = 40;
    laneCooldown = 0;

    frameIndex = 0;
    frameTimer = 0;

    hunger = CONFIG.hunger.max;
    collisionTimer = 0;

    bottles = [];
    obstacles = [];
    spawnTimer = 0;
    score = 0;
    distanceScore = 0;

    difficultyTimer = 0;
    speedBonus = 0;
    spawnInterval = CONFIG.gameplay.initialSpawnInterval;
    currentBottleChance = CONFIG.balance.initialBottleChance;
    guaranteedBottleInterval = CONFIG.balance.guaranteedBottleInterval;
    timeSinceLastBottle = 0;

    lastSpawnType = null;
    lastBottleLane = null;
    openingSpawnCount = 0;
    bgScroll = 0;
    lastSoundState = null;

    transformTimer = 0;
    transformStart = { x: 0, y: 0 };
    particles = [];
    dinoSoundPlayed = false;
    magicSoundPlayed = false;
    flashAlpha = 0;
    shakeX = 0;
    shakeY = 0;

    nameText = "";
    lastScore = 0;
    saved = false;

    state = STATES.INTRO;
    hideInput();
    updatePlayerRect();
  }

  // =========================================================
  // REGRAS DO JOGADOR
  // =========================================================
  function hungerState() {
    if (hunger <= 0) return "dino";
    if (hunger <= CONFIG.hunger.cryThreshold) return "cry";
    if (hunger <= CONFIG.hunger.angryThreshold) return "angry";
    return "happy";
  }

  function currentPlayerImg() {
    if (state === STATES.GAME_OVER || state === STATES.ENTER_NAME) {
      return img.baby_dino;
    }

    if (state === STATES.TRANSFORMING) {
      return null;
    }

    if (state === STATES.INTRO) {
      return crawlFrames[frameIndex];
    }

    if (collisionTimer > 0) {
      return img.baby_cry;
    }

    const currentState = hungerState();

    if (currentState === "happy") return crawlFrames[frameIndex];
    if (currentState === "angry") return angryCrawlFrames[frameIndex];
    if (currentState === "cry") return img.baby_cry;

    return img.baby_dino;
  }

  function updatePlayerRect() {
    const playerImage = currentPlayerImg() || img.baby_dino;

    playerRect = {
      x: playerX - playerImage.width / 2,
      y: playerY,
      w: playerImage.width,
      h: playerImage.height
    };
  }

  function collides(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  function choice(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  // =========================================================
  // SPAWN DE OBJETOS
  // =========================================================
  function dangerousLanes() {
    const dangerous = new Set();

    obstacles.forEach(obstacle => {
      if (obstacle.rect.y >= -20 && obstacle.rect.y <= 260) {
        dangerous.add(obstacle.lane);
      }
    });

    return dangerous;
  }

  function safeLanes() {
    const dangerous = dangerousLanes();
    return allLanes.filter(lane => !dangerous.has(lane));
  }

  function chooseBottleLane() {
    let safe = safeLanes();

    if (!safe.length) {
      safe = [...allLanes];
    }

    let candidates = [...safe];

    if (
      lastBottleLane !== null &&
      candidates.includes(lastBottleLane) &&
      candidates.length > 1
    ) {
      candidates = candidates.filter(lane => lane !== lastBottleLane);
    }

    if (
      openingSpawnCount < CONFIG.balance.openingSpawnCount &&
      candidates.includes(playerLane) &&
      candidates.length > 1 &&
      Math.random() < 0.7
    ) {
      candidates = candidates.filter(lane => lane !== playerLane);
    }

    return choice(candidates.length ? candidates : safe);
  }

  function spawnBottle(lane = null) {
    if (lane === null) {
      lane = chooseBottleLane();
    }

    const bottleImage = img.bottle;

    bottles.push({
      lane,
      rect: {
        x: lanes[lane] - bottleImage.width / 2,
        y: H + 80 - bottleImage.height,
        w: bottleImage.width,
        h: bottleImage.height
      }
    });

    timeSinceLastBottle = 0;
    lastBottleLane = lane;
    lastSpawnType = "bottle";
    openingSpawnCount++;
  }

  function canSpawnObstacle(lane) {
    const dangerous = dangerousLanes();

    if (dangerous.has(lane)) {
      return false;
    }

    dangerous.add(lane);

    if (dangerous.size >= 3) {
      return false;
    }

    return !obstacles.some(obstacle =>
      obstacle.lane === lane &&
      obstacle.rect.y + obstacle.rect.h > H - 180
    );
  }

  function spawnObstacle(lane = null) {
    if (lane === null) {
      const safe = safeLanes();

      let candidates = safe.length
        ? allLanes.filter(laneItem => !safe.includes(laneItem))
        : [...allLanes];

      if (!candidates.length && safe.length) {
        candidates = allLanes.filter(laneItem => laneItem !== choice(safe));
      }

      lane = choice(candidates.length ? candidates : allLanes);
    }

    const obstacleImage = choice(obstacleImages);

    obstacles.push({
      lane,
      img: obstacleImage,
      rect: {
        x: lanes[lane] - obstacleImage.width / 2,
        y: H + 80 - obstacleImage.height,
        w: obstacleImage.width,
        h: obstacleImage.height
      }
    });

    lastSpawnType = "obstacle";
    openingSpawnCount++;
  }

  function spawnOpening() {
    if (lastSpawnType === "bottle") {
      let candidates = allLanes.filter(canSpawnObstacle);

      if (!candidates.length) {
        candidates = allLanes.filter(lane => lane !== playerLane);
      }

      spawnObstacle(choice(candidates.length ? candidates : allLanes));
      return;
    }

    spawnBottle();
  }

  function spawnSmart() {
    if (openingSpawnCount < CONFIG.balance.openingSpawnCount) {
      spawnOpening();
      return;
    }

    const safe = safeLanes();

    if (timeSinceLastBottle >= guaranteedBottleInterval) {
      spawnBottle();
      return;
    }

    if (lastSpawnType === "bottle") {
      const candidates = allLanes.filter(canSpawnObstacle);

      if (candidates.length && Math.random() < 0.75) {
        spawnObstacle(choice(candidates));
        return;
      }
    }

    if (Math.random() < currentBottleChance) {
      spawnBottle();
      return;
    }

    let candidates = allLanes.filter(canSpawnObstacle);

    if (!candidates.length) {
      candidates = safe.length
        ? allLanes.filter(lane => lane !== choice(safe))
        : allLanes.filter(lane => lane !== playerLane);
    }

    if (!candidates.length) {
      candidates = [choice(allLanes)];
    }

    const first = choice(candidates);
    spawnObstacle(first);

    if (speedBonus >= 1 && Math.random() < 0.18) {
      const secondCandidates = allLanes.filter(lane =>
        lane !== first && canSpawnObstacle(lane)
      );

      if (secondCandidates.length) {
        spawnObstacle(choice(secondCandidates));
      }
    }
  }

  // =========================================================
  // TRANSFORMAÇÃO BABY DINO
  // =========================================================
  function startTransform() {
    state = STATES.TRANSFORMING;
    transformTimer = 0;
    transformStart = { x: playerX, y: playerY };
    particles = [];
    dinoSoundPlayed = false;
    magicSoundPlayed = false;
    lastSoundState = null;
    flashAlpha = 0;

    for (let i = 0; i < 34; i++) {
      particles.push({
        angle: Math.random() * 360,
        radius: 6 + Math.random() * 24,
        speed: 2 + Math.random() * 3,
        size: 3 + Math.random() * 7,
        alpha: 150 + Math.random() * 90
      });
    }
  }

  function finishRound() {
    lastScore = Math.floor(score + distanceScore);
    saved = false;

    if (isHighScore(lastScore)) {
      nameText = "";
      nameInput.value = "";
      showInput();
      state = STATES.ENTER_NAME;
    } else {
      state = STATES.GAME_OVER;
    }
  }

  function updateTransform(dt) {
    bgScroll = (bgScroll + 2.5) % backgroundHeight;
    transformTimer += dt;

    const progress = Math.min(1, transformTimer / CONFIG.transformation.duration);

    if (!magicSoundPlayed) {
      playSound("magic");
      magicSoundPlayed = true;
    }

    if (!dinoSoundPlayed && progress >= 0.45) {
      playStateSound("dino");
      dinoSoundPlayed = true;
    }

    particles.forEach(particle => {
      particle.radius += particle.speed * (1.1 + progress * 2);
      particle.alpha = Math.max(0, particle.alpha - 2);
    });

    const intensity = progress < 0.75
      ? 2 + (1 - (1 - progress / 0.75) * (1 - progress / 0.75)) * 16
      : Math.max(0, 18 * (1 - (progress - 0.75) / 0.25));

    shakeX = (Math.random() * 2 - 1) * intensity;
    shakeY = (Math.random() * 2 - 1) * intensity;

    flashAlpha = progress >= 0.52 && progress <= 0.68
      ? 220 * Math.sin(((progress - 0.52) / 0.16) * Math.PI)
      : Math.max(0, flashAlpha - 18);

    if (transformTimer >= CONFIG.transformation.duration) {
      shakeX = 0;
      shakeY = 0;
      flashAlpha = 0;
      finishRound();
    }
  }

  // =========================================================
  // SONS POR ESTADO
  // =========================================================
  function playStateSound(soundState) {
    if (soundState === lastSoundState) {
      return;
    }

    lastSoundState = soundState;

    if (soundState === "intro") playSound("laugh");
    else if (soundState === "angry") playSound("roar");
    else if (soundState === "cry") playSound("cry");
    else if (soundState === "dino") playSound("roar");
  }

  // =========================================================
  // UPDATE
  // =========================================================
  function update(dt) {
    if (state === STATES.INTRO) {
      updateIntro(dt);
    } else if (state === STATES.PLAYING) {
      updatePlaying(dt);
    } else if (state === STATES.TRANSFORMING) {
      updateTransform(dt);
    } else if (state === STATES.ENTER_NAME || state === STATES.GAME_OVER) {
      bgScroll = (bgScroll + 1.2) % backgroundHeight;
    }
  }

  function updateIntro(dt) {
    bgScroll = (bgScroll + 2) % backgroundHeight;

    frameTimer += dt;
    if (frameTimer >= 120) {
      frameTimer = 0;
      frameIndex = (frameIndex + 1) % crawlFrames.length;
    }
  }

  function updatePlaying(dt) {
    updateDifficulty(dt);
    updatePlayerMovement(dt);
    updateHunger(dt);
    updateSpawns(dt);
    updateObjects();
    updateCollisions(dt);
    updateAnimation(dt);
    updateScore(dt);
    updateHungerSounds();
  }

  function updateDifficulty(dt) {
    difficultyTimer += dt;
    timeSinceLastBottle += dt;

    if (difficultyTimer < CONFIG.gameplay.difficultyStepInterval) {
      return;
    }

    difficultyTimer = 0;
    speedBonus += CONFIG.gameplay.speedBonusStep;

    spawnInterval = Math.max(
      CONFIG.gameplay.minSpawnInterval,
      spawnInterval - CONFIG.gameplay.spawnIntervalDecrease
    );

    currentBottleChance = Math.max(
      CONFIG.balance.minimumBottleChance,
      currentBottleChance - CONFIG.balance.bottleChanceDecrease
    );

    guaranteedBottleInterval = Math.min(
      CONFIG.balance.maxGuaranteedBottleInterval,
      guaranteedBottleInterval + CONFIG.balance.guaranteedBottleIncrease
    );
  }

  function currentObjectSpeed() {
    return CONFIG.gameplay.baseObjectSpeed + speedBonus;
  }

  function updatePlayerMovement(dt) {
    const objectSpeed = currentObjectSpeed();

    bgScroll = (bgScroll + objectSpeed * 0.9) % backgroundHeight;

    if (laneCooldown > 0) {
      laneCooldown -= dt;
    }

    if (laneCooldown <= 0) {
      if (keys.has("ArrowLeft") || keys.has("a")) {
        targetLane = Math.max(0, targetLane - 1);
        laneCooldown = CONFIG.gameplay.laneSwitchDelay;
      } else if (keys.has("ArrowRight") || keys.has("d")) {
        targetLane = Math.min(2, targetLane + 1);
        laneCooldown = CONFIG.gameplay.laneSwitchDelay;
      }
    }

    const targetX = lanes[targetLane];

    if (Math.abs(playerX - targetX) < CONFIG.gameplay.playerMoveSpeed) {
      playerX = targetX;
    } else {
      playerX += playerX < targetX
        ? CONFIG.gameplay.playerMoveSpeed
        : -CONFIG.gameplay.playerMoveSpeed;
    }

    if (playerX === targetX) {
      playerLane = targetLane;
    }
  }

  function updateHunger(dt) {
    hunger = Math.max(0, hunger - CONFIG.gameplay.hungerLossPerMs * dt);

    if (hunger <= 0) {
      startTransform();
    }
  }

  function updateSpawns(dt) {
    spawnTimer += dt;

    if (state === STATES.PLAYING && spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnSmart();
    }
  }

  function updateObjects() {
    const objectSpeed = currentObjectSpeed();

    bottles.forEach(bottle => {
      bottle.rect.y -= Math.floor(objectSpeed);
    });

    obstacles.forEach(obstacle => {
      obstacle.rect.y -= Math.floor(objectSpeed + 1);
    });

    bottles = bottles.filter(bottle => bottle.rect.y + bottle.rect.h > -100);
    obstacles = obstacles.filter(obstacle => obstacle.rect.y + obstacle.rect.h > -100);
  }

  function updateCollisions(dt) {
    updatePlayerRect();

    for (let i = bottles.length - 1; i >= 0; i--) {
      if (collides(playerRect, bottles[i].rect)) {
        bottles.splice(i, 1);
        hunger = Math.min(CONFIG.hunger.max, hunger + CONFIG.hunger.bottleGain);
        score += 25;

        if (hungerState() === "happy") {
          playSound("laugh");
        }
      }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (collides(playerRect, obstacles[i].rect)) {
        obstacles.splice(i, 1);
        collisionTimer = CONFIG.hunger.collisionCryDuration;
        hunger = Math.max(0, hunger - CONFIG.hunger.obstacleLoss);
        score = Math.max(0, score - 5);
        playStateSound("cry");
        break;
      }
    }

    if (collisionTimer > 0) {
      collisionTimer = Math.max(0, collisionTimer - dt);
    }
  }

  function updateAnimation(dt) {
    frameTimer += dt;

    if (frameTimer >= 120) {
      frameTimer = 0;
      frameIndex = (frameIndex + 1) % crawlFrames.length;
    }
  }

  function updateScore(dt) {
    distanceScore += dt * CONFIG.gameplay.distanceScorePerMs;
  }

  function updateHungerSounds() {
    const currentState = hungerState();

    if (collisionTimer > 0) {
      return;
    }

    if (currentState === "angry") {
      playStateSound("angry");
    } else if (currentState === "cry") {
      playStateSound("cry");
    } else {
      lastSoundState = "happy";
    }
  }

  // =========================================================
  // DESENHO - HELPERS
  // =========================================================
  function roundRect(x, y, w, h, radius, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawText(text, size, color, x, y, center = false, bold = false) {
    ctx.font = `${bold ? "bold " : ""}${size}px Arial`;
    ctx.textBaseline = "middle";
    ctx.textAlign = center ? "center" : "left";

    ctx.fillStyle = "black";
    ctx.fillText(text, x + 2, y + 2);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function panel(x, y, w, h) {
    roundRect(
      x,
      y,
      w,
      h,
      16,
      CONFIG.colors.panelFill,
      CONFIG.colors.panelBorder,
      2
    );
  }

  // =========================================================
  // DESENHO - CENÁRIO / HUD
  // =========================================================
  function drawBackground() {
    const background = img.background;
    const y1 = -bgScroll;
    const y2 = y1 + backgroundHeight;

    ctx.drawImage(background, 0, y1, W, backgroundHeight);
    ctx.drawImage(background, 0, y2, W, backgroundHeight);

    if (y2 < H) {
      ctx.drawImage(background, 0, y2 + backgroundHeight, W, backgroundHeight);
    }
  }

  function drawHud() {
    panel(10, 500, 70, 275);

    roundRect(34, 515, 24, 220, 10, CONFIG.colors.hungerBackground, "white", 2);

    const fillHeight = hunger / CONFIG.hunger.max * 220;
    const fillY = 515 + 220 - fillHeight;

    let hungerColor = CONFIG.colors.hungerHappy;
    if (hunger <= CONFIG.hunger.cryThreshold) {
      hungerColor = CONFIG.colors.hungerCry;
    } else if (hunger <= CONFIG.hunger.angryThreshold) {
      hungerColor = CONFIG.colors.hungerAngry;
    }

    roundRect(34, fillY, 24, fillHeight, 10, hungerColor);

    drawText("Fome", CONFIG.ui.hudSmallFontSize, CONFIG.colors.text, 22, 750);

    panel(W - 200, 725, 180, 48);
    drawText("Score", CONFIG.ui.hudSmallFontSize, CONFIG.colors.textSecondary, W - 155, 750, true);
    drawText(String(Math.floor(score + distanceScore)), CONFIG.ui.hudScoreFontSize, CONFIG.colors.text, W - 70, 750, true);
  }

  // =========================================================
  // DESENHO - TELAS
  // =========================================================
  function drawIntro() {
    ctx.fillStyle = "rgba(15,25,35,.27)";
    ctx.fillRect(0, 0, W, H);

    panel(3, H / 2 - 145, W - 5, 200);

    drawText("O bebê Theo está com fome,", CONFIG.ui.introTitleFontSize, CONFIG.colors.text, W / 2, H / 2 - 90, true, true);
    drawText("não deixe ele se transformar", CONFIG.ui.introTextFontSize, CONFIG.colors.text, W / 2, H / 2 - 35, true, true);
    drawText("em baby dinossauro.", CONFIG.ui.introTextFontSize, CONFIG.colors.text, W / 2, H / 2 + 15, true, true);

    roundRect(startButton.x, startButton.y, startButton.w, startButton.h, 18, CONFIG.colors.button, CONFIG.colors.buttonBorder, 3);
    drawText("INICIAR", CONFIG.ui.introButtonFontSize, CONFIG.colors.text, W / 2, startButton.y + 30, true, true);

    drawText(
      "ENTER, clique ou toque em INICIAR",
      CONFIG.ui.introInstructionFontSize,
      CONFIG.colors.textSecondary,
      W / 2,
      H / 2 + 205,
      true
    );
  }

  function drawRanking(x, y, w) {
    panel(x, y, w, 36);
    drawText("TOP 10", CONFIG.ui.rankingTitleFontSize, CONFIG.colors.text, x + w / 2, y + 18, true);

    if (!ranking.length) {
      drawText("Nenhuma pontuação ainda", CONFIG.ui.rankingFontSize, CONFIG.colors.textSecondary, x + w / 2, y + 56, true);
      return;
    }

    ranking.slice(0, CONFIG.ranking.maxEntries).forEach((item, index) => {
      const rowY = y + 44 + index * 26;

      roundRect(x, rowY, w, 22, 10, "rgba(18,34,49,.47)");
      drawText(String(index + 1).padStart(2, "0") + ".", CONFIG.ui.rankingFontSize, CONFIG.colors.textSecondary, x + 10, rowY + 11);
      drawText(item.name, CONFIG.ui.rankingFontSize, CONFIG.colors.text, x + 48, rowY + 11);
      drawText(String(item.score), CONFIG.ui.rankingFontSize, CONFIG.colors.text, x + w - 58, rowY + 11);
    });
  }

  function drawEnterName() {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0, 0, W, H);

    panel(30, 110, W - 60, 220);
    drawText("NOVO TOP 10!", CONFIG.ui.titleFontSize, CONFIG.colors.text, W / 2, 145, true, true);
    drawText("Score: " + lastScore, CONFIG.ui.normalFontSize, CONFIG.colors.textSecondary, W / 2, 185, true);
    drawText("Digite seu nome", CONFIG.ui.normalFontSize, CONFIG.colors.text, W / 2, 220, true);

    roundRect(70, 245, W - 140, 52, 12, "#f0f6fc", CONFIG.colors.button, 3);
    drawText(nameText || "_", CONFIG.ui.titleFontSize, CONFIG.colors.textDark, W / 2, 271, true, true);

    drawText("ENTER para confirmar", CONFIG.ui.smallFontSize, CONFIG.colors.textSecondary, W / 2, 315, true);

    panel(35, 360, W - 70, 320);
    drawRanking(50, 378, W - 100);
  }

  function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,.47)";
    ctx.fillRect(0, 0, W, H);

    const dino = img.baby_dino;

    ctx.drawImage(
      dino,
      W / 2 - dino.width * 1.5,
      120 - dino.height * 1.5,
      dino.width * 3,
      dino.height * 3
    );

    panel(30, 220, W - 60, 120);

    drawText("GAME OVER", CONFIG.ui.titleFontSize, CONFIG.colors.text, W / 2, 250, true, true);
    drawText("Score final: " + lastScore, CONFIG.ui.normalFontSize, CONFIG.colors.text, W / 2, 292, true);
    drawText("Aperte R ou toque para reiniciar", CONFIG.ui.smallFontSize, CONFIG.colors.textSecondary, W / 2, 320, true);

    panel(30, 360, W - 60, 340);
    drawRanking(45, 378, W - 90);
  }

  function drawTransform() {
    const progress = Math.min(1, transformTimer / CONFIG.transformation.duration);
    const flickerPhaseEnd = CONFIG.transformation.flickerPhaseEnd;

    const targetX = W / 2;
    const targetY = H / 2 - 40;
    const ease = 1 - Math.pow(1 - progress, 3);

    const currentX = transformStart.x + (targetX - transformStart.x) * ease;
    const currentY = transformStart.y + (targetY - transformStart.y) * ease;

    if (progress < flickerPhaseEnd) {
      const flickerImage = Math.floor(transformTimer / 65) % 2 === 0
        ? img.baby_cry
        : img.baby_dino;

      ctx.fillStyle = "rgba(255,245,200,.43)";
      ctx.beginPath();
      ctx.arc(currentX, currentY, 35 + progress * 120, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(
        flickerImage,
        currentX - flickerImage.width / 2,
        currentY - flickerImage.height / 2
      );

      return;
    }

    const growthProgress = Math.max(
      0,
      Math.min(1, (progress - flickerPhaseEnd) / (1 - flickerPhaseEnd))
    );

    const growthEase = 1 - Math.pow(1 - growthProgress, 3);
    const scale = CONFIG.transformation.startScale +
      (CONFIG.transformation.endScale - CONFIG.transformation.startScale) * growthEase;

    particles.forEach(particle => {
      const angle = particle.angle * Math.PI / 180;

      ctx.fillStyle = `rgba(255,255,255,${particle.alpha / 255})`;
      ctx.beginPath();
      ctx.arc(
        currentX + Math.cos(angle) * particle.radius,
        currentY + Math.sin(angle) * particle.radius,
        particle.size,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    const dino = img.baby_dino;

    ctx.drawImage(
      dino,
      currentX - dino.width * scale / 2,
      currentY - dino.height * scale / 2,
      dino.width * scale,
      dino.height * scale
    );
  }

  // =========================================================
  // DESENHO PRINCIPAL
  // =========================================================
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Tudo dentro deste bloco vai tremer durante a transformação.
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground();

    bottles.forEach(bottle => {
      ctx.drawImage(img.bottle, bottle.rect.x, bottle.rect.y);
    });

    obstacles.forEach(obstacle => {
      ctx.drawImage(obstacle.img, obstacle.rect.x, obstacle.rect.y);
    });

    const playerImage = currentPlayerImg();
    updatePlayerRect();

    if (state === STATES.TRANSFORMING) {
      drawTransform();
    } else if (playerImage) {
      ctx.drawImage(playerImage, playerRect.x, playerRect.y);
    }

    if (state === STATES.PLAYING || state === STATES.TRANSFORMING) {
      drawHud();
    }

    if (state === STATES.INTRO) {
      drawIntro();
    }

    if (state === STATES.ENTER_NAME) {
      drawEnterName();
    }

    if (state === STATES.GAME_OVER) {
      drawGameOver();
    }

    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha / 255})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    // Texto da transformação fora do tremor da tela.
    if (state === STATES.TRANSFORMING) {
      drawText(
        CONFIG.transformation.message,
        CONFIG.transformation.messageFontSize,
        CONFIG.colors.text,
        W / 2,
        CONFIG.transformation.messageY,
        true,
        true
      );
    }
  }

  // =========================================================
  // INPUT / CONTROLES
  // =========================================================
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    const pointer = event.touches ? event.touches[0] : event;

    return {
      x: (pointer.clientX - rect.left) * W / rect.width,
      y: (pointer.clientY - rect.top) * H / rect.height
    };
  }

  function beginGame() {
    unlockAudio();
    startMusic();
    playSound("laugh");

    state = STATES.PLAYING;
    lastSoundState = null;

    hideInput();
  }

  function moveToLane(newLane) {
    if (laneCooldown > 0) {
      return;
    }

    targetLane = Math.max(0, Math.min(2, newLane));
    laneCooldown = CONFIG.gameplay.laneSwitchDelay;
  }

  function tap(pointer) {
    unlockAudio();
    startMusic();

    if (state === STATES.INTRO) {
      const insideButton =
        pointer.x >= startButton.x &&
        pointer.x <= startButton.x + startButton.w &&
        pointer.y >= startButton.y &&
        pointer.y <= startButton.y + startButton.h;

      if (insideButton) {
        beginGame();
      }

      return;
    }

    if (state === STATES.PLAYING) {
      if (pointer.x < W / 2) {
        moveToLane(targetLane - 1);
      } else {
        moveToLane(targetLane + 1);
      }

      return;
    }

    if (state === STATES.GAME_OVER) {
      resetGame();
    }
  }

  async function confirmName() {
    if (state !== STATES.ENTER_NAME) {
      return;
    }

    if (!saved) {
      saved = true;
      await addScore(nameText, lastScore);
    }

    hideInput();
    state = STATES.GAME_OVER;
  }

  function showInput() {
    nameInput.style.display = "block";
    setTimeout(() => nameInput.focus(), 50);
  }

  function hideInput() {
    nameInput.style.display = "none";
    nameInput.blur();
  }

  function setupEvents() {
    canvas.addEventListener("mousemove", event => {
      mouse = point(event);
    });

    canvas.addEventListener("mousedown", event => {
      event.preventDefault();
      tap(point(event));
    });

    canvas.addEventListener("touchstart", event => {
      event.preventDefault();

      const pointer = point(event);
      touchStartX = pointer.x;
      touchStartY = pointer.y;
    }, { passive: false });

    canvas.addEventListener("touchend", event => {
      event.preventDefault();

      if (state !== STATES.PLAYING) {
        tap({ x: touchStartX, y: touchStartY });
        return;
      }

      const touch = event.changedTouches[0];
      const rect = canvas.getBoundingClientRect();

      const endX = (touch.clientX - rect.left) * W / rect.width;
      const deltaX = endX - touchStartX;

      // Toque curto: usa lado esquerdo/direito da tela.
      if (Math.abs(deltaX) < 30) {
        tap({ x: touchStartX, y: touchStartY });
        return;
      }

      // Swipe: arrasta para o lado selecionado
      if (deltaX < -30) {
        moveToLane(targetLane - 1);
      } else if (deltaX > 30) {
        moveToLane(targetLane + 1);
      }
    }, { passive: false });

    window.addEventListener("keydown", event => {
      const key = event.key.length === 1
        ? event.key.toLowerCase()
        : event.key;

      keys.add(key);
      unlockAudio();
      startMusic();

      if (state === STATES.INTRO && (event.key === "Enter" || event.key === " ")) {
        beginGame();
      } else if (state === STATES.GAME_OVER && key === "r") {
        resetGame();
      } else if (state === STATES.ENTER_NAME && (event.key === "Enter" || event.key === "Escape")) {
        confirmName();
      }
    });

    window.addEventListener("keyup", event => {
      const key = event.key.length === 1
        ? event.key.toLowerCase()
        : event.key;

      keys.delete(key);
    });

    nameInput.addEventListener("input", () => {
      nameText = nameInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "")
        .slice(0, CONFIG.ranking.maxNameLength);

      nameInput.value = nameText;
    });

    nameInput.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        confirmName();
      }
    });
  }

  // =========================================================
  // LOOP / BOOT
  // =========================================================
  let last = performance.now();

  function loop(now) {
    const dt = Math.min(CONFIG.gameplay.maxFrameDelta, now - last);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  async function boot() {
    Promise.all(
      Object.entries(imageFiles).map(([name, file]) => loadImage(name, file))
    )
      .then(() => {
        crawlFrames = [
          img.baby_crawl_0,
          img.baby_crawl_1,
          img.baby_crawl_2,
          img.baby_crawl_3
        ];

        angryCrawlFrames = [
          img.baby_angry_crawl_0,
          img.baby_angry_crawl_1,
          img.baby_angry_crawl_2,
          img.baby_angry_crawl_3
        ];

        obstacleImages = [
          img.toy,
          img.log,
          img.cat_white,
          img.cat_black
        ];

        backgroundHeight = img.background.height * (W / img.background.width);

        loadSounds();
        setupEvents();

        ranking = [];
        await loadRanking();
        resetGame();

        loading.style.display = "none";
        requestAnimationFrame(loop);
      })
      .catch(error => {
        console.error(error);
        loading.textContent = "Erro ao carregar assets. Confira se a pasta assets está ao lado do index.html.";
      });
  }

  boot();
})();
