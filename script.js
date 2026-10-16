import * as THREE from 'three';

// ============================================================
// BUG HUNTER 3D — CAMPANHA COM 3 MAPAS EXPLORÁVEIS
// Mapas temáticos, desbloqueio, IA inimiga, cristais, EMP,
// casas para esconder, plataformas elevadas, perigos e chefões.
// ============================================================

const $ = (selector) => document.querySelector(selector);
const gameRoot = $('#game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050814);
scene.fog = new THREE.Fog(0x050814, 45, 145);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 320);
scene.add(camera); // A câmera fica na cena para renderizar o braço em primeira pessoa.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
gameRoot.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xa9c9ff, 0x101020, 2.1);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 2.7);
sunLight.position.set(-12, 28, 16);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
scene.add(sunLight);
const areaLightA = new THREE.PointLight(0x00aaff, 40, 42);
areaLightA.position.set(-18, 8, -15);
scene.add(areaLightA);
const areaLightB = new THREE.PointLight(0x9c35ff, 35, 40);
areaLightB.position.set(22, 8, 22);
scene.add(areaLightB);

const WORLD = { min: -55, max: 55, radius: 55 };
const worldRoot = new THREE.Group();
scene.add(worldRoot);
const mapRoot = new THREE.Group();
worldRoot.add(mapRoot);
const actorsRoot = new THREE.Group();
worldRoot.add(actorsRoot);
let gameType = 'exploracao';
let viewMode = 'third';
let selectedMusic = 'synthwave';
let cameraYaw = 0;
let cameraPitch = 0;
let dashUntil = 0;
let camouflageUntil = 0;
let quickWorldScale = 1;
const colliders = [];
const houses = [];
const crystals = [];
const enemies = [];
const hazards = [];
const movingPlatforms = [];
const infectedComponents = [];
const projectiles = [];
let activeComponent = null;
let activeChallenge = null;
let challengeSelection = -1;
let missionTimeLeft = 0;
let lastMissionTimeShown = -1;
let lastChallengeTimeShown = -1;
let challengeInput = [];
let challengeRevealTimer = null;
let lastShotAt = -10;
const MAX_PULSE_AMMO = 10;
let pulseAmmo = MAX_PULSE_AMMO;
let playerMoving = false;
let firstPersonRecoil = 0;
let shieldCharges = 0;
let playerPlatform = null;
let enemySpawnPoints = [];
let boss = null;
let selectedMap = 'cidade';
let selectedMode = 'medio';
let unlockedMap = 3; // Todos os mapas ficam disponíveis desde o início.
let gameState = 'menu';
let lives = 3;
let score = 0;
let collected = 0;
let powerCharge = 0;
let invulnerableTime = 0;
let hazardCooldown = 0;
let jumpHeight = 0;
let jumpVelocity = 0;
let playerGroundY = 0;
let playerHidden = false;
let walkTime = 0;
let elapsed = 0;
let bossActive = false;
let lastMissionVictory = false;
let messageTimeout = null;

function readStoreValue(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
}
let walletCredits = Number(readStoreValue('bh3d_wallet', 450)) || 0;
let ownedSkins = readStoreValue('bh3d_skins', ['default']);
let equippedSkin = readStoreValue('bh3d_equipped_skin', 'default');
let ownedAbilities = readStoreValue('bh3d_abilities', []);
if (!Array.isArray(ownedSkins)) ownedSkins = ['default'];
if (!Array.isArray(ownedAbilities)) ownedAbilities = [];
if (!ownedSkins.includes('default')) ownedSkins.unshift('default');

const THEMES = {
    cidade: {
        id: 'cidade', shortName: 'CIDADE DIGITAL', name: 'Cidade Digital',
        summary: 'Uma metrópole de servidores, placas-mãe gigantes e plataformas suspensas. Procure o Guardião de Dados.',
        background: 0x050b1b, fog: 0x0b1b31, ground: 0x101d30, gridMain: 0x00eaff, gridSub: 0x203a58,
        accent: 0x00dfff, accent2: 0x9b54ff, hazard: 0x00cfff, crystal: 0x19f0ff, crystalAlt: 0xb25bff,
        enemyBody: 0x7e1a64, enemyDark: 0x261333, enemyEye: 0xff3bb7,
        lightA: 0x00aaff, lightB: 0x9c35ff, bossName: 'GUARDIÃO DE DADOS', hazardName: 'CAMPO ELÉTRICO', powerName: 'PULSO EMP', powerCost: 4, powerDescription: 'Atordoa vírus próximos e causa dano ao guardião. Carrega com 4 cristais.', playerBody: 0x167db5, playerDark: 0x10233d, playerHead: 0x91efff, playerEye: 0x00ffff
    },
    nucleo: {
        id: 'nucleo', shortName: 'NÚCLEO FIREWALL', name: 'Núcleo de Firewall',
        summary: 'Uma zona industrial de reatores, tubulações e plataformas aquecidas. Desvie das áreas de energia e encontre o Reator Alfa.',
        background: 0x16060a, fog: 0x351017, ground: 0x21151b, gridMain: 0xff3f32, gridSub: 0x5c292e,
        accent: 0xff3838, accent2: 0xffc32d, hazard: 0xff3a28, crystal: 0xff6a32, crystalAlt: 0xffe05c,
        enemyBody: 0xffc52f, enemyDark: 0x46210e, enemyEye: 0xff3828,
        lightA: 0xff302b, lightB: 0xffa51c, bossName: 'REATOR ALFA', hazardName: 'ZONA DE CALOR', powerName: 'SOBRECARGA', powerCost: 3, powerDescription: 'Dispara uma arrancada elétrica, concede proteção breve e atordoa vírus no caminho. Carrega com 3 cristais.', playerBody: 0x9a3024, playerDark: 0x321a1a, playerHead: 0xffc33c, playerEye: 0xff4b28
    },
    floresta: {
        id: 'floresta', shortName: 'FLORESTA CORROMPIDA', name: 'Floresta Corrompida',
        summary: 'Ruínas tecnológicas engolidas por raízes digitais, vegetação luminosa e piscinas tóxicas. Encontre a Raiz Corrompida.',
        background: 0x03160d, fog: 0x07351f, ground: 0x0b261a, gridMain: 0x44ff86, gridSub: 0x19472c,
        accent: 0x4cff83, accent2: 0xc6ff40, hazard: 0x82ff22, crystal: 0x5aff9a, crystalAlt: 0xff4566,
        enemyBody: 0xc51e3d, enemyDark: 0x3a1021, enemyEye: 0xff3154,
        lightA: 0x20ff80, lightB: 0x9cff28, bossName: 'RAIZ CORROMPIDA', hazardName: 'PISCINA TÓXICA', powerName: 'CAMUFLAGEM VIVA', powerCost: 5, powerDescription: 'Fica invisível para os vírus por alguns segundos e recupera uma vida. Carrega com 5 cristais.', playerBody: 0x267b4c, playerDark: 0x102d20, playerHead: 0xb0ffb8, playerEye: 0xff3558
    },
    computador: {
        id: 'computador', shortName: 'INTERIOR DO COMPUTADOR', name: 'Interior do Computador',
        summary: 'Explore uma placa-mãe em escala gigante, encontre componentes infectados e resolva protocolos para remover os vírus.',
        background: 0x020712, fog: 0x07182a, ground: 0x102338, gridMain: 0x164c68, gridSub: 0x0c273b,
        accent: 0x24e8ff, accent2: 0xb153ff, hazard: 0xff425f, crystal: 0x45f2ff, crystalAlt: 0xff4c86,
        enemyBody: 0xb3244a, enemyDark: 0x241426, enemyEye: 0xff356e,
        lightA: 0x00bff8, lightB: 0x8a37ff, bossName: 'NÚCLEO MALWARE', hazardName: 'DESCARGA ELÉTRICA', powerName: 'PULSO DE ISOLAMENTO', powerCost: 10,
        powerDescription: 'Atordoa os vírus que estiverem perto enquanto você procura os componentes infectados.',
        playerBody: 0x167db5, playerDark: 0x10233d, playerHead: 0x91efff, playerEye: 0x00ffff
    }
};
let theme = THEMES.cidade;

const MODES = {
    facil: { name: 'FÁCIL', lives: 4, goal: 12, enemyCount: 8, speed: 3.0, aggro: 13, bossHp: 3, summary: '12 cristais, 8 vírus e um guardião. 4 vidas para explorar.' },
    medio: { name: 'MÉDIO', lives: 3, goal: 20, enemyCount: 12, speed: 3.8, aggro: 18, bossHp: 5, summary: '20 cristais, 12 vírus e um guardião reforçado. Fique em movimento.' },
    dificil: { name: 'DIFÍCIL', lives: 2, goal: 28, enemyCount: 16, speed: 4.6, aggro: 24, bossHp: 7, summary: '28 cristais, 16 vírus e um guardião brutal. Apenas 2 vidas.' }
};

// Elementos da interface
const startScreen = $('#start-screen');
const pauseScreen = $('#pause-screen');
const endScreen = $('#end-screen');
const hud = $('#hud');
const mapSummary = $('#map-summary');
const modeSummary = $('#mode-summary');
const hudMode = $('#hud-mode');
const hudFragments = $('#hud-fragments');
const hudScore = $('#hud-score');
const hudLives = $('#hud-lives');
const powerCount = $('#power-count');
const powerFill = $('#power-fill');
const powerButton = $('#power-button');
const stealthStatus = $('#stealth-status');
const bossPanel = $('#boss-panel');
const bossName = $('#boss-name');
const bossHealthText = $('#boss-health-text');
const bossHealthFill = $('#boss-health-fill');
const eventMessage = $('#event-message');
const volumeSlider = $('#volume-slider');
const powerTitle = $('#power-title');
const powerHelp = $('#power-help');
const ammoCount = $('#ammo-count');
const attackButton = $('#attack-button');
const cameraToggle = $('#camera-toggle');
const reticle = $('#first-person-reticle');
const gameTypeSummary = $('#game-type-summary');
const interactionPrompt = $('#interaction-prompt');
const interactionTitle = $('#interaction-title');
const interactionDescription = $('#interaction-description');
const interactButton = $('#interact-button');
const challengeScreen = $('#challenge-screen');
const challengeTitle = $('#challenge-title');
const challengeDescription = $('#challenge-description');
const challengeTarget = $('#challenge-target');
const challengeOptions = $('#challenge-options');
const challengeFeedback = $('#challenge-feedback');
const challengeSubmit = $('#challenge-submit');
const shopScreen = $('#shop-screen');
const shopSkins = $('#shop-skins');
const shopAbilities = $('#shop-abilities');
const shopFeedback = $('#shop-feedback');
const challengeCancel = $('#challenge-cancel');
const challengeTimer = $('#challenge-timer');
const missionTimeBox = $('#mission-time-box');
const missionTimeText = $('#mission-time');
const minimapPanel = $('#minimap-panel');
const minimapCanvas = $('#minimap-canvas');
const minimapContext = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const minimapThreatCount = $('#minimap-threat-count');

// Jogador. A raiz move-se pelo mundo; o modelo interno pode animar braços e pernas.
const player = new THREE.Group();
const playerModel = new THREE.Group();
player.add(playerModel);
actorsRoot.add(player);

// Braço robótico em primeira pessoa, preso à câmera como em um FPS voxel.
const firstPersonArm = new THREE.Group();
firstPersonArm.name = 'BracoPrimeiraPessoa';
camera.add(firstPersonArm);
const fpArmor = new THREE.MeshStandardMaterial({ color: 0x168ab8, metalness: .58, roughness: .3, emissive: 0x063d56, emissiveIntensity: .65 });
const fpDark = new THREE.MeshStandardMaterial({ color: 0x122337, metalness: .72, roughness: .32 });
const fpGlow = new THREE.MeshStandardMaterial({ color: 0x4df5ff, emissive: 0x00cfff, emissiveIntensity: 2.2, metalness: .25, roughness: .2 });
const fpHand = new THREE.MeshStandardMaterial({ color: 0x274963, metalness: .35, roughness: .55 });
function addFirstPersonPiece(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    firstPersonArm.add(mesh); return mesh;
}
addFirstPersonPiece(new THREE.BoxGeometry(.29, .48, .33), fpArmor, .48, -.48, -.58, -.16, -.08, -.20);
addFirstPersonPiece(new THREE.BoxGeometry(.34, .13, .34), fpDark, .47, -.31, -.74, -.12, -.06, -.16);
addFirstPersonPiece(new THREE.BoxGeometry(.28, .22, .23), fpHand, .43, -.205, -.84, -.12, -.08, -.13);
addFirstPersonPiece(new THREE.BoxGeometry(.095, .17, .14), fpHand, .285, -.22, -.83, 0, 0, -.32);
for (let i = 0; i < 3; i++) addFirstPersonPiece(new THREE.BoxGeometry(.065, .09, .09), fpDark, .355 + i * .075, -.235, -.95, 0, 0, -.08);
addFirstPersonPiece(new THREE.BoxGeometry(.20, .12, .38), fpDark, .46, -.105, -.91, -.05, 0, -.04);
addFirstPersonPiece(new THREE.BoxGeometry(.15, .07, .15), fpGlow, .46, -.11, -1.11);
addFirstPersonPiece(new THREE.BoxGeometry(.05, .035, .22), fpGlow, .46, -.035, -.91);
// Detalhes extras do braço/emissor: juntas, placas e boca luminosa.
addFirstPersonPiece(new THREE.BoxGeometry(.24,.08,.28), fpArmor, .47, -.38, -.72, -.1, -.05, -.16);
addFirstPersonPiece(new THREE.BoxGeometry(.075,.10,.20), fpGlow, .31, -.22, -.91, 0, 0, -.22);
addFirstPersonPiece(new THREE.BoxGeometry(.075,.10,.20), fpGlow, .53, -.22, -.91, 0, 0, -.08);
addFirstPersonPiece(new THREE.CylinderGeometry(.11,.13,.12,12), fpDark, .46, -.09, -1.04, Math.PI/2, 0, 0);
addFirstPersonPiece(new THREE.CylinderGeometry(.065,.065,.13,12), fpGlow, .46, -.09, -1.12, Math.PI/2, 0, 0);
firstPersonArm.visible = false;
const playerMetal = new THREE.MeshStandardMaterial({ color: 0x167db5, metalness: 0.68, roughness: 0.28, emissive: 0x06314b, emissiveIntensity: 0.25 });
const playerDark = new THREE.MeshStandardMaterial({ color: 0x10233d, metalness: 0.7, roughness: 0.33 });
const playerHeadMat = new THREE.MeshStandardMaterial({ color: 0x91efff, metalness: 0.45, roughness: 0.25, emissive: 0x087ca2, emissiveIntensity: 0.5 });
const playerEyeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00cfff, emissiveIntensity: 2.2 });
function addPlayerPiece(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    playerModel.add(mesh);
    return mesh;
}
addPlayerPiece(new THREE.BoxGeometry(0.82, 0.82, 0.58), playerMetal, 0, 1.05, 0);
addPlayerPiece(new THREE.SphereGeometry(0.4, 24, 20), playerHeadMat, 0, 1.68, 0);
addPlayerPiece(new THREE.BoxGeometry(0.48, 0.14, 0.08), playerEyeMat, 0, 1.7, -0.37);
addPlayerPiece(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), playerDark, 0, 2.12, 0);
addPlayerPiece(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00ffb3 }), 0, 2.25, 0);
const playerArms = [];
const playerLegs = [];
for (const side of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.53, 1.28, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.25), playerDark);
    arm.position.y = -0.29; arm.castShadow = true; armPivot.add(arm); playerModel.add(armPivot);
    playerArms.push({ pivot: armPivot, side });
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.22, 0.58, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.29), playerDark);
    leg.position.y = -0.25; leg.castShadow = true; legPivot.add(leg); playerModel.add(legPivot);
    playerLegs.push({ pivot: legPivot, side });
}
// Peças adicionais de armadura: placa peitoral, ombreiras, joelheiras, botas e mochila técnica.
addPlayerPiece(new THREE.BoxGeometry(.56,.42,.11), playerDark, 0, 1.08, -.326);
addPlayerPiece(new THREE.BoxGeometry(.30,.12,.055), playerEyeMat, 0, 1.18, -.39);
addPlayerPiece(new THREE.BoxGeometry(.46,.12,.10), playerMetal, 0, .83, -.31);
for (const side of [-1,1]) {
    const shoulder = addPlayerPiece(new THREE.SphereGeometry(.235,16,12), playerMetal, side*.56, 1.40, 0);
    shoulder.scale.set(1.08,.78,1.05);
    addPlayerPiece(new THREE.BoxGeometry(.30,.22,.31), playerMetal, side*.22, .43, -.025);
    addPlayerPiece(new THREE.BoxGeometry(.34,.16,.40), playerDark, side*.22, .12, -.075);
    addPlayerPiece(new THREE.BoxGeometry(.10,.32,.08), playerEyeMat, side*.53, 1.26, -.15);
}
addPlayerPiece(new THREE.BoxGeometry(.52,.49,.30), playerDark, 0, 1.24, .39);
addPlayerPiece(new THREE.BoxGeometry(.35,.30,.08), playerMetal, 0, 1.24, .57);
for (let vent=0; vent<4; vent++) addPlayerPiece(new THREE.BoxGeometry(.06,.25,.025), playerEyeMat, -.15+vent*.10, 1.24, .62);
const playerRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: 0x00eaff }));
playerRing.rotation.x = Math.PI / 2; playerRing.position.y = 0.07; playerModel.add(playerRing);
player.position.set(0, 0, 0);
const playerThemeExtras = [];
function clearPlayerThemeExtras() {
    for (const part of playerThemeExtras) {
        playerModel.remove(part);
        part.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const list = Array.isArray(child.material) ? child.material : [child.material];
                list.forEach(material => material.dispose());
            }
        });
    }
    playerThemeExtras.length = 0;
}
function addPlayerThemeExtra(geometry, material, x, y, z, rotZ = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.rotation.z = rotZ; mesh.castShadow = true;
    playerModel.add(mesh); playerThemeExtras.push(mesh); return mesh;
}
function applyPlayerThemeStyle() {
    playerMetal.color.setHex(theme.playerBody); playerMetal.emissive.setHex(theme.accent);
    playerDark.color.setHex(theme.playerDark); playerHeadMat.color.setHex(theme.playerHead);
    playerHeadMat.emissive.setHex(theme.accent); playerEyeMat.color.setHex(theme.playerEye);
    playerEyeMat.emissive.setHex(theme.playerEye); playerRing.material.color.setHex(theme.accent);
    clearPlayerThemeExtras();
    if (theme.id === 'nucleo') {
        const armor = new THREE.MeshStandardMaterial({color:0x4a211e, metalness:.8, roughness:.3, emissive:0x81251d, emissiveIntensity:.55});
        addPlayerThemeExtra(new THREE.BoxGeometry(.43,.34,.48), armor, -.53, 1.44, 0, -.12);
        addPlayerThemeExtra(new THREE.BoxGeometry(.43,.34,.48), armor, .53, 1.44, 0, .12);
        addPlayerThemeExtra(new THREE.ConeGeometry(.18,.45,6), new THREE.MeshStandardMaterial({color:theme.accent2,emissive:theme.accent2,emissiveIntensity:1}), 0, 2.12, .23);
        addPlayerThemeExtra(new THREE.BoxGeometry(.55,.18,.2), armor, 0, .9, .36);
    } else if (theme.id === 'floresta') {
        const leaf = new THREE.MeshStandardMaterial({color:0x38a95b,emissive:0x155b30,emissiveIntensity:.6,roughness:.65});
        addPlayerThemeExtra(new THREE.ConeGeometry(.19,.62,5), leaf, -.38, 1.72, .12, -.38);
        addPlayerThemeExtra(new THREE.ConeGeometry(.19,.62,5), leaf, .38, 1.72, .12, .38);
        addPlayerThemeExtra(new THREE.TorusGeometry(.48,.07,7,22), new THREE.MeshStandardMaterial({color:0x9cff79,emissive:0x30ff68,emissiveIntensity:.75}), 0, 1.05, .2, Math.PI/2);
        addPlayerThemeExtra(new THREE.OctahedronGeometry(.15), new THREE.MeshStandardMaterial({color:0xff3558,emissive:0xff173f,emissiveIntensity:1.5}), 0, 2.28, .04);
    } else {
        const neon = new THREE.MeshStandardMaterial({color:0x00eaff,emissive:0x00cfff,emissiveIntensity:1.8,metalness:.35});
        addPlayerThemeExtra(new THREE.BoxGeometry(.13,.45,.12), neon, -.37, 1.45, .3, -.25);
        addPlayerThemeExtra(new THREE.BoxGeometry(.13,.45,.12), neon, .37, 1.45, .3, .25);
    }
    applyEquippedSkin();
    playerModel.visible = viewMode !== 'first' && elapsed >= camouflageUntil;
}

const SKINS = [
    { id: 'default', name: 'Operador padrão', price: 0, body: null, eye: null, ring: null, desc: 'A armadura original da zona selecionada.' },
    { id: 'nebula', name: 'Nebulosa', price: 350, body: 0x50318e, eye: 0xff8cf4, ring: 0xd58cff, desc: 'Armadura roxa com visor rosa luminoso.' },
    { id: 'solar', name: 'Solar', price: 500, body: 0xa85d17, eye: 0xffe070, ring: 0xffa53b, desc: 'Revestimento dourado para ambientes perigosos.' },
    { id: 'arctic', name: 'Ártico', price: 650, body: 0x75baca, eye: 0xe8ffff, ring: 0x83f1ff, desc: 'Blindagem gelada e luzes cristalinas.' },
    { id: 'bio', name: 'BioCircuito', price: 800, body: 0x4c8b2a, eye: 0xd7ff63, ring: 0x8cff68, desc: 'Uma aparência bio-digital para exploradores.' }
];
const ABILITIES = [
    { id: 'thrusters', name: 'Propulsores', price: 550, desc: 'Aumenta a velocidade de movimento em 18% em todos os mapas.' },
    { id: 'capacitor', name: 'Capacitor eficiente', price: 650, desc: 'Reduz em 1 cristal a carga necessária para seu poder (mínimo de 2).' },
    { id: 'shield', name: 'Escudo de emergência', price: 700, desc: 'Absorve o primeiro dano recebido em cada missão.' },
    { id: 'amplifier', name: 'Amplificador de pulso', price: 850, desc: 'Seus disparos causam dano dobrado aos robôs-vírus.' }
];
function persistShop() {
    try {
        localStorage.setItem('bh3d_wallet', JSON.stringify(walletCredits));
        localStorage.setItem('bh3d_skins', JSON.stringify(ownedSkins));
        localStorage.setItem('bh3d_equipped_skin', JSON.stringify(equippedSkin));
        localStorage.setItem('bh3d_abilities', JSON.stringify(ownedAbilities));
    } catch { /* O jogo continua sem armazenamento local. */ }
    const menuWallet = $('#menu-wallet');
    if (menuWallet) menuWallet.textContent = walletCredits.toLocaleString('pt-BR');
    const shopWallet = $('#shop-wallet');
    if (shopWallet) shopWallet.textContent = walletCredits.toLocaleString('pt-BR');
}
function addCredits(amount) {
    walletCredits += Math.max(0, Math.floor(amount));
    persistShop();
}
function effectivePowerCost() {
    return Math.max(2, theme.powerCost - (ownedAbilities.includes('capacitor') ? 1 : 0));
}
function applyEquippedSkin() {
    const skin = SKINS.find(item => item.id === equippedSkin);
    if (!skin || skin.id === 'default') return;
    playerMetal.color.setHex(skin.body);
    playerMetal.emissive.setHex(skin.ring);
    playerHeadMat.color.setHex(skin.eye);
    playerHeadMat.emissive.setHex(skin.eye);
    playerEyeMat.color.setHex(skin.eye);
    playerEyeMat.emissive.setHex(skin.eye);
    playerRing.material.color.setHex(skin.ring);
}

// Efeitos EMP e áudio sintetizado pelo navegador
const empPulse = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.075, 8, 56), new THREE.MeshBasicMaterial({ color: 0x6fffff, transparent: true, opacity: 0.9 }));
empPulse.rotation.x = Math.PI / 2; empPulse.visible = false; empPulse.userData.life = 0; actorsRoot.add(empPulse);
let audioContext = null, masterGain = null, musicInterval = null, musicIndex = 0, musicMode = null;
function prepareAudio() {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) return;
    if (!audioContext) {
        audioContext = new AudioClass(); masterGain = audioContext.createGain();
        masterGain.gain.value = Number(volumeSlider.value) / 100; masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') audioContext.resume();
}
function tone(freq, duration = 0.12, type = 'sine', volume = 0.1) {
    if (!audioContext || !masterGain) return;
    const osc = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    osc.type = type; osc.frequency.setValueAtTime(freq, now); gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); osc.connect(gain); gain.connect(masterGain); osc.start(); osc.stop(now + duration);
}
function soundCollect() { tone(660, .1, 'sine', .16); setTimeout(() => tone(990, .13, 'sine', .13), 70); }
function soundDamage() { tone(140, .25, 'sawtooth', .2); tone(90, .28, 'square', .08); }
function soundButton() { tone(440, .07, 'square', .05); }
function soundPower() { [240, 390, 640, 900].forEach((n, i) => setTimeout(() => tone(n, .2, 'sawtooth', .09), i * 55)); }
function soundVictory() { [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => setTimeout(() => tone(n, .2, 'sine', .14), i * 140)); }
function soundDefeat() { [330, 260, 196, 130].forEach((n, i) => setTimeout(() => tone(n, .23, 'triangle', .13), i * 170)); }
function startMusic() {
    if (!audioContext) return;
    if (musicInterval !== null && musicMode === 'game') return;
    stopMusic();
    const tracks = {
        synthwave: { notes:[110,164.81,220,164.81,98,146.83,196,146.83], type:'triangle', interval:320, volume:.024 },
        industrial: { notes:[82.41,82.41,123.47,98,73.42,110,92.5,73.42], type:'square', interval:245, volume:.018 },
        wild: { notes:[146.83,174.61,220,293.66,220,174.61,164.81,130.81], type:'sine', interval:390, volume:.03 }
    };
    const track = tracks[selectedMusic] || tracks.synthwave;
    musicIndex = 0;
    musicMode = 'game';
    musicInterval = setInterval(() => {
        if (gameState !== 'playing') return;
        const note = track.notes[musicIndex % track.notes.length];
        tone(note, .28, track.type, track.volume);
        if (musicIndex % 4 === 0) tone(note / 2, .26, 'sine', .018);
        if (selectedMusic === 'industrial' && musicIndex % 2 === 0) tone(55, .12, 'sawtooth', .018);
        musicIndex++;
    }, track.interval);
}
function startLobbyMusic() {
    if (!audioContext || gameState !== 'menu') return;
    if (musicInterval !== null && musicMode === 'lobby') return;
    stopMusic();
    // Trilha contínua para o lobby: arpejo futurista, subgrave suave e pulsos digitais.
    const patterns = {
        synthwave: [110,164.81,220,329.63,246.94,164.81,196,293.66],
        industrial: [82.41,123.47,92.5,138.59,73.42,110,98,146.83],
        wild: [146.83,220,174.61,261.63,196,293.66,220,329.63]
    };
    const notes = patterns[selectedMusic] || patterns.synthwave;
    let step = 0;
    musicMode = 'lobby';
    musicInterval = setInterval(() => {
        if (gameState !== 'menu') return;
        const note = notes[step % notes.length];
        tone(note, .22, selectedMusic === 'industrial' ? 'square' : 'triangle', .017);
        if (step % 2 === 0) tone(note * 2, .16, 'sine', .009);
        if (step % 4 === 0) tone(note / 2, .3, 'sawtooth', .012);
        step++;
    }, 185);
}
function stopMusic() { if (musicInterval !== null) { clearInterval(musicInterval); musicInterval = null; } musicMode = null; }
// A política de autoplay exige uma interação humana; o primeiro clique no lobby habilita a trilha.
startScreen.addEventListener('pointerdown', () => {
    prepareAudio();
    if (gameState === 'menu') startLobbyMusic();
}, { passive: true });
volumeSlider.addEventListener('input', () => {
    if (audioContext && masterGain) masterGain.gain.setTargetAtTime(Number(volumeSlider.value) / 100, audioContext.currentTime, .03);
});

function readUnlockedMap() { return 3; }
function currentRules() {
    const base = MODES[selectedMode];
    if (gameType !== 'rapido') return base;
    const quick = {
        facil: { goal:6, enemyCount:4, bossHp:2 },
        medio: { goal:9, enemyCount:6, bossHp:3 },
        dificil: { goal:12, enemyCount:8, bossHp:4 }
    }[selectedMode];
    return { ...base, ...quick, speed: base.speed * 1.08, aggro: base.aggro * .92,
        summary: `Jogo rápido: ${quick.goal} cristais, ${quick.enemyCount} vírus e mapa compacto.` };
}
function saveUnlockedMap() {
    try { localStorage.setItem('bugHunterUnlockedMap', String(unlockedMap)); } catch { /* O jogo continua funcionando sem armazenamento. */ }
}
function mapIndex(id) { return ['cidade', 'nucleo', 'floresta'].indexOf(id); }
function showEvent(message, color = '#ff4869') {
    eventMessage.textContent = message;
    eventMessage.style.borderColor = color;
    eventMessage.style.boxShadow = `0 0 24px ${color}44`;
    eventMessage.classList.remove('hidden');
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => eventMessage.classList.add('hidden'), 3000);
}

function clearProjectiles() {
    while (projectiles.length) {
        const shot = projectiles.pop();
        actorsRoot.remove(shot.mesh);
        shot.mesh.geometry.dispose();
        shot.mesh.material.dispose();
    }
}
function clearMap() {
    clearProjectiles();
    infectedComponents.length = 0;
    activeComponent = null; activeChallenge = null;
    mapRoot.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => material.dispose());
        }
    });
    mapRoot.clear();
    colliders.length = 0; houses.length = 0; crystals.length = 0; enemies.length = 0; hazards.length = 0; movingPlatforms.length = 0;
    enemySpawnPoints = []; boss = null; bossActive = false; playerPlatform = null;
}
function addBox(x, y, z, w, h, d, color, options = {}) {
    const material = new THREE.MeshStandardMaterial({
        color, roughness: options.roughness ?? .48, metalness: options.metalness ?? .35,
        emissive: options.emissive ?? 0x000000, emissiveIntensity: options.emissiveIntensity ?? .15,
        transparent: options.transparent ?? false, opacity: options.opacity ?? 1, wireframe: options.wireframe ?? false
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = options.castShadow ?? true; mesh.receiveShadow = true; mapRoot.add(mesh);
    if (options.solid) colliders.push({ x, z, w, d, floorY: options.floorY ?? 0 });
    return mesh;
}
function addCylinder(x, z, radius, height, color, options = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * (options.topScale ?? 1), radius, height, options.segments ?? 18), new THREE.MeshStandardMaterial({ color, metalness: options.metalness ?? .5, roughness: .38, emissive: options.emissive ?? 0, emissiveIntensity: options.emissiveIntensity ?? .2 }));
    mesh.position.set(x, (options.floorY ?? 0) + height / 2, z); mesh.castShadow = true; mapRoot.add(mesh);
    if (options.solid) colliders.push({ x, z, w: radius * 1.7, d: radius * 1.7, floorY: options.floorY ?? 0 });
    return mesh;
}
function addTorus(parent, radius, tube, color, x, y, z, rotationX = 0, rotationY = 0, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 28), new THREE.MeshStandardMaterial({ color, emissive: opts.emissive ?? color, emissiveIntensity: opts.emissiveIntensity ?? 1.1, metalness: .3, roughness: .25, transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1 }));
    mesh.position.set(x, y, z); mesh.rotation.set(rotationX, rotationY, 0); parent.add(mesh); return mesh;
}

// Piso elevado comum aos três mundos, com rampa acessível.
const upperPlatform = { minX: 22, maxX: 38, minZ: -38, maxZ: -24, y: 3 };
const rampArea = { minX: 25, maxX: 31, minZ: -24, maxZ: -12, height: 3 };
const upperPlatformB = { minX: 5, maxX: 21, minZ: 26, maxZ: 42, y: 5 };
const rampAreaB = { minX: 9, maxX: 15, minZ: 8, maxZ: 26, height: 5 };
function computerFloorHeightAt(x, z) {
    // Quatro rampas em zigue-zague conectam a base a quatro compartimentos.
    // Os patamares ficam em zonas separadas para não haver saltos instantâneos entre andares.
    if (x >= 14 && x <= 20 && z >= -44 && z <= -26) return 24 + ((-26 - z) / 18) * 8;
    if (x >= 14 && x <= 20 && z >= -26 && z <= -7) return 15 + ((-7 - z) / 19) * 9;
    if (x >= 8 && x <= 14 && z >= 5 && z <= 23) return 7 + ((23 - z) / 18) * 8;
    if (x >= -24 && x <= -18 && z >= 20 && z <= 42) return ((42 - z) / 22) * 7;
    if (x >= 20 && x <= 42 && z >= -48 && z <= -39) return 32;
    if (x >= -30 && x <= 17 && z >= -46 && z <= -26) return 24;
    if (x >= 14 && x <= 40 && z >= -26 && z <= 5) return 15;
    if (x >= -40 && x <= 8 && z >= -10 && z <= 25) return 7;
    return 0;
}
function floorHeightAt(x, z) {
    if (gameType === 'desinfeccao') return computerFloorHeightAt(x, z);
    if (x >= upperPlatformB.minX && x <= upperPlatformB.maxX && z >= upperPlatformB.minZ && z <= upperPlatformB.maxZ) return upperPlatformB.y;
    if (x >= rampAreaB.minX && x <= rampAreaB.maxX && z >= rampAreaB.minZ && z <= rampAreaB.maxZ) return THREE.MathUtils.clamp(((z - 8) / 18) * rampAreaB.height, 0, rampAreaB.height);
    if (x >= upperPlatform.minX && x <= upperPlatform.maxX && z >= upperPlatform.minZ && z <= upperPlatform.maxZ) return upperPlatform.y;
    if (x >= rampArea.minX && x <= rampArea.maxX && z >= rampArea.minZ && z <= rampArea.maxZ) return THREE.MathUtils.clamp(((-z - 12) / 12) * rampArea.height, 0, rampArea.height);
    return 0;
}
function isRampSurfaceAt(x, z) {
    if (gameType === 'desinfeccao') {
        return (
            (x >= 14 && x <= 20 && z >= -44 && z <= -26) ||
            (x >= 14 && x <= 20 && z >= -26 && z <= -7) ||
            (x >= 8 && x <= 14 && z >= 5 && z <= 23) ||
            (x >= -24 && x <= -18 && z >= 20 && z <= 42)
        );
    }
    return (
        (x >= rampArea.minX && x <= rampArea.maxX && z >= rampArea.minZ && z <= rampArea.maxZ) ||
        (x >= rampAreaB.minX && x <= rampAreaB.maxX && z >= rampAreaB.minZ && z <= rampAreaB.maxZ)
    );
}
function playerFloorHeightAt(x, z, currentGroundY, currentFootY = currentGroundY) {
    // Nunca teletransporta o jogador para uma plataforma só por passar sob seu retângulo.
    // A subida automática só ocorre em uma rampa válida e com incremento pequeno por quadro.
    // Uma plataforma elevada também pode ser alcançada ao pousar sobre ela depois de um salto.
    const candidate = floorHeightAt(x, z);
    const rising = candidate > currentGroundY + 0.32;
    if (!rising) return candidate;

    const landingFromAbove = currentFootY >= candidate - 0.12;
    if (landingFromAbove) return candidate;

    const onRamp = isRampSurfaceAt(x, z);
    if (onRamp && candidate - currentGroundY <= 0.34) return candidate;

    // Em todos os outros casos, mantém o piso atual: a face inferior não vira um chão.
    return currentGroundY;
}
function playerCeilingAt(x, z, currentFloorY) {
    // Faces inferiores de plataformas estáticas. Só contam como teto se o jogador estiver
    // abaixo delas; assim é possível passar sob a estrutura sem ser colocado no andar superior.
    if (gameType === 'desinfeccao') {
        const pcPlatforms = [
            { minX: -40, maxX: 8, minZ: -10, maxZ: 25, underside: 6.24 },
            { minX: 14, maxX: 40, minZ: -26, maxZ: 5, underside: 14.24 },
            { minX: -30, maxX: 17, minZ: -46, maxZ: -26, underside: 23.24 },
            { minX: 20, maxX: 42, minZ: -48, maxZ: -39, underside: 31.24 }
        ];
        for (const p of pcPlatforms) {
            if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && currentFloorY < p.underside - 0.35) return p.underside;
        }
    } else {
        if (x >= 22 && x <= 38 && z >= -38 && z <= -24 && currentFloorY < 2.6 - .35) return 2.6;
        if (x >= 5 && x <= 21 && z >= 26 && z <= 42 && currentFloorY < 4.6 - .35) return 4.6;
    }
    return Infinity;
}
function isBlocked(x, z, level, radius = .38) {
    if (x < WORLD.min + radius || x > WORLD.max - radius || z < WORLD.min + radius || z > WORLD.max - radius) return true;
    for (const box of colliders) {
        // A colisão é verificada no piso em que o personagem realmente está, não no andar
        // que poderia estar acima dele. Isso mantém as paredes ativas ao caminhar sob passarelas.
        if (Math.abs(box.floorY - level) > .8) continue;
        if (Math.abs(x - box.x) < box.w / 2 + radius && Math.abs(z - box.z) < box.d / 2 + radius) return true;
    }
    return false;
}
function computerRampSideBlocked(fromX, z, toX) {
    if (gameType !== 'desinfeccao' || Math.abs(toX - fromX) < 0.0001) return false;
    const ramps = [
        { minX: -24, maxX: -18, minZ: 20, maxZ: 42 },
        { minX: 8, maxX: 14, minZ: 5, maxZ: 23 },
        { minX: 14, maxX: 20, minZ: -26, maxZ: -7 },
        { minX: 14, maxX: 20, minZ: -44, maxZ: -26 }
    ];
    for (const ramp of ramps) {
        const wasInside = fromX >= ramp.minX && fromX <= ramp.maxX;
        const willBeInside = toX >= ramp.minX && toX <= ramp.maxX;
        const alongRamp = z > ramp.minZ + .75 && z < ramp.maxZ - .75;
        // Entradas laterais ficam bloqueadas: o jogador precisa chegar ao pé/topo da rampa.
        if (wasInside !== willBeInside && alongRamp) return true;
    }
    return false;
}
function moveActor(actor, dx, dz, radius = .36) {
    const oldX = actor.position.x;
    const nextX = THREE.MathUtils.clamp(actor.position.x + dx, WORLD.min + 1.5, WORLD.max - 1.5);
    const xLevel = actor === player ? playerGroundY : floorHeightAt(nextX, actor.position.z);
    if (!computerRampSideBlocked(oldX, actor.position.z, nextX) && !isBlocked(nextX, actor.position.z, xLevel, radius)) actor.position.x = nextX;
    const nextZ = THREE.MathUtils.clamp(actor.position.z + dz, WORLD.min + 1.5, WORLD.max - 1.5);
    const zLevel = actor === player ? playerGroundY : floorHeightAt(actor.position.x, nextZ);
    if (!isBlocked(actor.position.x, nextZ, zLevel, radius)) actor.position.z = nextZ;
    return actor.position;
}

function createComputerTower(x, z, scale = 1, floorY = 0) {
    const w = 1.9 * scale, h = 3.0 * scale, d = 1.65 * scale;
    addBox(x, floorY + h / 2, z, w, h, d, 0x17283e, { solid: true, floorY, metalness: .82, emissive: 0x061629 });
    addBox(x, floorY + h * .53, z + d / 2 + .035, w * .76, h * .56, .08, 0x101b2b, { emissive: theme.accent, emissiveIntensity: .4 });
    for (let i = 0; i < 3; i++) {
        const fanY = floorY + h * (.30 + i * .23);
        addTorus(mapRoot, .28 * scale, .045 * scale, theme.accent, x, fanY, z + d / 2 + .09, 0, 0, { emissiveIntensity: 1.8 });
        const hub = new THREE.Mesh(new THREE.CircleGeometry(.11 * scale, 14), new THREE.MeshBasicMaterial({ color: theme.accent2 }));
        hub.position.set(x, fanY, z + d / 2 + .105); mapRoot.add(hub);
    }
    for (let i = 0; i < 4; i++) addBox(x - w * .3 + i * w * .2, floorY + h * .89, z + d / 2 + .08, .10 * scale, .05 * scale, .04, i % 2 ? theme.accent2 : theme.accent, { emissive: theme.accent, emissiveIntensity: 1.6, castShadow: false });
}
function createMonitorStation(x, z, scale = 1, floorY = 0) {
    addBox(x, floorY + .68 * scale, z, .38 * scale, 1.35 * scale, .36 * scale, 0x263950, { solid: true, floorY, metalness: .7 });
    addBox(x, floorY + 1.62 * scale, z, 2.5 * scale, 1.5 * scale, .3 * scale, 0x17283d, { solid: true, floorY, metalness: .7 });
    addBox(x, floorY + 1.63 * scale, z + .17 * scale, 2.17 * scale, 1.2 * scale, .04, theme.id === 'nucleo' ? 0x461517 : theme.id === 'floresta' ? 0x123d22 : 0x06304a, { emissive: theme.accent, emissiveIntensity: .7 });
    for (let i = 0; i < 4; i++) addBox(x - .65 * scale, floorY + (1.25 + i * .2) * scale, z + .2 * scale, (.65 + (i % 2) * .35) * scale, .035 * scale, .025, i === 2 ? theme.accent2 : theme.accent, { emissive: theme.accent, emissiveIntensity: 1.3, castShadow: false });
    addBox(x, floorY + .12 * scale, z + .63 * scale, 2 * scale, .18 * scale, .72 * scale, 0x263b54, { solid: true, floorY, metalness: .55 });
    for (let i = 0; i < 7; i++) addBox(x - .7 * scale + i * .22 * scale, floorY + .22 * scale, z + .48 * scale, .1 * scale, .025 * scale, .1 * scale, theme.accent2, { castShadow: false });
}
function createCitySkyscraper(x, z, width, height, depth, index = 0) {
    // Arranha-céu oco: as paredes deixam uma entrada livre na face frontal (+Z).
    // As fachadas representam vários andares; as passarelas/rampas do mapa dão acesso às áreas elevadas.
    const bodyColor = index % 2 ? 0x152c45 : 0x1b3148;
    const wall = 0.48;
    const doorW = Math.min(2.55, width * 0.42);
    const frontZ = z + depth / 2 - wall / 2;
    const sideW = Math.max(wall, (width - doorW) / 2);

    // Paredes laterais e parede traseira.
    addBox(x - width / 2 + wall / 2, height / 2, z, wall, height, depth, bodyColor, { solid: true, floorY: 0, metalness: .72, emissive: theme.accent, emissiveIntensity: .12 });
    addBox(x + width / 2 - wall / 2, height / 2, z, wall, height, depth, bodyColor, { solid: true, floorY: 0, metalness: .72, emissive: theme.accent, emissiveIntensity: .12 });
    addBox(x, height / 2, z - depth / 2 + wall / 2, width, height, wall, bodyColor, { solid: true, floorY: 0, metalness: .72, emissive: theme.accent, emissiveIntensity: .12 });

    // Frente dividida: o vão central é uma porta transitável.
    const sideCenterOffset = doorW / 2 + sideW / 2;
    addBox(x - sideCenterOffset, height / 2, frontZ, sideW, height, wall, bodyColor, { solid: true, floorY: 0, metalness: .72, emissive: theme.accent, emissiveIntensity: .12 });
    addBox(x + sideCenterOffset, height / 2, frontZ, sideW, height, wall, bodyColor, { solid: true, floorY: 0, metalness: .72, emissive: theme.accent, emissiveIntensity: .12 });
    addBox(x, height - .65, frontZ, doorW, 1.3, wall, bodyColor, { metalness: .72, emissive: theme.accent, emissiveIntensity: .12 });

    // Cobertura superior e piso interno.
    const roof = addBox(x, height + .12, z, width + .35, .24, depth + .35, index % 2 ? theme.accent2 : theme.accent, { emissive: theme.accent, emissiveIntensity: .3, metalness: .5 });
    roof.material.emissiveIntensity = .24;
    addBox(x, .035, z, width - wall, .07, depth - wall, 0x0c1725, { emissive: theme.accent, emissiveIntensity: .12, castShadow: false });

    // Fileiras de janelas nos andares superiores e marcações luminosas.
    const storeys = Math.max(2, Math.floor(height / 2.7));
    for (let floor = 1; floor < storeys; floor++) {
        const y = floor * (height / storeys);
        const count = Math.max(2, Math.floor(width / 1.35));
        for (let col = 0; col < count; col++) {
            const wx = x - width / 2 + .75 + col * ((width - 1.5) / Math.max(1, count - 1));
            addBox(wx, y, z + depth / 2 + .025, .42, .92, .05, (floor + col) % 3 === 0 ? theme.accent2 : 0x1d7190, { emissive: theme.accent, emissiveIntensity: .72, castShadow: false });
        }
        addBox(x, y + .68, z + depth / 2 + .055, Math.max(1, width * .25), .08, .06, theme.accent, { emissive: theme.accent, emissiveIntensity: 1.2, castShadow: false });
    }

    // Portal destacado pela moldura luminosa.
    addBox(x - doorW / 2, 1.22, frontZ + .04, .13, 2.44, .09, theme.accent, { emissive: theme.accent, emissiveIntensity: 1.9, castShadow: false });
    addBox(x + doorW / 2, 1.22, frontZ + .04, .13, 2.44, .09, theme.accent, { emissive: theme.accent, emissiveIntensity: 1.9, castShadow: false });
    addBox(x, 2.5, frontZ + .04, doorW + .14, .13, .09, theme.accent2, { emissive: theme.accent2, emissiveIntensity: 1.6, castShadow: false });

    // Lobby com console e duas estações; deixam corredor livre da porta ao fundo.
    addBox(x - width * .22, .58, z - depth * .24, .52, 1.05, .55, 0x18283a, { solid: true, floorY: 0, metalness: .75, emissive: theme.accent, emissiveIntensity: .22 });
    addBox(x - width * .22, 1.18, z - depth * .24 - .3, .46, .08, .035, theme.accent, { emissive: theme.accent, emissiveIntensity: 1.5, castShadow: false });
    addBox(x + width * .22, .42, z - depth * .24, .52, .74, .55, 0x18283a, { solid: true, floorY: 0, metalness: .75, emissive: theme.accent2, emissiveIntensity: .2 });
    // Entrar na torre também serve como esconderijo; o teto desaparece enquanto o jogador está dentro.
    houses.push({ cx: x, cz: z, w: width, d: depth, roof, name: `Torre de Dados ${index + 1}` });
}
function createMotherboard(x, z, scale = 1, floorY = 0) {
    addBox(x, floorY + .12 * scale, z, 3.0 * scale, .24 * scale, 2.2 * scale, theme.id === 'nucleo' ? 0x4d2921 : theme.id === 'floresta' ? 0x174b32 : 0x174c45, { solid: true, floorY, metalness: .6, emissive: 0x062d27 });
    addBox(x, floorY + .28 * scale, z, .78 * scale, .12 * scale, .6 * scale, 0x101b2b, { emissive: theme.accent, emissiveIntensity: .8 });
    for (let i = 0; i < 6; i++) addBox(x - 1.0 * scale + i * .34 * scale, floorY + .3 * scale, z - .65 * scale, .14 * scale, .16 * scale, .38 * scale, theme.accent, { emissive: theme.accent, emissiveIntensity: .6 });
    for (let i = 0; i < 4; i++) addBox(x - .75 * scale + i * .5 * scale, floorY + .27 * scale, z + .62 * scale, .18 * scale, .12 * scale, .18 * scale, theme.accent2, { emissive: theme.accent2, emissiveIntensity: .6 });
}
function createReactor(x, z, scale = 1) {
    const r = 2.1 * scale, h = 4.6 * scale;
    addCylinder(x, z, r, h, 0x32232a, { solid: true, emissive: 0x2b090d, emissiveIntensity: .3, segments: 24 });
    addCylinder(x, z, r * .84, h * .55, 0x581d21, { floorY: h * .23, emissive: 0x640d12, emissiveIntensity: .55, segments: 24 });
    for (const yScale of [.2, .48, .78]) {
        addTorus(mapRoot, r * 1.02, .10 * scale, theme.accent2, x, h * yScale, z, Math.PI / 2, 0, { emissiveIntensity: 1.8 });
    }
    addCylinder(x, z, .52 * scale, .23 * scale, theme.accent2, { floorY: h, emissive: theme.accent2, emissiveIntensity: 2, segments: 16 });
    // Cano industrial ligando a lateral do reator.
    addBox(x + r + .9 * scale, h * .55, z, 1.8 * scale, .42 * scale, .42 * scale, 0x777078, { solid: true, floorY: 0, metalness: .8 });
    addBox(x + r + .9 * scale, h * .55 + .24 * scale, z, 1.8 * scale, .07 * scale, .47 * scale, theme.accent2, { emissive: theme.accent2, emissiveIntensity: 1.6 });
}
function createTree(x, z, scale = 1) {
    const trunkH = 2.5 * scale;
    addCylinder(x, z, .38 * scale, trunkH, 0x38291f, { solid: true, segments: 9 });
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * scale, 1), new THREE.MeshStandardMaterial({ color: 0x164f35, roughness: .9, emissive: 0x0a3c20, emissiveIntensity: .5 }));
    crown.position.set(x, trunkH + 1.1 * scale, z); crown.castShadow = true; mapRoot.add(crown);
    const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05 * scale, 1), new THREE.MeshStandardMaterial({ color: 0x207646, roughness: .8, emissive: 0x13632b, emissiveIntensity: .65 }));
    crown2.position.set(x + .65 * scale, trunkH + .65 * scale, z - .25 * scale); mapRoot.add(crown2);
    addTorus(mapRoot, .85 * scale, .055 * scale, theme.accent, x, .1, z, Math.PI / 2, 0, { emissiveIntensity: 1.3 });
}
function createForestHill(x, z, scale = 1, tint = 0x1b5638) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(7.2 * scale, 12 * scale, 9, 2), new THREE.MeshStandardMaterial({ color: tint, roughness: .96, metalness: .02, flatShading: true }));
    hill.position.set(x, 4.7 * scale, z); hill.rotation.y = .25 * scale; hill.castShadow = true; hill.receiveShadow = true; mapRoot.add(hill);
    // Morros bloqueiam a passagem, exceto quando invadiriam uma casa/abrigo.
    // Algumas casas orgânicas são criadas logo depois deste passo; suas posições são incluídas aqui.
    const protectedBuildings = houses.map(h => ({ cx: h.cx, cz: h.cz, w: h.w, d: h.d }))
        .concat([{ cx: -23, cz: 21, w: 7.2, d: 6.7 }, { cx: 20, cz: -25, w: 6.4, d: 6.0 }]);
    const hillW = 12.8 * scale, hillD = 12.8 * scale;
    const overlapsBuilding = protectedBuildings.some(b =>
        Math.abs(x - b.cx) < hillW / 2 + b.w / 2 + 1.2 &&
        Math.abs(z - b.cz) < hillD / 2 + b.d / 2 + 1.2
    );
    if (!overlapsBuilding) colliders.push({ x, z, w: hillW, d: hillD, floorY: 0 });
    const rock = new THREE.Mesh(new THREE.ConeGeometry(3.1 * scale, 5.1 * scale, 7, 1), new THREE.MeshStandardMaterial({ color: 0x405449, roughness: 1, flatShading: true }));
    rock.position.set(x + 1.4 * scale, 2.4 * scale, z - 1.1 * scale); rock.rotation.z = -.16; rock.castShadow = true; mapRoot.add(rock);
    // Faixas baixas de vegetação luminosa no pé do morro.
    for (let i = 0; i < 4; i++) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(.28 * scale, .85 * scale, 5), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2d9a52 : 0x60bd58, emissive: 0x0c4a24, emissiveIntensity: .22 }));
        tuft.position.set(x + (i - 1.5) * .8 * scale, .4 * scale, z + 2.3 * scale); tuft.rotation.z = (i - 1.5) * .08; mapRoot.add(tuft);
    }
}
function createHouse(cx, cz, name, scale = 1) {
    const w = 8.2 * scale, d = 7.6 * scale, h = 3.2 * scale, t = .38 * scale, doorW = 2.35 * scale;
    const wall = theme.id === 'nucleo' ? 0x472a2b : theme.id === 'floresta' ? 0x183d2d : 0x203951;
    const roofColor = theme.id === 'nucleo' ? 0x36171c : theme.id === 'floresta' ? 0x102d21 : 0x152c46;
    const roof = addBox(cx, h + .12 * scale, cz, w + .25 * scale, .25 * scale, d + .25 * scale, roofColor, { emissive: theme.accent, emissiveIntensity: .16 });
    addBox(cx, h / 2, cz - d / 2 + t / 2, w, h, t, wall, { solid: true, floorY: 0, metalness: .5 });
    addBox(cx - w / 2 + t / 2, h / 2, cz, t, h, d, wall, { solid: true, floorY: 0, metalness: .5 });
    addBox(cx + w / 2 - t / 2, h / 2, cz, t, h, d, wall, { solid: true, floorY: 0, metalness: .5 });
    const segmentW = (w - doorW) / 2, frontZ = cz + d / 2 - t / 2;
    addBox(cx - doorW / 2 - segmentW / 2, h / 2, frontZ, segmentW, h, t, wall, { solid: true, floorY: 0, metalness: .5 });
    addBox(cx + doorW / 2 + segmentW / 2, h / 2, frontZ, segmentW, h, t, wall, { solid: true, floorY: 0, metalness: .5 });
    addBox(cx, .035, cz, w - .55 * scale, .07, d - .55 * scale, theme.id === 'floresta' ? 0x153425 : 0x263d52, { emissive: theme.accent, emissiveIntensity: .12 });
    addBox(cx - doorW / 2, h / 2, frontZ, .14 * scale, h, t * 1.3, theme.accent, { emissive: theme.accent, emissiveIntensity: 1.2 });
    addBox(cx + doorW / 2, h / 2, frontZ, .14 * scale, h, t * 1.3, theme.accent, { emissive: theme.accent, emissiveIntensity: 1.2 });
    for (const side of [-1, 1]) addBox(cx + side * 2.65 * scale, 1.85 * scale, frontZ + .2 * scale, .85 * scale, .68 * scale, .05, theme.id === 'nucleo' ? 0xffbc2d : theme.accent, { emissive: theme.accent, emissiveIntensity: .8 });
    houses.push({ cx, cz, w, d, roof, name });
}
function createUpperPlatform() {
    // Plataforma a cerca de 3 unidades de altura, com rampa acessível.
    addBox(30, 2.8, -31, 16, .4, 14, theme.id === 'nucleo' ? 0x38232a : theme.id === 'floresta' ? 0x173728 : 0x172e49, { metalness: .72, emissive: theme.accent, emissiveIntensity: .12 });
    addBox(22, 3.35, -31, .22, .7, 14, theme.accent2, { solid: true, floorY: 3, emissive: theme.accent2, emissiveIntensity: .65 });
    addBox(38, 3.35, -31, .22, .7, 14, theme.accent2, { solid: true, floorY: 3, emissive: theme.accent2, emissiveIntensity: .65 });
    addBox(30, 3.35, -38, 16, .7, .22, theme.accent2, { solid: true, floorY: 3, emissive: theme.accent2, emissiveIntensity: .65 });
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(5, .28, 12.6), new THREE.MeshStandardMaterial({ color: theme.id === 'nucleo' ? 0x4c2828 : theme.id === 'floresta' ? 0x214a32 : 0x1b4260, metalness: .58, roughness: .4, emissive: theme.accent, emissiveIntensity: .16 }));
    rampMesh.position.set(28, 1.48, -18); rampMesh.rotation.x = Math.asin(3 / 12.6); rampMesh.receiveShadow = true; mapRoot.add(rampMesh);
    for (let i = 0; i < 10; i++) {
        const z = -12.7 - i * 1.08;
        const y = ((-z - 12) / 12) * 3 + .05;
        addBox(28, y, z, 4.5, .035, .05, theme.accent, { emissive: theme.accent, emissiveIntensity: 1.5, castShadow: false });
    }
    if (theme.id === 'cidade') {
        createComputerTower(26, -31, .72, 3); createMonitorStation(32, -31, .65, 3); createMotherboard(30, -27, .45, 3);
    } else if (theme.id === 'nucleo') {
        addCylinder(30, -31, 1.45, 3.0, 0x53202a, { floorY: 3, solid: true, emissive: 0x5a080b, emissiveIntensity: .4 });
        addTorus(mapRoot, 1.58, .09, theme.accent2, 30, 4.1, -31, Math.PI / 2, 0, { emissiveIntensity: 2 });
    } else {
        createTree(27, -31, .68); createTree(34, -32, .52);
    }
}
function createCorridor(cx, cz, length, axis, width, height, color) {
    const wall = .48;
    if (axis === 'x') {
        addBox(cx, height/2, cz-width/2, length, height, wall, color, {solid:true,floorY:0,metalness:.62,emissive:theme.accent,emissiveIntensity:.12});
        addBox(cx, height/2, cz+width/2, length, height, wall, color, {solid:true,floorY:0,metalness:.62,emissive:theme.accent,emissiveIntensity:.12});
    } else {
        addBox(cx-width/2, height/2, cz, wall, height, length, color, {solid:true,floorY:0,metalness:.62,emissive:theme.accent,emissiveIntensity:.12});
        addBox(cx+width/2, height/2, cz, wall, height, length, color, {solid:true,floorY:0,metalness:.62,emissive:theme.accent,emissiveIntensity:.12});
    }
    // Luzes de orientação no chão indicam que é um caminho de passagem.
    const count = Math.max(4, Math.floor(length/4));
    for (let i=0;i<count;i++) {
        const offset = -length/2 + (i+.5)*length/count;
        const x = axis==='x' ? cx+offset : cx;
        const z = axis==='x' ? cz : cz+offset;
        addBox(x,.045,z,.36,.035,.36,theme.accent,{emissive:theme.accent,emissiveIntensity:1.1,castShadow:false});
    }
}
function createThemedDistricts() {
    if (gameType === 'rapido') return;
    if (theme.id === 'cidade') {
        // Avenidas principais e quadras verticais da metrópole digital.
        addBox(0,.035,0,96,.035,7,0x111d2c,{castShadow:false});
        addBox(0,.037,0,7,.035,96,0x111d2c,{castShadow:false});
        for(let dash=-43;dash<=43;dash+=7){addBox(dash,.06,0,2.6,.025,.12,0x6da5bc,{castShadow:false});addBox(0,.062,dash,.12,.025,2.6,0x6da5bc,{castShadow:false});}
        createCitySkyscraper(-43,-20,7,17,7,0);
        createCitySkyscraper(1,-44,8,21,8,1);
        createCitySkyscraper(43,27,7,15,7,2);
        createCitySkyscraper(-43,29,6,13,7,3);
        createCitySkyscraper(4,44,6,12,7,4);
        // Quadras altas e corredores entre os blocos; as casas continuam acessíveis pela porta.
        createHouse(-24,-19,'Residência Byte',.85);
        createHouse(25,-8,'Estação Kernel',.82);
        createHouse(-24,31,'Centro de Arquivos',.76);
        createCorridor(-34,-5,24,'z',5.6,3.4,0x183c58);
        createCorridor(34,9,25,'z',5.4,3.2,0x183c58);
        createComputerTower(-43,2,1.25); createComputerTower(43,-4,1.1);
        createMonitorStation(-12,-42,1.1); createMotherboard(17,40,.85);
    } else if (theme.id === 'nucleo') {
        // Fábrica com passagens de manutenção e canaletas de energia.
        createCorridor(-31,-9,26,'x',6.2,3.2,0x4b272c);
        createCorridor(28,12,25,'z',5.2,3.5,0x4b272c);
        createHouse(-24,20,'Sala de Controle',.86);
        createHouse(20,-24,'Abrigo Térmico',.8);
        for (let i=0;i<5;i++) {
            const x=-35+i*17;
            addBox(x,.42,3,7,.65,.8,0x53454a,{solid:true,floorY:0,metalness:.85,emissive:0x8a211d,emissiveIntensity:.35});
            addBox(x, .79, 3, 6.7,.06,.86,theme.accent2,{emissive:theme.accent2,emissiveIntensity:1.25});
        }
        createReactor(39,-34,.75); createReactor(-42,36,.8);
    } else {
        // Trilhas entre raízes, ruínas e pequenas construções orgânicas.
        [[-47,-44,1.25],[-29,-48,.9],[0,-49,1.15],[31,-47,1.2],[47,-36,.95],[-48,23,1.2],[45,44,1.15],[0,49,.95]].forEach(([x,z,scale],i)=>createForestHill(x,z,scale,i%2?0x205b3a:0x173f2d));
        createCorridor(-31,-12,27,'x',6.5,1.8,0x244b35);
        createCorridor(31,15,28,'z',6.0,1.9,0x244b35);
        createHouse(-23,21,'Estufa Abandonada',.88);
        createHouse(20,-25,'Santuário Verde',.78);
        [[-28,-30,1.0],[-13,36,.9],[27,39,1.1],[39,-19,.9],[-43,5,.85],[7,-42,.8]].forEach(([x,z,scale])=>createTree(x,z,scale));
        [[-20,3,14],[21,-3,12],[-8,32,13]].forEach(([x,z,length])=>{
            addBox(x,.42,z,length,.65,.9,0x3b2e32,{solid:true,floorY:0,emissive:0x922744,emissiveIntensity:.3});
            addBox(x,.78,z,length,.07,.95,theme.accent2,{emissive:theme.accent2,emissiveIntensity:.8});
        });
    }
}
function createSecondSkyDistrict() {
    // Um terceiro nível explorável em outra região, ligado por uma rampa longa.
    const color = theme.id==='nucleo' ? 0x4a2729 : theme.id==='floresta' ? 0x204b34 : 0x17334f;
    addBox(13,4.8,34,16,.4,16,color,{metalness:.72,emissive:theme.accent,emissiveIntensity:.18});
    addBox(5,5.55,34,.22,1.1,16,theme.accent2,{solid:true,floorY:5,emissive:theme.accent2,emissiveIntensity:.6});
    addBox(21,5.55,34,.22,1.1,16,theme.accent2,{solid:true,floorY:5,emissive:theme.accent2,emissiveIntensity:.6});
    addBox(13,5.55,42,16,1.1,.22,theme.accent2,{solid:true,floorY:5,emissive:theme.accent2,emissiveIntensity:.6});
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(5.4,.28,18),new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.38,emissive:theme.accent,emissiveIntensity:.14}));
    ramp.position.set(12,2.42,17); ramp.rotation.x=-Math.asin(5/18); ramp.receiveShadow=true; mapRoot.add(ramp);
    for(let i=0;i<12;i++) addBox(12,((i+1)/12)*5+.04,8.8+i*1.45,5,.035,.06,theme.accent,{emissive:theme.accent,emissiveIntensity:1.2,castShadow:false});
    if(theme.id==='cidade'){createComputerTower(9,34,.62,5);createMonitorStation(16,34,.52,5);}
    else if(theme.id==='nucleo'){createReactor(13,34,.42);addCylinder(18,37,.65,2.2,0x5e2b25,{floorY:5,solid:true,emissive:theme.accent2,emissiveIntensity:.5});}
    else {createTree(9,34,.43);createTree(17,35,.39);}
}

function createHazard(x, z, radius, index) {
    const root = new THREE.Group();
    const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshBasicMaterial({ color: theme.hazard, transparent: true, opacity: .23, side: THREE.DoubleSide }));
    disk.rotation.x = -Math.PI / 2; disk.position.y = .045; root.add(disk);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * .88, .09, 8, 40), new THREE.MeshBasicMaterial({ color: theme.id === 'nucleo' ? 0xffdf42 : theme.hazard, transparent: true, opacity: .9 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .1; root.add(ring);
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(.28), new THREE.MeshBasicMaterial({ color: theme.accent2 }));
    marker.position.y = .35; root.add(marker);
    root.position.set(x, 0, z); mapRoot.add(root);
    hazards.push({ root, disk, ring, marker, x, z, radius, phase: index * .8, kind: theme.id });
}

function createThemedLandmarks() {
    if (theme.id === 'cidade') {
        [[-35,-28,1.2],[-20,25,.9],[25,20,1.1],[42,3,.85],[-39,19,.78],[5,40,.85],[43,37,1.0],[2,-39,.95]].forEach(([x,z,s]) => createComputerTower(x,z,s));
        [[-3,-31,.85],[19,-18,.8],[37,29,.8],[-43,-1,.75],[8,31,.7],[42,-18,.9]].forEach(([x,z,s]) => createMonitorStation(x,z,s));
        [[-34,7,.9],[10,-39,.8],[41,14,.7],[-10,37,.8],[16,43,.85]].forEach(([x,z,s]) => createMotherboard(x,z,s));
    } else if (theme.id === 'nucleo') {
        [[-35,-29,1.05],[-20,28,.9],[30,20,1.1],[42,0,.85],[-40,18,.78],[4,42,.9],[42,38,.85],[0,-41,.9]].forEach(([x,z,s]) => createReactor(x,z,s));
        [[-6,-32,.85],[18,-17,.9],[37,29,.85],[-43,-2,.8],[7,32,.75],[42,-19,.8]].forEach(([x,z,s]) => createMonitorStation(x,z,s));
        // Tubulações grossas conectando as áreas industriais.
        [[-29,-12,15],[25,-5,12],[-8,28,16],[13,43,12]].forEach(([x,z,length]) => {
            addBox(x, .7, z, length, .55, .55, 0x564b51, { solid: true, floorY: 0, metalness: .8 });
            addBox(x, 1.02, z, length, .08, .6, theme.accent2, { emissive: theme.accent2, emissiveIntensity: 1.4 });
        });
    } else {
        [[-39,-32,1.15],[-20,25,.9],[31,22,1.0],[43,2,.82],[-43,18,.85],[3,42,.85],[43,38,.8],[-5,-41,.85], [18,-43,.8],[-34,39,.95]].forEach(([x,z,s]) => createTree(x,z,s));
        [[-4,-31,.8],[18,-17,.78],[38,30,.76],[-43,-2,.68],[7,31,.7],[42,-19,.8]].forEach(([x,z,s]) => createMonitorStation(x,z,s));
        // Raízes digitais atravessam a vegetação como passagens baixas.
        [[-28,-8,12],[23,-4,13],[-6,27,14],[11,43,10]].forEach(([x,z,length]) => {
            addBox(x, .34, z, length, .5, .8, 0x39263b, { solid: true, floorY: 0, metalness: .15, emissive: 0x3b102b, emissiveIntensity: .25 });
            addBox(x, .58, z, length, .08, .84, theme.accent2, { emissive: theme.accent2, emissiveIntensity: .5 });
        });
    }
}
function makeEnemySpawnPoints() {
    const candidates = [
        [-45,-43],[-32,43],[44,34],[43,-28],[-45,18],[-16,-46],[16,46],[0,-45],[47,0],[-47,-8],
        [30,-43],[39,19],[-33,-28],[20,35],[-4,46],[-44,35],[8,-35],[33,2],[-24,43],[47,-43],
        [-46,2],[26,45],[-40,-18],[15,-26],[-13,34],[44,13],[-28,8],[4,48]
    ];
    enemySpawnPoints = candidates.filter(([x,z]) => Math.hypot(x,z) > 20 && !isBlocked(x,z,floorHeightAt(x,z),1));
    // Garante que existam pontos suficientes mesmo se um mapa futuro adicionar novos prédios.
    for (let z = -48; z <= 48 && enemySpawnPoints.length < 24; z += 8) {
        for (let x = -48; x <= 48 && enemySpawnPoints.length < 24; x += 8) {
            if (Math.hypot(x,z) < 20 || isBlocked(x,z,floorHeightAt(x,z),1)) continue;
            if (enemySpawnPoints.every(([sx,sz]) => Math.hypot(sx-x,sz-z) > 6)) enemySpawnPoints.push([x,z]);
        }
    }
}
function createVirusRobot(isBoss = false) {
    const root = new THREE.Group();
    const model = new THREE.Group(); root.add(model);
    const armor = new THREE.MeshStandardMaterial({ color: theme.enemyBody, metalness: .68, roughness: .3, emissive: theme.enemyBody, emissiveIntensity: .28 });
    const dark = new THREE.MeshStandardMaterial({ color: theme.enemyDark, metalness: .7, roughness: .33 });
    const eyes = new THREE.MeshStandardMaterial({ color: theme.enemyEye, emissive: theme.enemyEye, emissiveIntensity: 2.5 });
    const arms = [], legs = [];
    const bodyGeometry = theme.id === 'nucleo' ? new THREE.BoxGeometry(.96,.88,.72)
        : theme.id === 'floresta' ? new THREE.IcosahedronGeometry(.48,1)
        : new THREE.BoxGeometry(.76,.78,.58);
    const body = new THREE.Mesh(bodyGeometry, armor); body.position.y = .95; body.castShadow = true; model.add(body);
    const headGeometry = theme.id === 'nucleo' ? new THREE.BoxGeometry(.58,.52,.5)
        : theme.id === 'floresta' ? new THREE.ConeGeometry(.43,.72,7)
        : new THREE.DodecahedronGeometry(.42, 0);
    const head = new THREE.Mesh(headGeometry, dark); head.position.y = theme.id==='floresta'?1.66:1.62; head.castShadow = true; model.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(.46, .13, .08), eyes); visor.position.set(0,1.63,-.37); model.add(visor);
    for (const side of [-1,1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(.09,.1,.06), eyes); eye.position.set(side*.14,1.63,-.42); model.add(eye);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(.14,.35,5), armor); spike.position.set(side*.27,1.98,.03); spike.rotation.z=side*-.35; model.add(spike);
        const armPivot = new THREE.Group(); armPivot.position.set(side*.52,1.2,0);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(.23,.62,.24), armor); arm.position.y=-.22; arm.castShadow=true; armPivot.add(arm); model.add(armPivot); arms.push({pivot:armPivot,side});
        const legPivot = new THREE.Group(); legPivot.position.set(side*.22,.55,0);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(.25,.5,.27), dark); leg.position.y=-.23; leg.castShadow=true; legPivot.add(leg); model.add(legPivot); legs.push({pivot:legPivot,side});
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.22,8),dark); antenna.position.y=2.04; model.add(antenna);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(.13),eyes); core.position.y=2.2; model.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.58,.035,8,28),new THREE.MeshBasicMaterial({color:theme.enemyEye})); ring.rotation.x=Math.PI/2; ring.position.y=.05; model.add(ring);
    if (theme.id === 'nucleo') {
        for (const side of [-1,1]) {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(.34,.42,.52), armor);
            plate.position.set(side*.58,1.3,0); plate.rotation.z=side*-.18; model.add(plate);
            const vent = new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.32,8), eyes);
            vent.position.set(side*.25,.45,.28); vent.rotation.x=Math.PI/2; model.add(vent);
        }
        const crest = new THREE.Mesh(new THREE.ConeGeometry(.18,.45,5), eyes); crest.position.set(0,2.14,0); model.add(crest);
    } else if (theme.id === 'floresta') {
        for (const side of [-1,1]) {
            const thorn = new THREE.Mesh(new THREE.ConeGeometry(.18,.56,5), armor);
            thorn.position.set(side*.38,1.95,.12); thorn.rotation.z=side*-.5; model.add(thorn);
        }
        const rootRing = new THREE.Mesh(new THREE.TorusGeometry(.72,.075,7,22),new THREE.MeshStandardMaterial({color:theme.accent2,emissive:theme.accent2,emissiveIntensity:.8}));
        rootRing.rotation.x=Math.PI/2;rootRing.position.y=.1;model.add(rootRing);
    } else {
        const dataPack = new THREE.Mesh(new THREE.BoxGeometry(.42,.44,.23),new THREE.MeshStandardMaterial({color:0x143e59,metalness:.8,emissive:theme.accent,emissiveIntensity:.5}));
        dataPack.position.set(0,1.05,.38);model.add(dataPack);
    }
    // DETALHES MONSTRUOSOS POR FACCÃO: silhuetas e apêndices diferentes por mundo.
    const addMonsterBox = (w,h,d,material,x,y,z) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
        mesh.position.set(x,y,z); mesh.castShadow = true; model.add(mesh); return mesh;
    };
    const addTendril = (points, radius, material) => {
        for (let i=0; i<points.length-1; i++) {
            const a = new THREE.Vector3(...points[i]);
            const b = new THREE.Vector3(...points[i+1]);
            const direction = new THREE.Vector3().subVectors(b,a);
            const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius*.55,radius,direction.length(),7),material);
            segment.position.copy(a).add(b).multiplyScalar(.5);
            segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
            segment.castShadow=true; model.add(segment);
            const joint = new THREE.Mesh(new THREE.SphereGeometry(radius*.8,8,8),material);
            joint.position.copy(b); model.add(joint);
        }
    };
    // Mandíbula serrilhada para todas as classes.
    for (let tooth=0; tooth<4; tooth++) {
        const fang=new THREE.Mesh(new THREE.ConeGeometry(.065,.18,5),eyes);
        fang.position.set(-.17+tooth*.115,.73,-.365); fang.rotation.x=-Math.PI/2; model.add(fang);
    }
    if (theme.id === 'cidade') {
        const cableMat=new THREE.MeshStandardMaterial({color:0x28143e,metalness:.55,roughness:.3,emissive:0x6c1c8a,emissiveIntensity:.7});
        for(const side of [-1,1]) {
            addTendril([[side*.3,.78,.18],[side*.68,.48,.55],[side*.92,.24,.76]],.13,cableMat);
            addTendril([[side*.32,1.05,.2],[side*.62,1.25,.58],[side*.95,1.14,.83]],.09,eyes);
            const sensor=new THREE.Mesh(new THREE.SphereGeometry(.13,10,10),eyes); sensor.position.set(side*.55,1.82,-.13); model.add(sensor);
        }
        const dataCore=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshStandardMaterial({color:0x69eaff,emissive:0x15cfff,emissiveIntensity:2.0,metalness:.4})); dataCore.position.set(0,.95,.44); model.add(dataCore);
    } else if (theme.id === 'nucleo') {
        const heatMat=new THREE.MeshStandardMaterial({color:0x422019,metalness:.85,roughness:.25,emissive:0xff4a17,emissiveIntensity:1.5});
        for(const side of [-1,1]) {
            addMonsterBox(.22,.33,.12,eyes,side*.43,.9,.31);
            for(let vent=0;vent<3;vent++) addMonsterBox(.18,.045,.08,eyes,side*.53,.64+vent*.13,.33);
            const shoulderSpike=new THREE.Mesh(new THREE.ConeGeometry(.2,.58,5),heatMat); shoulderSpike.position.set(side*.56,1.72,.05); shoulderSpike.rotation.z=side*-.65; model.add(shoulderSpike);
        }
        addTendril([[-.25,.55,.22],[-.5,.3,.48],[-.72,.12,.6]],.14,dark);
        addTendril([[.25,.55,.22],[.5,.3,.48],[.72,.12,.6]],.14,dark);
    } else if (theme.id === 'floresta') {
        const vineMat=new THREE.MeshStandardMaterial({color:0x692039,metalness:.2,roughness:.8,emissive:0x5a0d28,emissiveIntensity:.7});
        for(const side of [-1,1]) {
            addTendril([[side*.28,.78,.18],[side*.7,.45,.42],[side*1.0,.2,.2]],.12,vineMat);
            const horn=new THREE.Mesh(new THREE.ConeGeometry(.22,.72,5),armor); horn.position.set(side*.32,2.03,.05); horn.rotation.z=side*-.58; model.add(horn);
            const pustule=new THREE.Mesh(new THREE.SphereGeometry(.13,10,10),eyes); pustule.position.set(side*.43,1.1,-.25); model.add(pustule);
        }
        const spore=new THREE.Mesh(new THREE.IcosahedronGeometry(.26,1),new THREE.MeshStandardMaterial({color:0xff3359,emissive:0xed123f,emissiveIntensity:1.6,transparent:true,opacity:.9})); spore.position.set(0,2.28,.08); model.add(spore);
    } else {
        // No interior do PC, o malware parece uma criatura parasita com cabos expostos.
        const cableMat=new THREE.MeshStandardMaterial({color:0x170e24,metalness:.35,roughness:.45,emissive:0x9f103b,emissiveIntensity:.9});
        for(const side of [-1,1]) {
            addTendril([[side*.25,.8,.22],[side*.62,.52,.62],[side*.9,.18,.88]],.12,cableMat);
            addTendril([[side*.3,1.12,.08],[side*.58,1.48,.34],[side*.77,1.74,.24]],.075,eyes);
        }
        const coreEye=new THREE.Mesh(new THREE.SphereGeometry(.20,16,12),new THREE.MeshStandardMaterial({color:0xffecf3,emissive:0xff164a,emissiveIntensity:2.6})); coreEye.position.set(0,1.62,-.43); model.add(coreEye);
        for(let spike=0;spike<3;spike++){const s=new THREE.Mesh(new THREE.ConeGeometry(.12,.38,5),armor);s.position.set((spike-1)*.25,2.12,.22);s.rotation.z=(spike-1)*-.3;model.add(s);}
    }
    const stunAura = new THREE.Mesh(new THREE.TorusGeometry(.86,.075,8,32),new THREE.MeshBasicMaterial({color:theme.accent,transparent:true,opacity:.9})); stunAura.rotation.x=Math.PI/2; stunAura.position.y=2.45; stunAura.visible=false; model.add(stunAura);
    root.userData.model=model; root.userData.arms=arms; root.userData.legs=legs; root.userData.stunAura=stunAura;
    root.userData.stunnedUntil=0; root.userData.targetX=0; root.userData.targetZ=0; root.userData.nextWanderAt=0; root.userData.moving=false; root.userData.phase=Math.random()*5; root.userData.nextBurstAt=0; root.userData.burstUntil=0; root.userData.guardIndex=Math.floor(Math.random()*8);
    if (isBoss) {
        root.scale.setScalar(2.15);
        addTorus(model, .92, .1, theme.accent2, 0, 2.6, 0, Math.PI/2, 0, {emissiveIntensity:2.1});
    }
    return root;
}
function createMovingPlatform(x, z, axis, amplitude, speed, phase = 0) {
    // Plataforma elevada que se move sobre um trilho; é possível saltar e pousar nela.
    const track = new THREE.Mesh(
        new THREE.BoxGeometry(axis === 'x' ? amplitude * 2 + 7 : .18, .07, axis === 'z' ? amplitude * 2 + 7 : .18),
        new THREE.MeshStandardMaterial({ color: theme.gridSub, emissive: theme.accent, emissiveIntensity: .35 })
    );
    track.position.set(x, .05, z); mapRoot.add(track);
    const mesh = new THREE.Group();
    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, .32, 5.2),
        new THREE.MeshStandardMaterial({ color: 0x122e48, metalness: .68, roughness: .32, emissive: theme.accent, emissiveIntensity: .35 })
    );
    deck.castShadow = true; deck.receiveShadow = true; mesh.add(deck);
    const edge = new THREE.Mesh(
        new THREE.BoxGeometry(5.35, .09, 5.35),
        new THREE.MeshBasicMaterial({ color: theme.accent })
    );
    edge.position.y = -.13; mesh.add(edge);
    mesh.position.set(x, 1.3, z); mapRoot.add(mesh);
    movingPlatforms.push({ mesh, originX: x, originZ: z, axis, amplitude, speed, phase, width: 5.2, depth: 5.2, topY: 1.46, previousX: x, previousZ: z });
}
function platformAt(x, z) {
    return movingPlatforms.find(p => Math.abs(x - p.mesh.position.x) <= p.width / 2 - .15 && Math.abs(z - p.mesh.position.z) <= p.depth / 2 - .15) || null;
}
function updateMovingPlatforms(dt) {
    if (gameState !== 'playing') return;
    for (const p of movingPlatforms) {
        const oldX = p.mesh.position.x, oldZ = p.mesh.position.z;
        const offset = Math.sin(elapsed * p.speed + p.phase) * p.amplitude;
        if (p.axis === 'x') p.mesh.position.x = p.originX + offset;
        else p.mesh.position.z = p.originZ + offset;
        if (playerPlatform === p && jumpVelocity <= 0 && jumpHeight <= .001) {
            player.position.x += p.mesh.position.x - oldX;
            player.position.z += p.mesh.position.z - oldZ;
        }
        p.previousX = p.mesh.position.x; p.previousZ = p.mesh.position.z;
    }
}

function createHazardsForMap() {
    const points = theme.id === 'cidade'
        ? [[-42,-35,2.4],[-12,-38,2.8],[18,-35,2.5],[43,8,2.7],[-44,15,2.8],[4,42,2.4],[36,42,2.8],[-17,20,2.5],[25,2,2.3]]
        : theme.id === 'nucleo'
        ? [[-42,-35,2.6],[-12,-38,3.0],[18,-35,2.8],[43,8,2.7],[-44,15,2.8],[4,42,2.8],[36,42,2.8],[-17,20,2.5],[25,2,2.6],[0,28,2.4]]
        : [[-42,-35,2.7],[-12,-38,3.0],[18,-35,2.7],[43,8,2.7],[-44,15,2.8],[4,42,2.8],[36,42,2.8],[-17,20,2.7],[25,2,2.5],[0,28,3.0],[42,-37,2.5]];
    points.forEach(([x,z,r],i) => createHazard(x,z,r,i));
}
function makeLabelSprite(text, color = '#a7f8ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(2,10,22,0.88)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.font = 'bold 34px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(5.4, 1.02, 1); sprite.renderOrder = 5;
    return sprite;
}
function createInfectedComponent(x, z, index, infected, levelY = 0) {
    const group = new THREE.Group(); group.position.set(x, levelY, z); mapRoot.add(group);
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x142236, metalness: .8, roughness: .3 });
    const board = new THREE.MeshStandardMaterial({ color: 0x174638, metalness: .6, roughness: .42, emissive: 0x06271e, emissiveIntensity: .3 });
    const copper = new THREE.MeshStandardMaterial({ color: 0x9a6a36, metalness: .85, roughness: .28 });
    const module = [
        { name: 'PROCESSADOR CENTRAL', short: 'CPU / PROCESSADOR', shape: 'cpu' },
        { name: 'MEMÓRIA RAM', short: 'RAM / MEMÓRIA', shape: 'ram' },
        { name: 'PLACA DE VÍDEO', short: 'GPU / PLACA DE VÍDEO', shape: 'gpu' },
        { name: 'UNIDADE SSD', short: 'SSD / ARMAZENAMENTO', shape: 'ssd' },
        { name: 'COOLER DO SISTEMA', short: 'COOLER / VENTILAÇÃO', shape: 'fan' },
        { name: 'CHIPSET', short: 'CHIPSET / CONTROLADOR', shape: 'chip' },
        { name: 'CONTROLADOR DE REDE', short: 'REDE / CONTROLADOR', shape: 'network' },
        { name: 'BANCO DE CAPACITORES', short: 'CAPACITORES / ENERGIA', shape: 'capacitor' }
    ][index];
    const part = (geometry, material, px, py, pz, parent = group) => {
        const mesh = new THREE.Mesh(geometry, material); mesh.position.set(px, py, pz); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    // A base de cada módulo é um obstáculo baixo: contorne-a para chegar ao terminal.
    colliders.push({ x, z, w: 5.2, d: 4.5, floorY: levelY });
    part(new THREE.BoxGeometry(5.2, .42, 4.5), darkMetal, 0, .22, 0);
    part(new THREE.BoxGeometry(4.8, .08, 4.1), board, 0, .47, 0);
    for (let k = 0; k < 5; k++) part(new THREE.BoxGeometry(.055, .025, 1.15), new THREE.MeshBasicMaterial({ color: 0x48e7a4 }), -1.75 + k * .86, .53, .1);
    if (module.shape === 'cpu' || module.shape === 'chip') {
        part(new THREE.BoxGeometry(1.65, .62, 1.55), darkMetal, 0, .82, 0);
        part(new THREE.BoxGeometry(1.32, .1, 1.25), new THREE.MeshStandardMaterial({ color: infected ? 0x741c3c : 0x287a55, emissive: infected ? 0xf32354 : 0x23de91, emissiveIntensity: .6 }), 0, 1.18, 0);
        for (let k = 0; k < 6; k++) part(new THREE.BoxGeometry(.07, .22, .12), copper, -0.7 + k * .28, .72, .86);
    } else if (module.shape === 'ram') {
        for (let k = 0; k < 3; k++) {
            const ram = part(new THREE.BoxGeometry(.62, .28, 3.25), new THREE.MeshStandardMaterial({ color: infected ? 0x8e2143 : 0x257a56, metalness: .62, emissive: infected ? 0x71132b : 0x11643d, emissiveIntensity: .35 }), -1.3 + k * 1.3, .78, 0);
            ram.rotation.y = 0;
            for (let pin = 0; pin < 7; pin++) part(new THREE.BoxGeometry(.04, .04, .13), copper, ram.position.x - .22 + pin * .07, .96, 1.64);
        }
    } else if (module.shape === 'gpu') {
        part(new THREE.BoxGeometry(4.1, .55, 1.35), darkMetal, 0, .75, 0);
        for (const fanX of [-1.25, 0, 1.25]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(.39, .065, 8, 24), new THREE.MeshStandardMaterial({ color: infected ? 0xff425c : 0x37dca0, emissive: infected ? 0xff153d : 0x14bb7f, emissiveIntensity: .7 }));
            ring.position.set(fanX, 1.08, -.02); group.add(ring);
            part(new THREE.CylinderGeometry(.09, .09, .08, 12), copper, fanX, 1.08, -.02).rotation.x = Math.PI / 2;
        }
    } else if (module.shape === 'ssd') {
        part(new THREE.BoxGeometry(3.4, .42, 1.45), new THREE.MeshStandardMaterial({ color: infected ? 0x84203b : 0x235e60, metalness: .72, roughness: .28, emissive: infected ? 0x531020 : 0x08352f, emissiveIntensity: .4 }), 0, .75, 0);
        part(new THREE.BoxGeometry(1.1, .09, .8), copper, -.7, 1.02, 0);
        part(new THREE.BoxGeometry(.65, .09, .8), darkMetal, .65, 1.02, 0);
    } else if (module.shape === 'fan') {
        const fanRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, .14, 10, 32), new THREE.MeshStandardMaterial({ color: infected ? 0xff334e : 0x3fe4aa, emissive: infected ? 0xf50039 : 0x16bd88, emissiveIntensity: .7 }));
        fanRing.rotation.x = Math.PI / 2; fanRing.position.y = .83; group.add(fanRing);
        part(new THREE.CylinderGeometry(.76, .76, .22, 8), darkMetal, 0, .73, 0);
        for (let b = 0; b < 6; b++) { const blade = part(new THREE.BoxGeometry(.18, .08, .85), copper, 0, .86, 0); blade.rotation.y = b * Math.PI / 3; }
        group.userData.fanRing = fanRing;
    } else if (module.shape === 'network') {
        part(new THREE.BoxGeometry(2.1, .6, 1.7), darkMetal, 0, .75, 0);
        for (let k = 0; k < 8; k++) part(new THREE.BoxGeometry(.14, .12, .55), copper, -1.1 + k * .31, .85, .95);
        for (let k = 0; k < 3; k++) part(new THREE.CylinderGeometry(.18, .18, .28, 12), new THREE.MeshStandardMaterial({ color: infected ? 0x991d45 : 0x258c60, emissive: infected ? 0xc81748 : 0x1ec784, emissiveIntensity: .7 }), -.45 + k * .45, 1.18, -.22);
    } else {
        for (let k = 0; k < 7; k++) {
            const cap = part(new THREE.CylinderGeometry(.24, .24, .72, 12), k % 2 ? copper : darkMetal, -1.45 + (k % 4) * .92, .9, k < 4 ? -.75 : .85);
            part(new THREE.CylinderGeometry(.17, .17, .07, 12), new THREE.MeshBasicMaterial({ color: infected ? 0xff426c : 0x53ffb0 }), cap.position.x, 1.29, cap.position.z);
        }
    }
    // Pequenos pinos nas laterais deixam o cenário com aspecto de placa-mãe real.
    for (let i = 0; i < 12; i++) {
        const xPos = -2.15 + (i % 6) * .86;
        const zPos = i < 6 ? -1.86 : 1.86;
        part(new THREE.BoxGeometry(.14, .08, .14), copper, xPos, .56, zPos);
    }
    const label = makeLabelSprite(module.short, infected ? '#ff6d91' : '#86f4c3');
    label.position.set(0, 3.75, 0); group.add(label);
    const virus = new THREE.Group();
    const virusMat = new THREE.MeshStandardMaterial({ color: 0xff234f, emissive: 0xd80032, emissiveIntensity: 1.5, metalness: .25, roughness: .28 });
    const virusCore = new THREE.Mesh(new THREE.DodecahedronGeometry(.55, 0), virusMat); virusCore.castShadow = true; virus.add(virusCore);
    for (let spike = 0; spike < 8; spike++) {
        const angle = spike * Math.PI / 4;
        const thorn = new THREE.Mesh(new THREE.ConeGeometry(.13, .45, 5), virusMat);
        thorn.position.set(Math.cos(angle) * .55, Math.sin(angle) * .55, Math.sin(angle * 1.7) * .26); thorn.rotation.z = -angle; virus.add(thorn);
    }
    virus.position.set(0, 2.05, 0); group.add(virus); virus.visible = infected;
    const aura = new THREE.Mesh(new THREE.TorusGeometry(1.1, .055, 8, 32), new THREE.MeshBasicMaterial({ color: infected ? 0xff305e : 0x3cf5a2, transparent: true, opacity: .9 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = .6; group.add(aura);
    const physicalChallengeByShape = { cpu: 'install', ram: 'sweep', gpu: 'install', ssd: 'wires', fan: 'sweep', chip: 'install', network: 'wires', capacitor: 'wires' };
    return { index, name: module.name, x, z, levelY, group, virus, aura, label, infected, cleaned: false, target: infected, shape: module.shape, challengeType: physicalChallengeByShape[module.shape] || 'wires' };
}
function createComputerInteriorMap() {
    quickWorldScale = 1;
    worldRoot.scale.setScalar(1);
    scene.background.setHex(0x020712);
    scene.fog.color.setHex(0x07182a);
    scene.fog.near = 48;
    scene.fog.far = 205;
    camera.far = 320;
    camera.updateProjectionMatrix();
    hemiLight.color.setHex(0x7ae7ff);
    hemiLight.groundColor.setHex(0x101522);
    areaLightA.color.setHex(0x00cfff);
    areaLightB.color.setHex(0xa42fff);
    areaLightA.position.set(-28, 18, -26);
    areaLightB.position.set(31, 25, 27);

    const frame = 0x101d2b;

    // BASE GIGANTE DA PLACA-MÃE
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(108, 108), new THREE.MeshStandardMaterial({ color: 0x101d2e, roughness: .8, metalness: .5 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; mapRoot.add(floor);
    addBox(0, -.24, 0, 104, .45, 104, 0x14283b, { metalness: .88, emissive: 0x061a2e, emissiveIntensity: .3 });
    const grid = new THREE.GridHelper(102, 102, 0x174e73, 0x0b2a40); grid.position.y = .035; mapRoot.add(grid);
    for (let lane = -5; lane <= 5; lane++) {
        const hue = lane % 2 ? 0x15a98b : 0x1780bf;
        addBox(lane * 8, .055, 0, .13, .035, 98, hue, { emissive: hue, emissiveIntensity: .75, castShadow: false });
        addBox(0, .058, lane * 8, 98, .035, .13, hue, { emissive: hue, emissiveIntensity: .75, castShadow: false });
        for (let p = -4; p <= 4; p += 2) addBox(lane * 8, .085, p * 8, .34, .045, .34, 0xc79b59, { metalness: .8, castShadow: false });
    }

    // GABINETE ALTO: vidro fumê, colunas e moldura superior.
    addBox(0, 19, -51, 103, 38, .65, 0x20435b, { transparent: true, opacity: .18, emissive: 0x0b3852, emissiveIntensity: .35, metalness: .8 });
    addBox(0, 19, 51, 103, 38, .65, 0x20435b, { transparent: true, opacity: .1, emissive: 0x0b3852, emissiveIntensity: .25, metalness: .8 });
    addBox(-51, 19, 0, .65, 38, 103, 0x20435b, { transparent: true, opacity: .14, emissive: 0x0b3852, emissiveIntensity: .25, metalness: .8 });
    addBox(51, 19, 0, .65, 38, 103, 0x20435b, { transparent: true, opacity: .12, emissive: 0x0b3852, emissiveIntensity: .25, metalness: .8 });
    for (const x of [-50, 50]) for (const z of [-50, 50]) {
        addBox(x, 19, z, 1.7, 38, 1.7, frame, { metalness: .9, emissive: 0x0b2639, emissiveIntensity: .4 });
        addBox(x, 19, z, .18, 37, .18, 0x39ddff, { emissive: 0x16bfff, emissiveIntensity: 1.3 });
    }
    addBox(0, 37.8, 0, 101, .65, 101, frame, { metalness: .9, emissive: 0x092339, emissiveIntensity: .4 });
    addBox(0, 37.45, 0, 96, .12, 96, 0x2c9aba, { emissive: 0x1684a5, emissiveIntensity: 1.1 });
    for (const level of [0, 7, 15, 24, 32]) {
        colliders.push({ x: 0, z: -50.5, w: 101, d: .75, floorY: level });
        colliders.push({ x: 0, z: 50.5, w: 101, d: .75, floorY: level });
        colliders.push({ x: -50.5, z: 0, w: .75, d: 101, floorY: level });
        colliders.push({ x: 50.5, z: 0, w: .75, d: 101, floorY: level });
    }

    // Ventiladores frontais de grande porte.
    for (let i = 0; i < 3; i++) {
        const fx = 29 + i * 8;
        addTorus(mapRoot, 3.0, .22, 0x2b9ebc, fx, 20, -49.6, 0, 0, { emissiveIntensity: 1.25 });
        addTorus(mapRoot, 2.55, .085, 0x5beaff, fx, 20, -49.45, 0, 0, { emissiveIntensity: 1.8 });
        for (let blade = 0; blade < 6; blade++) {
            const angle = blade * Math.PI / 3;
            const b = addBox(fx + Math.cos(angle) * 1.15, 20 + Math.sin(angle) * 1.15, -49.35, .42, 1.65, .14, 0x526b7e, { metalness: .7, castShadow: false });
            b.rotation.z = angle;
        }
    }

    // Fonte de alimentação no fundo do gabinete e conectores expostos.
    addBox(35, 2.2, 34, 20, 4.4, 13, 0x17222f, { metalness: .85, emissive: 0x101822, emissiveIntensity: .5 });
    addBox(35, 4.48, 34, 17, .12, 10, 0x33485c, { metalness: .9 });
    for (let i = 0; i < 8; i++) addBox(28 + i * 2, 4.58, 29, .45, .08, .45, i % 2 ? 0xf2c65b : 0x45e8a5, { emissive: i % 2 ? 0xb58428 : 0x159e77, emissiveIntensity: .6 });

    // Tubos de refrigeração líquida visíveis de vários andares.
    const tubeMaterial = new THREE.MeshStandardMaterial({ color: 0x1ec7ff, emissive: 0x007dbb, emissiveIntensity: .8, metalness: .5, roughness: .25 });
    const tubePaths = [
        [[-30, 4, -5], [-30, 7, -5], [-28, 12, -7], [-12, 15, -7]],
        [[-27, 7, 2], [-24, 12, 2], [-12, 15, -2], [8, 15, -2]],
        [[-2, 24, -31], [4, 27, -32], [9, 32, -35], [17, 32, -35]]
    ];
    for (const path of tubePaths) {
        const curve = new THREE.CatmullRomCurve3(path.map(point => new THREE.Vector3(...point)));
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, .22, 8, false), tubeMaterial);
        tube.castShadow = true; mapRoot.add(tube);
    }

    // QUATRO ANDARES: bandeja da RAM, rack da GPU, módulo de refrigeração e compartimento superior.
    addBox(-16, 6.62, 7.5, 48, .76, 35, 0x1b3448, { metalness: .86, emissive: 0x08263a, emissiveIntensity: .45 });
    addBox(-16, 7.02, 7.5, 46, .08, 33, 0x1e594b, { metalness: .65, emissive: 0x0a392c, emissiveIntensity: .7 });
    addBox(27, 14.62, -10.5, 26, .76, 31, 0x263446, { metalness: .9, emissive: 0x182940, emissiveIntensity: .45 });
    addBox(27, 15.02, -10.5, 24, .08, 29, 0x253f53, { metalness: .8, emissive: 0x103e57, emissiveIntensity: .6 });
    addBox(-6.5, 23.62, -36, 47, .76, 20, 0x263b42, { metalness: .85, emissive: 0x123b31, emissiveIntensity: .45 });
    addBox(-6.5, 24.02, -36, 45, .08, 18, 0x27634f, { metalness: .65, emissive: 0x16784c, emissiveIntensity: .6 });
    addBox(31, 31.62, -43.5, 22, .76, 9, 0x303846, { metalness: .9, emissive: 0x24283e, emissiveIntensity: .6 });
    addBox(31, 32.02, -43.5, 20, .08, 7, 0x344d61, { metalness: .75, emissive: 0x0f5473, emissiveIntensity: .8 });

    // Rampas de metal com degraus iluminados; a altura de movimento acompanha cada inclinação.
    const ramps = [
        { x: -21, z: 31, y: 3.5, w: 6, length: Math.sqrt(22*22+7*7), rise: 7, run: 22, z0: 42, steps: 11, low: 0 },
        { x: 11, z: 14, y: 11, w: 6, length: Math.sqrt(18*18+8*8), rise: 8, run: 18, z0: 23, steps: 10, low: 7 },
        { x: 17, z: -16.5, y: 19.5, w: 6, length: Math.sqrt(19*19+9*9), rise: 9, run: 19, z0: -7, steps: 11, low: 15 },
        { x: 17, z: -35, y: 28, w: 6, length: Math.sqrt(18*18+8*8), rise: 8, run: 18, z0: -26, steps: 10, low: 24 }
    ];
    for (let ri = 0; ri < ramps.length; ri++) {
        const r = ramps[ri];
        const angle = Math.atan2(r.rise, r.run);
        const mesh = addBox(r.x, r.y, r.z, r.w, .55, r.length, 0x27394c, { metalness: .9, emissive: 0x0e283c, emissiveIntensity: .5 });
        mesh.rotation.x = angle;
        const railL = addBox(r.x - r.w/2, r.y + .28, r.z, .18, .25, r.length, 0x11c6e7, { emissive: 0x00bfff, emissiveIntensity: 1.2 }); railL.rotation.x = angle;
        const railR = addBox(r.x + r.w/2, r.y + .28, r.z, .18, .25, r.length, 0x11c6e7, { emissive: 0x00bfff, emissiveIntensity: 1.2 }); railR.rotation.x = angle;
        for (let step = 0; step < r.steps; step++) {
            const t = (step + .5) / r.steps;
            const z = r.z0 - t * r.run;
            const y = r.low + t * r.rise + .12;
            addBox(r.x, y, z, r.w - .35, .12, .36, ri % 2 ? 0x4de7f4 : 0x73ffc8, { emissive: ri % 2 ? 0x00aeca : 0x19b66e, emissiveIntensity: .75, castShadow: false });
        }
    }

    // Pentes de memória, capacitores, conectores e cartões de expansão.
    for (let i = 0; i < 10; i++) {
        const x = -35 + i * 3.2;
        addBox(x, .55, -43, .72, 1.1, 3.8, i % 2 ? 0x1d7654 : 0x245d78, { metalness: .7, emissive: i % 2 ? 0x0f6941 : 0x064c75, emissiveIntensity: .6 });
        for (let pin = 0; pin < 6; pin++) addBox(x - .25 + pin * .1, 1.12, -43, .035, .08, 3.4, 0xd6b56a, { castShadow: false });
    }
    for (let i = 0; i < 9; i++) {
        const x = 28 + (i % 3) * 3.2;
        const z = -10 + Math.floor(i / 3) * 4.5;
        addCylinder(x, z, .55, 2.8 + (i % 2) * .6, 0x24384a, { solid: false, emissive: 0x0d7d86, emissiveIntensity: .65, segments: 16 });
    }
    for (let i = 0; i < 7; i++) {
        const z = -43 + i * 2.3;
        addBox(-37, 25.1, z, 5.4, .36, 1.35, i % 2 ? 0x246b59 : 0x27516f, { metalness: .85, emissive: i % 2 ? 0x0c6041 : 0x103f68, emissiveIntensity: .65 });
        addBox(-37, 25.33, z, 4.9, .06, 1.06, 0xcca65f, { metalness: .9, castShadow: false });
    }
    for (let cable = 0; cable < 5; cable++) {
        const pts = [new THREE.Vector3(45, 2 + cable * .08, 38 - cable * 2), new THREE.Vector3(46, 7, 28 - cable * 2), new THREE.Vector3(46, 15, 12 - cable * 2), new THREE.Vector3(44, 24, -12 - cable * 2), new THREE.Vector3(43, 32, -34 - cable * 1.5)];
        const curve = new THREE.CatmullRomCurve3(pts);
        const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .09 + cable * .012, 6, false), new THREE.MeshStandardMaterial({ color: [0x202b38, 0xe5b63d, 0x31a7dc, 0xb44ee0, 0x5bd18a][cable], metalness: .45, roughness: .4, emissive: [0x101820, 0x5d4010, 0x064a67, 0x491065, 0x0c5d2d][cable], emissiveIntensity: .5 }));
        mapRoot.add(wire);
    }

    // DETALHES DE HARDWARE: placa-mãe física, CPU, dissipador, slots, GPU tripla, baias e conectores.
    addBox(-16, .10, -7, 40, .16, 34, 0x143f37, { metalness: .74, emissive: 0x082c28, emissiveIntensity: .6 });
    for (let i=0; i<9; i++) {
        const tx = -34 + i*4.25;
        addBox(tx, .205, -7, .055, .035, 30, i%2 ? 0x398d77 : 0x2d789f, { emissive: i%2 ? 0x155b43 : 0x0f4769, emissiveIntensity: .5, castShadow:false });
    }
    for (let i=0; i<8; i++) {
        const tz = -21 + i*4;
        addBox(-16, .21, tz, 35, .035, .055, i%2 ? 0x398d77 : 0x2d789f, { emissive: i%2 ? 0x155b43 : 0x0f4769, emissiveIntensity: .5, castShadow:false });
    }
    // CPU e dissipador de calor sobre o soquete.
    addBox(-25, .34, -8, 8.4, .38, 8.4, 0x35485a, { metalness:.88, emissive:0x092637, emissiveIntensity:.4 });
    addBox(-25, .62, -8, 5.5, .22, 5.5, 0x172333, { metalness:.9 });
    addBox(-25, .78, -8, 4.3, .16, 4.3, 0x5b6875, { metalness:.9, emissive:0x1b4557, emissiveIntensity:.35 });
    for (let fx=-27.0; fx<=-23.01; fx+=.42) addBox(fx, 1.47, -8, .12, 1.2, 4.0, 0x90a7b8, { metalness:.92, roughness:.26 });
    for (let fz=-10.0; fz<=-6.01; fz+=.42) addBox(-25, 1.47, fz, 4.0, 1.2, .12, 0x8097a9, { metalness:.92, roughness:.26 });
    addTorus(mapRoot, 1.35, .12, 0x39eaff, -25, 2.12, -8, Math.PI/2, 0, {emissiveIntensity:1.45});
    addTorus(mapRoot, .92, .07, 0x36799b, -25, 2.14, -8, Math.PI/2, 0, {emissiveIntensity:.8});
    addCylinder(-25,-8,.43,.20,0x4bdfff,{floorY:2.05,topScale:.8,segments:20,emissive:0x1aaed1,emissiveIntensity:1});
    // Placa gráfica no segundo compartimento, com três ventiladores grandes.
    addBox(27, 16.05, -10.5, 19.5, 1.20, 5.8, 0x171f2b, { metalness:.9, emissive:0x121e31, emissiveIntensity:.45 });
    addBox(27, 16.69, -10.5, 17.8, .10, 5.0, 0x2e4657, { metalness:.9, emissive:0x0d354d, emissiveIntensity:.65 });
    for (const fanX of [21.5,27,32.5]) {
        addTorus(mapRoot, 1.18, .12, 0x4c6c82, fanX, 16.78, -10.5, Math.PI/2, 0, {emissiveIntensity:.85});
        addTorus(mapRoot, .76, .055, 0x46dfff, fanX, 16.80, -10.5, Math.PI/2, 0, {emissiveIntensity:1.3});
        addCylinder(fanX,-10.5,.27,.11,0x101923,{floorY:16.8,topScale:1,segments:16,emissive:0x13a9d4,emissiveIntensity:.65});
        for (let blade=0; blade<5; blade++) {
            const a=blade*Math.PI*2/5;
            const fin=addBox(fanX+Math.cos(a)*.55,16.80,-10.5+Math.sin(a)*.55,.18,.055,.90,0x6b8497,{metalness:.8,castShadow:false});
            fin.rotation.y=-a;
        }
    }
    // Bancos de memória RAM com trava superior e contatos inferiores.
    for (let bank=0; bank<4; bank++) {
        const rx=-9.6+bank*2.05;
        addBox(rx,8.15,8.7,1.28,1.2,5.4,bank%2?0x1c7253:0x205b86,{metalness:.72,emissive:bank%2?0x0d593b:0x0b3d68,emissiveIntensity:.7});
        addBox(rx,8.78,8.7,1.12,.09,5.15,0x8596a5,{metalness:.92});
        for(let chip=0;chip<5;chip++) addBox(rx,8.28,6.9+chip*.82,.48,.48,.48,0x111b2a,{metalness:.75,emissive:0x082b3c,emissiveIntensity:.35});
        for(let pin=0;pin<9;pin++) addBox(rx-.48+pin*.12,7.52,8.7,.045,.07,4.7,0xd5b56f,{metalness:.85,castShadow:false});
    }
    // Baias de SSD e painel de entrada/saída do gabinete.
    for (let bay=0; bay<4; bay++) {
        const by=2.0+bay*2.35;
        addBox(44,by,22,8.4,1.7,7.5,0x1a2634,{metalness:.86,emissive:0x0d1d2a,emissiveIntensity:.5});
        addBox(44,by+.72,18.15,7.4,.10,.12,bay%2?0x2b92c6:0x45dfa0,{emissive:bay%2?0x136089:0x13895c,emissiveIntensity:1.0});
        for(let port=0;port<4;port++) addBox(41.2+port*1.75,by,18.05,.8,.45,.14,0x070e17,{metalness:.25});
    }
    addBox(-46,2.0,37,7,3.5,14,0x1b2837,{metalness:.85,emissive:0x09253b,emissiveIntensity:.4});
    for(let port=0;port<6;port++) {
        addBox(-42.6,1.0+port*.48,31.6,.18,.24,.65,port%2?0x4b7a8b:0x2c4c60,{metalness:.9});
        addBox(-42.45,1.0+port*.48,32.1,.09,.12,.14,port%2?0x68e8e8:0x8ca7b6,{emissive:port%2?0x127c80:0x304c61,emissiveIntensity:.7});
    }
    for(let i=0;i<14;i++) {
        const dx=-35+(i%7)*3.1, dz=11+Math.floor(i/7)*2.8;
        const led=new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),new THREE.MeshBasicMaterial({color:i%3===0?0xff4d6d:i%3===1?0x47f5a0:0x44dfff}));
        led.position.set(dx,.38,dz); mapRoot.add(led);
    }
    const cpuLabel=makeLabelSprite('CPU • COOLER','#85edff'); cpuLabel.position.set(-25,3.0,-8); mapRoot.add(cpuLabel);
    const gpuLabel=makeLabelSprite('GPU • TRIPLE FAN','#ffcf70'); gpuLabel.position.set(27,18.5,-10.5); mapRoot.add(gpuLabel);
    const ramLabel=makeLabelSprite('RAM • MEMORY BANK','#7cffb1'); ramLabel.position.set(-9,10.0,8.7); mapRoot.add(ramLabel);

    createComputerPolish();

    // Componentes infectados em alturas diferentes — é preciso escalar os compartimentos.
    const positions = [
        [-31, 12, 7], [-18, -2, 7], [1, 17, 7],
        [27, 0, 15], [30, -19, 15],
        [-18, -35, 24], [4, -35, 24], [30, -43, 32]
    ];
    const targetCount = ({ facil: 4, medio: 6, dificil: 8 })[selectedMode] || 6;
    positions.forEach(([x, z, levelY], i) => {
        const component = createInfectedComponent(x, z, i, i < targetCount, levelY);
        infectedComponents.push(component);
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, Math.max(1, levelY + 1), 8), new THREE.MeshBasicMaterial({ color: 0x1fbedc, transparent: true, opacity: .16 }));
        beacon.position.set(x + 3, Math.max(.5, levelY / 2), z + 2.8); mapRoot.add(beacon);
    });

    // Portais/aros de serviço reconhecíveis em cada compartimento.
    for (const [x, y, z, accent] of [[-38,7,-1,0x28e9ff],[35,15,-3,0xffb43b],[-28,24,-28,0x64ff9a],[35,32,-43,0xb876ff]]) {
        addBox(x, y + 1.8, z, .22, 3.6, 5.4, accent, { emissive: accent, emissiveIntensity: .95 });
        addBox(x, y + 3.55, z, 3.4, .22, 5.4, accent, { emissive: accent, emissiveIntensity: .95 });
        addBox(x, y + 1.8, z + 2.6, 3.4, 3.6, .22, frame, { metalness: .85 });
    }

    enemySpawnPoints = [[-42,-38],[-21,15],[3,20],[34,1],[30,-20],[-18,-38],[2,-35],[30,-43],[0,40],[-2,0],[40,35],[17,-42]];
    const roamingCount = ({ facil: 5, medio: 7, dificil: 9 })[selectedMode] || 7;
    for (let i = 0; i < roamingCount; i++) {
        const [x, z] = enemySpawnPoints[i];
        const enemy = createVirusRobot(false);
        enemy.position.set(x, floorHeightAt(x, z), z);
        enemy.userData.targetX = x; enemy.userData.targetZ = z;
        enemy.userData.phase = i * .83; enemy.userData.guardIndex = i % positions.length;
        enemy.userData.maxHealth = ownedAbilities.includes('amplifier') ? 2 : 3; enemy.userData.health = enemy.userData.maxHealth;
        mapRoot.add(enemy); enemies.push(enemy);
    }

    // Cristais de dados aparecem na base e em todos os andares, alimentando o poder de isolamento.
    crystals.length = 0; hazards.length = 0; movingPlatforms.length = 0; boss = null; bossActive = false;
    const dataCrystals = [
        [-42,32],[-34,42],[-9,42],[18,40],[37,40],[41,24],
        [-35,19],[-7,20],[5,9],[-34,-1],[-5,1],[0,22],
        [34,3],[20,2],[35,-20],[1,-19],[-6,-20],
        [-29,-39],[-10,-42],[7,-42],[-27,-29],[3,-29],
        [20,-45],[35,-44],[39,-42],[22,-40]
    ];
    dataCrystals.forEach(([x, z], i) => createCrystal(x, z, i));

    player.position.set(-21, 0, 46); playerGroundY = 0; jumpHeight = 0; jumpVelocity = 0; playerHidden = false;
    showEvent('GABINETE ABERTO • ESCALE OS RACKS E DESINFECTE OS COMPONENTES', '#43e8ff');
}
function createWorldPolish() {
    // Camada de acabamento: sinalização, cabos, iluminação e silhuetas adicionais por mapa.
    if (gameType === 'rapido') return;
    if (theme.id === 'cidade') {
        // Faixas laterais das avenidas, postes de luz e painéis holográficos.
        for (let i = -4; i <= 4; i++) {
            const z = i * 10;
            addBox(0, .045, z + 3.8, 101, .025, .08, 0x28748d, { emissive: theme.accent, emissiveIntensity: .7, castShadow: false });
            addBox(0, .045, z - 3.8, 101, .025, .08, 0x28748d, { emissive: theme.accent, emissiveIntensity: .7, castShadow: false });
        }
        for (const [x,z] of [[-14,-14],[14,-14],[-14,14],[14,14],[-40,8],[40,-8]]) {
            addBox(x,.03,z,.8,.05,1.2,0x132b41,{castShadow:false});
            addBox(x,.16,z,.12,.28,.12,0x5a7b90,{metalness:.8});
            addBox(x,3.6,z,.10,6.8,.10,0x31516a,{metalness:.85});
            addBox(x,7,z-.8,1.8,.12,.12,theme.accent,{emissive:theme.accent,emissiveIntensity:1.7,castShadow:false});
            const light = new THREE.PointLight(theme.accent, 5, 12); light.position.set(x,6.6,z-.8); mapRoot.add(light);
        }
        for (const [x,z,color] of [[-40,-8,0x1bcfff],[40,14,0xbd6cff],[-12,36,0x42ffdf]]) {
            addBox(x,5,z,4.8,5.8,.28,0x0d1a30,{metalness:.8,emissive:color,emissiveIntensity:.2});
            addBox(x,5,z-.17,4.25,5.1,.04,0x071426,{emissive:color,emissiveIntensity:.7});
            for(let i=0;i<5;i++) addBox(x-1.6+i*.8,5.2,z-.205,.45,.055,.03,i%2?theme.accent:color,{emissive:color,emissiveIntensity:1.5,castShadow:false});
        }
    } else if (theme.id === 'nucleo') {
        // Dutos aéreos, faixas de segurança e maciços metálicos que dão escala à fábrica.
        for (const y of [4.2, 6.1]) {
            for (const z of [-35,-17,1,19,37]) {
                addBox(0,y,z,96,.36,.42,0x4c3639,{metalness:.9,emissive:0x3e1018,emissiveIntensity:.3});
                addBox(0,y+.2,z,96,.07,.49,theme.accent2,{metalness:.75,emissive:theme.accent2,emissiveIntensity:.85,castShadow:false});
                for (let x=-42;x<=42;x+=14) addBox(x,y-.65,z,.28,1.3,.34,0x37404a,{metalness:.9});
            }
        }
        for (const [x,z] of [[-38,-23],[-16,26],[14,-1],[39,29],[-3,-42]]) {
            addBox(x,1.8,z,5.5,3.6,5.5,0x33242b,{solid:true,floorY:0,metalness:.9,emissive:0x61151c,emissiveIntensity:.24});
            addBox(x,3.68,z,4.8,.16,4.8,0x6c3c31,{metalness:.9,emissive:theme.accent2,emissiveIntensity:.5});
            for(let i=0;i<4;i++) addBox(x-1.6+i*1.05,3.79,z,.22,.08,3.9,i%2?0xff4a32:0xffd04d,{emissive:i%2?0xaa170c:0xb47b12,emissiveIntensity:.65,castShadow:false});
        }
        // Marcação industrial diagonal nas zonas de calor.
        for (const h of hazards) {
            for(let i=-2;i<=2;i++) addBox(h.x+i*.52,.06,h.z-h.radius*.45, .22,.035,h.radius*1.4,0xffc343,{emissive:0x7d4b0b,emissiveIntensity:.4,castShadow:false});
        }
    } else if (theme.id === 'floresta') {
        // Camadas de vegetação, pedras, bioluminescência e raízes sobre os caminhos.
        for (let i=0;i<24;i++) {
            const angle=i*2.3999632297, radius=18+(i%7)*4.1;
            const x=Math.cos(angle)*radius, z=Math.sin(angle)*radius;
            const mound=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),new THREE.MeshStandardMaterial({color:i%3===0?0x1a4931:0x173c2a,roughness:1}));
            mound.position.set(x,-.55+(i%3)*.04,z); mound.scale.set(3.3+(i%4)*.45,.9+(i%3)*.15,2.5+(i%5)*.35); mound.castShadow=true; mound.receiveShadow=true; mapRoot.add(mound);
            if (!houses.some(h => Math.abs(x-h.cx) < mound.scale.x + h.w/2 && Math.abs(z-h.cz) < mound.scale.z + h.d/2)) colliders.push({x,z,w:mound.scale.x*1.35,d:mound.scale.z*1.35,floorY:0});
            if(i%2===0){
                const mushroom=new THREE.Group(); mushroom.position.set(x+(i%4)*.8,.05,z-.8);
                const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.16,.55,8),new THREE.MeshStandardMaterial({color:0x59785c,roughness:.8}));stalk.position.y=.27;mushroom.add(stalk);
                const cap=new THREE.Mesh(new THREE.SphereGeometry(.32,12,8),new THREE.MeshStandardMaterial({color:i%4===0?0x69ff9d:0x45dfff,emissive:i%4===0?0x28b85b:0x087d98,emissiveIntensity:1.05}));cap.scale.y=.55;cap.position.y=.55;mushroom.add(cap);mapRoot.add(mushroom);
            }
        }
        for (const [x,z,length] of [[-8,-14,12],[10,18,16],[31,-2,11],[-32,12,13],[4,39,10]]) {
            const root=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,length,8),new THREE.MeshStandardMaterial({color:0x3c6040,roughness:.95,emissive:0x102e1a,emissiveIntensity:.4}));
            root.position.set(x,.35,z);root.rotation.z=Math.PI/2.8;root.rotation.y=.35;root.castShadow=true;mapRoot.add(root);
            addBox(x,.18,z,length*.78,.12,.22,0x4fb76a,{emissive:0x1a6b37,emissiveIntensity:.35,castShadow:false});
        }
        // Pontes e pontos de orientação no meio da vegetação.
        for(const [x,z] of [[-18,-2],[17,29],[36,-24],[-36,33]]){
            addBox(x,.42,z,7,.42,5,0x344b39,{metalness:.35,emissive:0x0d2516,emissiveIntensity:.3});
            for(const side of [-1,1]) addBox(x+side*3.2,.9,z,.18,1.0,5,theme.accent,{emissive:theme.accent,emissiveIntensity:.55});
        }
    }
}
function createComputerPolish() {
    // Detalhes de montagem que ajudam o gabinete a parecer hardware e não apenas uma arena.
    // Parafusos e trilhas de cobre por todo o backplane.
    for (let x=-45;x<=45;x+=6) {
        for (const z of [-47, -12, 12, 47]) {
            const screw = new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.08,12),new THREE.MeshStandardMaterial({color:0x8b9ca8,metalness:.95,roughness:.22}));
            screw.position.set(x,.09,z); screw.rotation.x=Math.PI/2; mapRoot.add(screw);
            addBox(x,.14,z,.12,.035,.035,0x253647,{metalness:.8,castShadow:false});
        }
    }
    // Trilhas de circuito luminosas conectam zonas funcionais na placa-mãe.
    const traceColors=[0x33d8bd,0x2ba6df,0xdaa85a,0x8d69e8];
    for(let i=0;i<18;i++){
        const x=-42+(i%9)*10.5, z=-21+Math.floor(i/9)*42;
        const width=.055+(i%3)*.025;
        addBox(x,.12,z, width,.035, 17+(i%4)*2,traceColors[i%traceColors.length],{emissive:traceColors[i%traceColors.length],emissiveIntensity:.7,castShadow:false});
        addBox(x+(i%2?1.8:-1.8),.125,z+(i%3-1)*5,3.6,.04,width,traceColors[(i+1)%traceColors.length],{emissive:traceColors[(i+1)%traceColors.length],emissiveIntensity:.6,castShadow:false});
    }
    // Racks de cabos grossos com braçadeiras, próximos às laterais do gabinete.
    for(let side of [-1,1]){
        for(let bundle=0;bundle<5;bundle++){
            const x=side*(42-bundle*.42), z=-28+bundle*13;
            const curve=new THREE.CatmullRomCurve3([
                new THREE.Vector3(x,1.8,z-7), new THREE.Vector3(x-side*1.2,4.5,z-3),
                new THREE.Vector3(x-side*1.3,8.2,z+1),new THREE.Vector3(x,11.2,z+5)
            ]);
            const color=[0x18212e,0x3c95b5,0x9d6acc,0x53bd85,0xbca35e][bundle];
            const cable=new THREE.Mesh(new THREE.TubeGeometry(curve,22,.12,7,false),new THREE.MeshStandardMaterial({color,metalness:.55,roughness:.4,emissive:color,emissiveIntensity:.2}));mapRoot.add(cable);
            for(let clip=0;clip<3;clip++) addBox(x-side*.35,3.1+clip*2.7,z-4+clip*4,.48,.12,.38,0x536b7b,{metalness:.9});
        }
    }
    // Indicadores de alimentação por andar.
    for(const [y,x,z] of [[1,43,0],[8,-42,5],[16,43,-13],[25,-42,-34],[33,42,-44]]){
        for(let i=0;i<5;i++) addBox(x+i*.32,y,z,.13,.16,.1,i%2?0x3ef4b0:0x35dcff,{emissive:i%2?0x2af59c:0x18a9ff,emissiveIntensity:1.4,castShadow:false});
    }
}

function createMap(id) {
    clearMap();
    selectedMap = id;
    theme = gameType === 'desinfeccao' ? THEMES.computador : THEMES[id];
    quickWorldScale = gameType === 'rapido' ? 0.56 : 1;
    worldRoot.scale.setScalar(quickWorldScale);
    scene.background.setHex(theme.background);
    scene.fog.color.setHex(theme.fog); scene.fog.near = gameType === 'rapido' ? 25 : 48; scene.fog.far = gameType === 'rapido' ? 95 : 150;
    hemiLight.color.setHex(theme.id === 'floresta' ? 0x7cffad : theme.id === 'nucleo' ? 0xffb08b : 0xa9c9ff);
    hemiLight.groundColor.setHex(theme.ground);
    areaLightA.color.setHex(theme.lightA); areaLightB.color.setHex(theme.lightB);
    areaLightA.position.set(-25,8,-24); areaLightB.position.set(27,9,27);

    if (gameType === 'desinfeccao') {
        createComputerInteriorMap();
        player.position.set(-21, 0, 46); playerGroundY = 0; jumpHeight = 0; jumpVelocity = 0; playerHidden = false;
        applyPlayerThemeStyle(); updateHiding(); updateHUD(); refreshMapCards(); setViewMode(viewMode);
        return;
    }

    const mapDiameter = 112; // O worldRoot é que comprime a área no modo rápido.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(mapDiameter,mapDiameter), new THREE.MeshStandardMaterial({color:theme.ground,roughness:.9,metalness:.18}));
    ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; mapRoot.add(ground);
    const grid = new THREE.GridHelper(108,108,theme.gridMain,theme.gridSub); grid.position.y=.025; if(theme.id==='floresta') grid.visible=false; mapRoot.add(grid);
    // Limites periféricos ajudam a perceber a escala do mundo.
    const boundaryColor = theme.id === 'nucleo' ? 0x733039 : theme.id === 'floresta' ? 0x205b39 : 0x123e64;
    addBox(0,.65,-55,110,1.3,.55,boundaryColor,{emissive:theme.accent,emissiveIntensity:.22});
    addBox(0,.65,55,110,1.3,.55,boundaryColor,{emissive:theme.accent,emissiveIntensity:.22});
    addBox(-55,.65,0,.55,1.3,110,boundaryColor,{emissive:theme.accent,emissiveIntensity:.22});
    addBox(55,.65,0,.55,1.3,110,boundaryColor,{emissive:theme.accent,emissiveIntensity:.22});

    createHouse(-31,0,'Abrigo Alfa',1);
    createHouse(33,22,'Abrigo Beta',.92);
    createHouse(-33,35,'Abrigo Gamma',.78);
    createThemedLandmarks();
    createThemedDistricts();
    createUpperPlatform();
    createSecondSkyDistrict();
    if (theme.id === 'cidade') {
        createMovingPlatform(-12, -8, 'x', 8, .48, .4);
        createMovingPlatform(12, 17, 'z', 7, .42, 1.7);
        createMovingPlatform(-28, 22, 'x', 6, .36, 2.8);
    }
    createHazardsForMap();
    createWorldPolish();

    makeEnemySpawnPoints();
    for (let i=0;i<enemySpawnPoints.length;i++) {
        const [x,z] = enemySpawnPoints[i];
        const enemy = createVirusRobot(false); enemy.position.set(x,floorHeightAt(x,z),z);
        enemy.userData.targetX=x; enemy.userData.targetZ=z; enemy.userData.phase=i*.74; enemy.userData.maxHealth=ownedAbilities.includes('amplifier')?2:3; enemy.userData.health=enemy.userData.maxHealth; mapRoot.add(enemy); enemies.push(enemy);
    }

    // Distribui mais de 80 cristais pelo mapa e evita paredes/zonas perigosas.
    const candidates=[];
    for (let row=0,z=-49;z<=49;row++,z+=7) {
        const offset = row % 2 ? 2.2 : 0;
        for (let x=-49+offset;x<=49;x+=7) {
            const px=x+Math.sin(row*1.7+x*.08)*.8;
            const pz=z+Math.cos(x*.7+row)*.8;
            if (Math.hypot(px,pz)<12) continue;
            if (isBlocked(px,pz,floorHeightAt(px,pz),.85)) continue;
            if (hazards.some(h=>Math.hypot(h.x-px,h.z-pz)<h.radius+1.5)) continue;
            candidates.push([px,pz]);
        }
    }
    // Espalhamento determinístico: pontos mais próximos do centro aparecem primeiro e o resto cobre toda a área.
    const chosen=[];
    const pool=[...candidates];
    // Amostragem por maior distância: espalha os itens por todo o mapa, em vez de
    // concentrá-los perto do ponto inicial.
    while(pool.length && chosen.length<88) {
        let bestIndex=0, bestDistance=-1;
        for(let i=0;i<pool.length;i++) {
            const point=pool[i];
            let distance=chosen.length===0 ? Math.hypot(point[0],point[1]) : Infinity;
            if(chosen.length>0) {
                for(const picked of chosen) distance=Math.min(distance,Math.hypot(point[0]-picked[0],point[1]-picked[1]));
            }
            if(distance>bestDistance){bestDistance=distance;bestIndex=i;}
        }
        chosen.push(pool.splice(bestIndex,1)[0]);
    }
    chosen.forEach(([x,z],i)=>createCrystal(x,z,i));

    boss = createVirusRobot(true);
    boss.position.set(47,floorHeightAt(47,-46),-46); boss.visible=false; boss.userData.health=currentRules().bossHp; boss.userData.maxHealth=boss.userData.health;
    boss.userData.stunnedUntil=0; boss.userData.phase=7; boss.userData.moving=false; mapRoot.add(boss);

    player.position.set(0,0,0); playerGroundY=0; jumpHeight=0; jumpVelocity=0; playerHidden=false;
    applyPlayerThemeStyle();
    updateHiding(); updateHUD(); refreshMapCards(); setViewMode(viewMode);
}
function createCrystal(x,z,index) {
    const floorY=floorHeightAt(x,z); const root=new THREE.Group(); root.position.set(x,floorY,z);
    const glowMat=new THREE.MeshStandardMaterial({color:theme.crystal,emissive:theme.crystal,emissiveIntensity:2.0,metalness:.38,roughness:.18});
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.48,0),glowMat); core.position.y=1.15; core.castShadow=true; root.add(core);
    const outer=new THREE.Mesh(new THREE.IcosahedronGeometry(.64,0),new THREE.MeshStandardMaterial({color:theme.crystalAlt,emissive:theme.crystalAlt,emissiveIntensity:.8,metalness:.5,roughness:.2,wireframe:true,transparent:true,opacity:.8})); outer.position.y=1.15; root.add(outer);
    const orbitA=addTorus(root,.7,.026,theme.accent,0,1.15,0,.48,0,{emissiveIntensity:1.8});
    const orbitB=addTorus(root,.78,.022,theme.crystalAlt,0,1.15,0,-.65,.2,{emissiveIntensity:1.5});
    const halo=addTorus(root,.5,.04,theme.accent,0,.06,0,Math.PI/2,0,{emissiveIntensity:1.6});
    const sparkles=[];
    for(let i=0;i<4;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),new THREE.MeshBasicMaterial({color:i%2?theme.crystalAlt:theme.accent}));root.add(s);sparkles.push(s);}
    mapRoot.add(root); crystals.push({root,core,outer,orbitA,orbitB,halo,sparkles,x,z,floorY,phase:index*.73,active:true});
}

function formatCountdown(totalSeconds) {
    const s = Math.max(0, Math.ceil(totalSeconds));
    const minutes = Math.floor(s / 60).toString().padStart(2, '0');
    const seconds = (s % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}
function missionDurationForDifficulty() { return ({ facil: 360, medio: 300, dificil: 240 })[selectedMode] || 300; }
function protocolDurationForDifficulty() { return ({ facil: 42, medio: 34, dificil: 27 })[selectedMode] || 34; }
function updateMissionClockText() {
    if (!missionTimeText || !missionTimeBox) return;
    const shown = Math.ceil(missionTimeLeft);
    if (shown !== lastMissionTimeShown) { missionTimeText.textContent = formatCountdown(missionTimeLeft); lastMissionTimeShown = shown; }
    missionTimeBox.classList.toggle('timer-warning', missionTimeLeft <= 45);
    missionTimeBox.classList.toggle('hidden', gameType !== 'desinfeccao' || !['playing','paused'].includes(gameState));
}
function updateChallengeTimers(dt) {
    if (gameState !== 'playing') return;
    // O relógio geral também corre durante a resolução dos protocolos.
    if (gameType === 'desinfeccao' && missionTimeLeft > 0) {
        missionTimeLeft = Math.max(0, missionTimeLeft - dt);
        updateMissionClockText();
        if (missionTimeLeft <= 0) {
            endMission(false);
            showEvent('TEMPO DA OPERAÇÃO ESGOTADO • COMPUTADOR AINDA INFECTADO', '#ff4968');
            return;
        }
    }
    if (!activeChallenge || activeChallenge.completing) return;
    activeChallenge.timeLeft = Math.max(0, activeChallenge.timeLeft - dt);
    const seconds = Math.ceil(activeChallenge.timeLeft);
    if (seconds !== lastChallengeTimeShown) {
        challengeTimer.textContent = `TEMPO DO PROTOCOLO: ${seconds}s  •  OPERAÇÃO: ${formatCountdown(missionTimeLeft)}`;
        challengeTimer.classList.toggle('timer-warning', seconds <= 8);
        lastChallengeTimeShown = seconds;
    }
    if (activeChallenge.timeLeft <= 0) {
        const expiredComponent = activeChallenge.component;
        if (activeChallenge.cleanup) activeChallenge.cleanup();
        activeChallenge = null;
        challengeScreen.classList.add('hidden'); challengeOptions.innerHTML = ''; challengeFeedback.textContent = ''; challengeTarget.innerHTML = ''; clearPhysicalChallengeLayout();
        activeComponent = expiredComponent; challengeTimer.textContent = 'PROTOCOLO EXPIRADO';
        showEvent('TEMPO ESGOTADO • VOCÊ PERDEU 1 VIDA', '#ff4968');
        damagePlayer('PROTOCOLO EXPIRADO');
        if (gameState === 'playing' && viewMode === 'first') requestMouseLook();
    }
}
function updateMinimap() {
    if (!minimapPanel || !minimapContext || !minimapCanvas) return;
    const visible = gameState === 'playing';
    minimapPanel.classList.toggle('hidden', !visible);
    if (!visible) return;
    const ctx = minimapContext, w = minimapCanvas.width, h = minimapCanvas.height;
    ctx.clearRect(0,0,w,h); ctx.fillStyle = '#06111f'; ctx.fillRect(0,0,w,h);
    const pad = 11, span = WORLD.max - WORLD.min;
    const px = x => pad + ((x - WORLD.min) / span) * (w - pad * 2);
    const py = z => pad + ((WORLD.max - z) / span) * (h - pad * 2);
    ctx.strokeStyle = 'rgba(62,116,145,.22)'; ctx.lineWidth = 1;
    for(let i=1;i<5;i++) { const a=pad+(w-pad*2)*i/5; ctx.beginPath();ctx.moveTo(a,pad);ctx.lineTo(a,h-pad);ctx.stroke(); const b=pad+(h-pad*2)*i/5;ctx.beginPath();ctx.moveTo(pad,b);ctx.lineTo(w-pad,b);ctx.stroke(); }
    ctx.strokeStyle = theme.id==='nucleo'?'#ad3a36':theme.id==='floresta'?'#2f8c52':'#24768f'; ctx.lineWidth=2; ctx.strokeRect(pad,pad,w-pad*2,h-pad*2);
    let threatCount = 0;
    for(const enemy of enemies) {
        if(!enemy.visible) continue;
        threatCount++; const x=px(enemy.position.x), y=py(enemy.position.z);
        ctx.beginPath();ctx.fillStyle=theme.id==='nucleo'?'#ffd24f':theme.id==='floresta'?'#ff3f5f':'#ff4c71';ctx.arc(x,y,4.2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(255,80,120,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();
    }
    if(gameType==='desinfeccao') {
        for(const component of infectedComponents) {
            if(!component.target || component.cleaned) continue;
            const x=px(component.x),y=py(component.z);ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#ffd96b';ctx.fillRect(-4,-4,8,8);ctx.restore();
        }
    }
    if(boss && bossActive && boss.visible) { ctx.fillStyle='#ffb843';ctx.beginPath();ctx.arc(px(boss.position.x),py(boss.position.z),6,0,Math.PI*2);ctx.fill(); }
    const playerX=px(player.position.x), playerY=py(player.position.z), heading=viewMode==='first'?cameraYaw:player.rotation.y;
    ctx.save();ctx.translate(playerX,playerY);ctx.rotate(heading);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(0,3);ctx.lineTo(-5,5);ctx.closePath();ctx.fillStyle='#5af4ff';ctx.fill();ctx.restore();
    if(minimapThreatCount) minimapThreatCount.textContent=String(threatCount);
}

function updateComputerInteractions() {
    if (gameType !== 'desinfeccao' || gameState !== 'playing' || activeChallenge) {
        interactionPrompt.classList.add('hidden'); return;
    }
    let nearest = null, nearestDistance = Infinity;
    for (const component of infectedComponents) {
        if (!component.target || component.cleaned) continue;
        const distance = Math.hypot(player.position.x - component.x, player.position.z - component.z, playerGroundY - (component.levelY || 0));
        if (distance < nearestDistance) { nearest = component; nearestDistance = distance; }
    }
    if (nearest && nearestDistance < 6.0) {
        activeComponent = nearest;
        interactionTitle.textContent = `INFECÇÃO DETECTADA: ${nearest.name}`;
        interactionDescription.textContent = 'Pressione E ou use o botão para abrir o protocolo de diagnóstico.';
        interactionPrompt.classList.remove('hidden');
    } else {
        activeComponent = null;
        interactionPrompt.classList.add('hidden');
    }
}
const WIRE_SET = [
    { id: 'power', label: 'ENERGIA', color: '#ff646f' },
    { id: 'data', label: 'DADOS', color: '#4de3ff' },
    { id: 'ground', label: 'ATERRAMENTO', color: '#67f59b' },
    { id: 'cooling', label: 'REFRIGERAÇÃO', color: '#ffd166' }
];

function shuffleItems(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function setPhysicalChallengeLayout() {
    challengeTarget.classList.add('physical-target');
    challengeOptions.classList.add('physical-options');
    challengeSubmit.classList.add('hidden');
    challengeSubmit.disabled = true;
}
function clearPhysicalChallengeLayout() {
    challengeTarget.classList.remove('physical-target');
    challengeOptions.classList.remove('physical-options');
}
function updatePhysicalProgress(done, total, caption) {
    const label = $('#repair-progress-label');
    const fill = $('#repair-progress-fill');
    if (label) label.textContent = `${caption} • ${done}/${total}`;
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, done / total * 100))}%`;
}
function showRepairProgress(caption, total) {
    challengeFeedback.innerHTML = `<div class="repair-progress"><div class="repair-progress-top"><span id="repair-progress-label">${caption} • 0/${total}</span><strong>${total} ETAPAS</strong></div><div class="repair-progress-track"><div id="repair-progress-fill"></div></div></div>`;
}
function openComponentChallenge() {
    if (gameType !== 'desinfeccao' || gameState !== 'playing' || !activeComponent) return;
    const distance = Math.hypot(player.position.x - activeComponent.x, player.position.z - activeComponent.z, playerGroundY - (activeComponent.levelY || 0));
    if (distance > 6.0 || activeComponent.cleaned) return;
    const component = activeComponent;
    activeChallenge = {
        component, type: component.challengeType, timeLeft: protocolDurationForDifficulty(),
        completing: false, connected: {}, selectedWire: null, selectedPart: null,
        sweeping: false, swept: 0, totalDust: 28, installed: {}
    };
    lastChallengeTimeShown = -1;
    challengeTimer.textContent = `TEMPO DO PROTOCOLO: ${Math.ceil(activeChallenge.timeLeft)}s  •  OPERAÇÃO: ${formatCountdown(missionTimeLeft)}`;
    challengeTimer.classList.remove('timer-warning');
    // O mundo continua em execução por trás do painel: inimigos, ameaças e relógio não são pausados.
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    challengeScreen.classList.remove('hidden');
    challengeCancel.disabled = false;
    challengeTitle.textContent = component.name;
    challengeFeedback.textContent = '';
    challengeOptions.innerHTML = '';
    challengeTarget.innerHTML = '';
    setPhysicalChallengeLayout();

    if (activeChallenge.type === 'wires') {
        challengeDescription.textContent = 'REPARO FÍSICO • Selecione um conector de um lado e ligue-o à porta correspondente do outro lado.';
        challengeTarget.innerHTML = `<div class="repair-target-heading"><span class="repair-chip">MODO MANUTENÇÃO</span><strong>REFAÇA O CHICOTE DE CABOS</strong></div><p>Conecte os quatro cabos nas portas correspondentes. Clique primeiro em uma ponta à esquerda e depois na porta certa à direita.</p>`;
        challengeOptions.innerHTML = `<div class="repair-shell"><div class="repair-progress-top"><span id="repair-progress-label">CABOS CONECTADOS • 0/4</span><strong>PAINEL I/O</strong></div><div class="wire-board" id="wire-board"><svg class="wire-lines" id="wire-lines" aria-hidden="true"></svg><div class="wire-column"><h3>SAÍDA DO MÓDULO</h3>${shuffleItems(WIRE_SET).map(w => `<button type="button" class="wire-pin" data-side="source" data-wire="${w.id}" style="--wire:${w.color}"><i></i><span>${w.label}</span></button>`).join('')}</div><div class="wire-column wire-destinations"><h3>PORTAS DA PLACA</h3>${shuffleItems(WIRE_SET).map((w,i) => `<button type="button" class="wire-pin" data-side="target" data-wire="${w.id}" style="--wire:${w.color}"><i></i><span>J${i+1} / ${w.label}</span></button>`).join('')}</div></div><div class="repair-progress-track"><div id="repair-progress-fill"></div></div><p class="repair-footnote">Dica: use a cor e a função do cabo para encontrar a entrada correta.</p></div>`;
        setupWirePuzzle(component);
    } else if (activeChallenge.type === 'sweep') {
        challengeDescription.textContent = 'LIMPEZA DE CONTATOS • Arraste a vassoura sobre toda a poeira e os resíduos da memória.';
        challengeTarget.innerHTML = `<div class="repair-target-heading"><span class="repair-chip">LIMPEZA DE MEMÓRIA</span><strong>REMOÇÃO DE RESÍDUOS</strong></div><p>Segure o botão esquerdo do mouse e varra a superfície. No celular, toque e arraste o dedo. O procedimento só termina quando todos os resíduos forem removidos.</p>`;
        const dust = Array.from({length: activeChallenge.totalDust}, (_, i) => {
            const left = 5 + Math.random() * 88, top = 7 + Math.random() * 80;
            const size = 5 + Math.random() * 7;
            return `<span class="dust-particle" data-dust="${i}" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;--dust-rot:${Math.round(Math.random()*360)}deg"></span>`;
        }).join('');
        challengeOptions.innerHTML = `<div class="repair-shell"><div class="repair-progress-top"><span id="repair-progress-label">RESÍDUOS REMOVIDOS • 0/${activeChallenge.totalDust}</span><strong>MEMÓRIA RAM</strong></div><div class="sweep-board" id="sweep-board"><div class="ram-rail ram-rail-left"></div><div class="ram-rail ram-rail-right"></div><div class="ram-chip-row">${Array.from({length:8},()=>'<i></i>').join('')}</div><div class="memory-dust">${dust}</div><div class="sweep-broom" id="sweep-broom">🧹</div><div class="sweep-board-label">CONTACTOS DE MEMÓRIA // MICRO RESÍDUOS</div></div><div class="repair-progress-track"><div id="repair-progress-fill"></div></div><p class="repair-footnote">Mova a vassoura por cima dos resíduos. Evite deixar pontos sujos nos cantos.</p></div>`;
        setupSweepPuzzle(component);
    } else {
        challengeDescription.textContent = 'MONTAGEM FÍSICA • Encaixe cada módulo no soquete correto por arrastar e soltar, ou clicando primeiro na peça e depois no encaixe.';
        challengeTarget.innerHTML = `<div class="repair-target-heading"><span class="repair-chip">RECALIBRAÇÃO DE HARDWARE</span><strong>RECOLOQUE OS COMPONENTES</strong></div><p>Selecione uma peça e encaixe no soquete compatível. Você pode arrastar a peça diretamente para o encaixe.</p>`;
        const parts = shuffleItems([
            {id:'cpu', name:'Processador', icon:'▦', desc:'CPU / contatos inferiores'},
            {id:'ram', name:'Módulo de RAM', icon:'▤', desc:'Memória / pinos dourados'},
            {id:'gpu', name:'Placa de vídeo', icon:'▰', desc:'GPU / slot de expansão'},
            {id:'fan', name:'Ventoinha', icon:'✥', desc:'Refrigeração / conector FAN'}
        ]);
        const slots = shuffleItems([
            {id:'cpu', name:'SOQUETE CPU', desc:'Pressione até travar'},
            {id:'ram', name:'BANCO DIMM', desc:'Trava dos módulos'},
            {id:'gpu', name:'SLOT PCI-E', desc:'Encaixe de expansão'},
            {id:'fan', name:'CONECTOR SYS_FAN', desc:'Energia da ventoinha'}
        ]);
        challengeOptions.innerHTML = `<div class="repair-shell install-shell"><div class="repair-progress-top"><span id="repair-progress-label">MÓDULOS INSTALADOS • 0/4</span><strong>PLACA-MÃE</strong></div><div class="install-board"><div class="install-parts"><h3>PEÇAS REMOVIDAS</h3>${parts.map(part=>`<button type="button" draggable="true" class="hardware-part" data-part="${part.id}"><span class="hardware-glyph glyph-${part.id}">${part.icon}</span><span><strong>${part.name}</strong><small>${part.desc}</small></span></button>`).join('')}</div><div class="install-slots"><h3>SOQUETES DISPONÍVEIS</h3>${slots.map(slot=>`<button type="button" class="hardware-slot" data-slot="${slot.id}"><span class="socket-glyph"></span><span><strong>${slot.name}</strong><small>${slot.desc}</small></span><b>VAZIO</b></button>`).join('')}</div></div><div class="repair-progress-track"><div id="repair-progress-fill"></div></div><p class="repair-footnote">Uma peça incompatível não encaixa. Todas as quatro posições precisam ser restauradas.</p></div>`;
        setupInstallPuzzle(component);
    }
}
function setupWirePuzzle(component) {
    const board = $('#wire-board');
    if (!board || !activeChallenge) return;
    function drawConnections() {
        const svg = $('#wire-lines'); if (!svg) return;
        const rect = board.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        svg.innerHTML = '';
        for (const wire of WIRE_SET) {
            if (!activeChallenge?.connected[wire.id]) continue;
            const source = board.querySelector(`.wire-pin[data-side="source"][data-wire="${wire.id}"]`);
            const target = board.querySelector(`.wire-pin[data-side="target"][data-wire="${wire.id}"]`);
            if (!source || !target) continue;
            const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const x1 = a.left + a.width - rect.left - 9, y1 = a.top + a.height / 2 - rect.top;
            const x2 = b.left + 9 - rect.left, y2 = b.top + b.height / 2 - rect.top;
            const mid = (x1 + x2) / 2;
            line.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
            line.setAttribute('fill', 'none'); line.setAttribute('stroke', wire.color); line.setAttribute('stroke-width', '4'); line.setAttribute('stroke-linecap', 'round'); line.classList.add('connected-wire-path');
            svg.appendChild(line);
        }
    }
    board.querySelectorAll('.wire-pin').forEach(pin => pin.addEventListener('click', () => {
        if (!activeChallenge || activeChallenge.completing) return;
        const wireId = pin.dataset.wire;
        if (activeChallenge.connected[wireId]) return;
        if (pin.dataset.side === 'source') {
            activeChallenge.selectedWire = wireId;
            board.querySelectorAll('.wire-pin[data-side="source"]').forEach(p => p.classList.toggle('wire-selected', p === pin));
            challengeFeedback.textContent = `Cabo ${WIRE_SET.find(w => w.id === wireId).label} selecionado. Agora conecte-o à porta correspondente.`;
            return;
        }
        if (!activeChallenge.selectedWire) {
            challengeFeedback.textContent = 'Escolha primeiro uma ponta de cabo na coluna da esquerda.';
            return;
        }
        if (activeChallenge.selectedWire !== wireId) {
            challengeFeedback.textContent = 'Essa conexão não corresponde. Escolha a porta certa para esse cabo.';
            tone(170, .1, 'square', .035);
            return;
        }
        activeChallenge.connected[wireId] = true;
        const source = board.querySelector(`.wire-pin[data-side="source"][data-wire="${wireId}"]`);
        source?.classList.add('wire-connected'); pin.classList.add('wire-connected');
        source?.classList.remove('wire-selected');
        activeChallenge.selectedWire = null;
        const count = Object.keys(activeChallenge.connected).length;
        const label = $('#repair-progress-label'); if (label) label.textContent = `CABOS CONECTADOS • ${count}/4`;
        const fill = $('#repair-progress-fill'); if (fill) fill.style.width = `${count/4*100}%`;
        challengeFeedback.textContent = `Circuito ${count}/4 estabilizado.`;
        drawConnections(); soundCollect();
        if (count === WIRE_SET.length) completeInfection(component);
    }));
    window.addEventListener('resize', drawConnections);
    activeChallenge.cleanup = () => window.removeEventListener('resize', drawConnections);
}
function setupSweepPuzzle(component) {
    const board = $('#sweep-board'), broom = $('#sweep-broom');
    if (!board || !broom || !activeChallenge) return;
    const dirt = [...board.querySelectorAll('.dust-particle')];
    const updateBrushPosition = event => {
        const rect = board.getBoundingClientRect();
        const x = THREE.MathUtils.clamp(event.clientX - rect.left, 18, rect.width - 18);
        const y = THREE.MathUtils.clamp(event.clientY - rect.top, 18, rect.height - 18);
        broom.style.left = `${x}px`; broom.style.top = `${y}px`;
    };
    const sweepAt = event => {
        if (!activeChallenge || activeChallenge.type !== 'sweep' || activeChallenge.completing) return;
        const brushX = event.clientX, brushY = event.clientY;
        for (const particle of dirt) {
            if (particle.classList.contains('cleaned')) continue;
            const rect = particle.getBoundingClientRect();
            const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
            if (Math.hypot(brushX-cx, brushY-cy) < 27) {
                particle.classList.add('cleaned'); activeChallenge.swept++;
            }
        }
        const count = activeChallenge.swept, total = activeChallenge.totalDust;
        const label = $('#repair-progress-label'); if (label) label.textContent = `RESÍDUOS REMOVIDOS • ${count}/${total}`;
        const fill = $('#repair-progress-fill'); if (fill) fill.style.width = `${count/total*100}%`;
        if (count >= total) { challengeFeedback.textContent = 'SUPERFÍCIE LIMPA • VALIDANDO OS CONTATOS...'; completeInfection(component); }
    };
    board.addEventListener('pointerdown', event => {
        if (!activeChallenge || activeChallenge.type !== 'sweep') return;
        activeChallenge.sweeping = true;
        board.setPointerCapture?.(event.pointerId);
        updateBrushPosition(event); sweepAt(event); event.preventDefault();
    });
    board.addEventListener('pointermove', event => {
        updateBrushPosition(event);
        if (activeChallenge?.sweeping) sweepAt(event);
    });
    const stop = () => { if (activeChallenge) activeChallenge.sweeping = false; };
    board.addEventListener('pointerup', stop); board.addEventListener('pointercancel', stop); board.addEventListener('lostpointercapture', stop);
}
function setupInstallPuzzle(component) {
    const board = challengeOptions.querySelector('.install-board');
    if (!board || !activeChallenge) return;
    const tryInstall = (partId, slot) => {
        if (!activeChallenge || activeChallenge.type !== 'install' || activeChallenge.completing || activeChallenge.installed[slot.dataset.slot]) return;
        if (partId !== slot.dataset.slot) {
            challengeFeedback.textContent = 'Essa peça não combina com o encaixe. Tente outro soquete.';
            slot.classList.add('socket-reject'); setTimeout(() => slot.classList.remove('socket-reject'), 400); tone(165,.1,'square',.035); return;
        }
        activeChallenge.installed[slot.dataset.slot] = true;
        activeChallenge.selectedPart = null;
        board.querySelectorAll('.hardware-part').forEach(p => p.classList.remove('part-selected'));
        const part = board.querySelector(`.hardware-part[data-part="${partId}"]`);
        if (part) { part.classList.add('part-installed'); part.draggable = false; part.disabled = true; }
        slot.classList.add('socket-installed');
        slot.querySelector('b').textContent = 'INSTALADO';
        slot.querySelector('.socket-glyph').textContent = '✓';
        const count = Object.keys(activeChallenge.installed).length;
        const label = $('#repair-progress-label'); if (label) label.textContent = `MÓDULOS INSTALADOS • ${count}/4`;
        const fill = $('#repair-progress-fill'); if (fill) fill.style.width = `${count/4*100}%`;
        challengeFeedback.textContent = `Componente encaixado corretamente (${count}/4).`;
        soundCollect(); if (count === 4) completeInfection(component);
    };
    board.querySelectorAll('.hardware-part').forEach(part => {
        part.addEventListener('click', () => {
            if (!activeChallenge || activeChallenge.completing || part.disabled) return;
            activeChallenge.selectedPart = part.dataset.part;
            board.querySelectorAll('.hardware-part').forEach(p => p.classList.toggle('part-selected', p === part));
            challengeFeedback.textContent = `Peça selecionada: ${part.querySelector('strong').textContent}. Agora escolha o encaixe correspondente.`;
        });
        part.addEventListener('dragstart', event => {
            if (!activeChallenge || part.disabled) { event.preventDefault(); return; }
            activeChallenge.selectedPart = part.dataset.part;
            event.dataTransfer?.setData('text/plain', part.dataset.part);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        });
    });
    board.querySelectorAll('.hardware-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            if (activeChallenge?.selectedPart) tryInstall(activeChallenge.selectedPart, slot);
            else challengeFeedback.textContent = 'Selecione ou arraste uma peça até este encaixe.';
        });
        slot.addEventListener('dragover', event => { event.preventDefault(); slot.classList.add('socket-hover'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('socket-hover'));
        slot.addEventListener('drop', event => {
            event.preventDefault(); slot.classList.remove('socket-hover');
            const partId = event.dataTransfer?.getData('text/plain') || activeChallenge?.selectedPart;
            if (partId) tryInstall(partId, slot);
        });
    });
}
function closeComponentChallenge() {
    if (activeChallenge?.cleanup) activeChallenge.cleanup();
    if (challengeRevealTimer) { clearTimeout(challengeRevealTimer); challengeRevealTimer = null; }
    challengeScreen.classList.add('hidden'); activeChallenge = null; challengeSelection = -1;
    challengeOptions.innerHTML = ''; challengeFeedback.textContent = ''; challengeTarget.innerHTML = ''; challengeTimer.textContent = '';
    challengeTimer.classList.remove('timer-warning'); lastChallengeTimeShown = -1;
    challengeCancel.disabled = false;
    clearPhysicalChallengeLayout();
    if (gameState === 'playing') { startMusic(); if (viewMode === 'first') requestMouseLook(); }
    updateHUD();
}
function completeInfection(component) {
    if (!component || component.cleaned || (activeChallenge && activeChallenge.completing)) return;
    if (activeChallenge) activeChallenge.completing = true;
    invulnerableTime = Math.max(invulnerableTime, 1.0);
    challengeCancel.disabled = true;
    challengeTimer.textContent = 'REPARO VALIDADO • APLICANDO LIMPEZA';
    component.cleaned = true; component.infected = false;
    challengeOptions.querySelectorAll('button').forEach(button => { button.disabled = true; });
    challengeSubmit.disabled = true;
    component.virus.visible = false;
    component.aura.material.color.setHex(0x3cffab);
    component.aura.material.opacity = .4;
    component.label.material.opacity = .72;
    score += 1250; collected++; addCredits(180); soundCollect();
    const total = infectedComponents.filter(part => part.target).length;
    const cleaned = infectedComponents.filter(part => part.target && part.cleaned).length;
    challengeFeedback.textContent = `COMPONENTE LIMPO! +1.250 PONTOS • +180 CRÉDITOS (${cleaned}/${total})`;
    updateHUD();
    challengeRevealTimer = setTimeout(() => {
        challengeRevealTimer = null;
        if (gameState !== 'playing') return;
        if (activeChallenge?.cleanup) activeChallenge.cleanup();
        challengeScreen.classList.add('hidden'); activeChallenge = null; activeComponent = null; challengeTimer.textContent = ''; lastChallengeTimeShown = -1;
        challengeOptions.innerHTML = ''; challengeTarget.innerHTML = ''; clearPhysicalChallengeLayout();
        if (cleaned >= total) { score += 2500; endMission(true); }
        else { startMusic(); updateHUD(); showEvent(`COMPONENTE DESINFECTADO • ${cleaned}/${total}`, '#41f2aa'); if (viewMode === 'first') requestMouseLook(); }
    }, 850);
}
challengeCancel.addEventListener('click', closeComponentChallenge);
interactButton.addEventListener('click', openComponentChallenge);

function renderShop() {
    persistShop();
    shopSkins.innerHTML = '';
    shopAbilities.innerHTML = '';
    for (const skin of SKINS) {
        const owned = ownedSkins.includes(skin.id);
        const equipped = equippedSkin === skin.id;
        const card = document.createElement('article'); card.className = 'shop-item';
        const swatch = document.createElement('div'); swatch.className = 'shop-swatch';
        swatch.style.background = skin.id === 'default' ? 'linear-gradient(90deg,#167db5,#00eaff)' : `linear-gradient(110deg,#${skin.body.toString(16).padStart(6,'0')},#${skin.eye.toString(16).padStart(6,'0')},#${skin.ring.toString(16).padStart(6,'0')})`;
        const title = document.createElement('h3'); title.textContent = skin.name;
        const desc = document.createElement('p'); desc.textContent = skin.desc;
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = equipped ? 'EQUIPADA' : owned ? 'EQUIPAR' : `DESBLOQUEAR • ${skin.price} CR`;
        button.disabled = equipped || (!owned && walletCredits < skin.price);
        button.addEventListener('click', () => {
            if (!ownedSkins.includes(skin.id)) {
                if (walletCredits < skin.price) { shopFeedback.textContent = 'Créditos insuficientes.'; return; }
                walletCredits -= skin.price; ownedSkins.push(skin.id);
            }
            equippedSkin = skin.id; persistShop(); applyPlayerThemeStyle(); shopFeedback.textContent = `${skin.name} selecionada.`; renderShop(); soundButton();
        });
        card.append(swatch, title, desc, button); shopSkins.appendChild(card);
    }
    for (const ability of ABILITIES) {
        const owned = ownedAbilities.includes(ability.id);
        const card = document.createElement('article'); card.className = 'shop-item';
        const swatch = document.createElement('div'); swatch.className = 'shop-swatch';
        swatch.style.background = ability.id === 'thrusters' ? 'linear-gradient(90deg,#163b73,#4feaff)' : ability.id === 'capacitor' ? 'linear-gradient(90deg,#4d2a7e,#db8aff)' : 'linear-gradient(90deg,#17583e,#90ffbd)';
        const title = document.createElement('h3'); title.textContent = ability.name;
        const desc = document.createElement('p'); desc.textContent = ability.desc;
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = owned ? 'DESBLOQUEADA' : `COMPRAR • ${ability.price} CR`;
        button.disabled = owned || walletCredits < ability.price;
        button.addEventListener('click', () => {
            if (ownedAbilities.includes(ability.id) || walletCredits < ability.price) return;
            walletCredits -= ability.price; ownedAbilities.push(ability.id); persistShop();
            shopFeedback.textContent = `${ability.name} desbloqueada permanentemente!`;
            renderShop(); updateHUD(); soundVictory();
        });
        card.append(swatch, title, desc, button); shopAbilities.appendChild(card);
    }
}
function openShop() {
    if (gameState !== 'menu') return;
    startScreen.classList.add('hidden'); shopScreen.classList.remove('hidden'); shopFeedback.textContent = ''; renderShop();
}
function closeShop() {
    shopScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); persistShop();
    startLobbyMusic();
}
$('#shop-open-button').addEventListener('click', openShop);
$('#shop-close-button').addEventListener('click', closeShop);

function updateMapCards() {
    document.querySelectorAll('.map-card').forEach(button => {
        const id=button.dataset.map;
        button.disabled = gameType === 'desinfeccao';
        button.setAttribute('aria-disabled', gameType === 'desinfeccao' ? 'true' : 'false');
        button.classList.toggle('mode-secondary', gameType === 'desinfeccao');
        button.classList.remove('locked');
        button.classList.toggle('selected',id===selectedMap);
        const label=button.querySelector('.map-lock');
        if (label) label.textContent='DISPONÍVEL';
    });
}
function refreshMapCards() { updateMapCards(); }
function setSelectedMap(id) {
    if (!THEMES[id] || gameType === 'desinfeccao') return;
    selectedMap=id; theme=THEMES[id]; mapSummary.textContent=gameType==='desinfeccao'?'O mapa de desinfecção é o interior de um computador e usa os componentes infectados como objetivos. '+THEMES[id].name+' continua disponível nos modos de exploração.':theme.summary; soundButton(); createMap(id);
}
document.querySelectorAll('.map-card').forEach(button => button.addEventListener('click',()=>setSelectedMap(button.dataset.map)));
document.querySelectorAll('.difficulty-card').forEach(button=>button.addEventListener('click',()=>{
    prepareAudio(); soundButton(); selectedMode=button.dataset.mode;
    document.querySelectorAll('.difficulty-card').forEach(other=>other.classList.toggle('selected',other===button));
    modeSummary.textContent=gameType==='desinfeccao'?`Remova os componentes infectados e sobreviva a ${({facil:5,medio:7,dificil:9})[selectedMode]} vírus patrulheiros.`:currentRules().summary;
    if (boss) { boss.userData.maxHealth=currentRules().bossHp; boss.userData.health=currentRules().bossHp; }
    if (gameState === 'menu') createMap(selectedMap);
}));

function updateHUD() {
    const mode = currentRules();
    const infectionMode = gameType === 'desinfeccao';
    hudMode.textContent = infectionMode
        ? `DESINFECÇÃO / ${MODES[selectedMode].name}`
        : `${theme.shortName} / ${MODES[selectedMode].name}${gameType==='rapido'?' / RÁPIDO':''}`;
    const fragmentsLabel = hudFragments.parentElement.querySelector('.hud-label');
    if (fragmentsLabel) fragmentsLabel.textContent = infectionMode ? 'COMPONENTES LIMPOS' : 'CRISTAIS';
    if (infectionMode) {
        const targets = infectedComponents.filter(component => component.target);
        const cleaned = targets.filter(component => component.cleaned).length;
        hudFragments.textContent = `${cleaned} / ${targets.length}`;
    } else {
        hudFragments.textContent = `${Math.min(collected, mode.goal)} / ${mode.goal}`;
    }
    powerTitle.textContent = theme.powerName;
    powerHelp.textContent = theme.powerDescription;
    powerButton.textContent = `${theme.powerName} (${effectivePowerCost()})`;
    powerCount.textContent = `${powerCharge} / ${effectivePowerCost()}`;
    powerFill.style.width = `${powerCharge / effectivePowerCost() * 100}%`;
    hudScore.textContent = score.toLocaleString('pt-BR');
    hudLives.textContent = lives > 0 ? Array(lives).fill('♥').join(' ') : '0';
    powerButton.disabled = powerCharge < effectivePowerCost() || gameState !== 'playing';
    const infiniteAmmo = gameType === 'desinfeccao';
    if (ammoCount) {
        ammoCount.textContent = infiniteAmmo ? '∞' : `${pulseAmmo} / ${MAX_PULSE_AMMO}`;
        ammoCount.title = infiniteAmmo ? 'Munição infinita neste modo' : `${pulseAmmo} de ${MAX_PULSE_AMMO} disparos restantes`;
        ammoCount.setAttribute('aria-label', ammoCount.title);
    }
    if (attackButton) {
        attackButton.disabled = (!infiniteAmmo && pulseAmmo <= 0) || gameState !== 'playing' || Boolean(activeChallenge);
    }
    updateMissionClockText();
    if (boss && bossActive && !infectionMode) {
        bossPanel.classList.remove('hidden'); bossName.textContent = theme.bossName;
        bossHealthText.textContent = `${boss.userData.health} / ${boss.userData.maxHealth}`;
        bossHealthFill.style.width = `${Math.max(0, boss.userData.health / boss.userData.maxHealth * 100)}%`;
    } else bossPanel.classList.add('hidden');
    persistShop();
}
function resetEnemies() {
    enemies.forEach((enemy,index)=>{
        const [x,z]=enemySpawnPoints[index%Math.max(1,enemySpawnPoints.length)] || [0,0];
        enemy.position.set(x,floorHeightAt(x,z),z); enemy.visible=index<currentRules().enemyCount;
        const d=enemy.userData; d.stunnedUntil=0; d.stunAura.visible=false; d.targetX=x; d.targetZ=z; d.nextWanderAt=0; d.health=d.maxHealth||3;
    });
}
function startMission() {
    prepareAudio(); stopMusic(); soundButton();
    if (gameType === 'desinfeccao') viewMode = 'first';
    createMap(selectedMap); setViewMode(viewMode);
    lives=currentRules().lives + (ownedAbilities.includes('shield') ? 1 : 0); shieldCharges=ownedAbilities.includes('shield')?1:0; score=0; collected=0; powerCharge=0; pulseAmmo=MAX_PULSE_AMMO; invulnerableTime=0; hazardCooldown=0; dashUntil=0; camouflageUntil=0;
    missionTimeLeft = gameType === 'desinfeccao' ? missionDurationForDifficulty() : 0; lastMissionTimeShown = -1; lastChallengeTimeShown = -1; updateMissionClockText();
    jumpHeight=0; jumpVelocity=0; playerPlatform=null; playerHidden=false; bossActive=false; lastMissionVictory=false;
    player.position.set(gameType==='desinfeccao'?-21:0,0,gameType==='desinfeccao'?46:0); playerGroundY=0; playerModel.position.y=0; cameraYaw=0; cameraPitch=0;
    crystals.forEach(c=>{c.active=true;c.root.visible=true;});
    resetEnemies();
    if (boss) { boss.visible=false; boss.userData.maxHealth=currentRules().bossHp; boss.userData.health=currentRules().bossHp; boss.userData.stunnedUntil=0; }
    gameState='playing'; startScreen.classList.add('hidden'); pauseScreen.classList.add('hidden'); endScreen.classList.add('hidden'); hud.classList.remove('hidden');
    challengeScreen.classList.add('hidden'); shopScreen.classList.add('hidden'); interactionPrompt.classList.add('hidden');
    activeChallenge = null; activeComponent = null;
    stealthStatus.classList.add('hidden'); eventMessage.classList.add('hidden'); empPulse.visible=false;
    updateHiding(); updateHUD(); startMusic();
    if (viewMode === 'first') requestMouseLook();
}
function returnToMenu() {
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    gameState='menu'; stopMusic(); soundButton(); activeChallenge=null; missionTimeLeft=0; lastMissionTimeShown=-1; challengeTimer.textContent=''; missionTimeBox.classList.add('hidden');
    startScreen.classList.remove('hidden'); pauseScreen.classList.add('hidden'); endScreen.classList.add('hidden'); hud.classList.add('hidden');
    challengeScreen.classList.add('hidden'); shopScreen.classList.add('hidden'); interactionPrompt.classList.add('hidden');
    stealthStatus.classList.add('hidden'); eventMessage.classList.add('hidden'); houses.forEach(h=>h.roof.visible=true);
    updateMapCards(); mapSummary.textContent=gameType==='desinfeccao'?'Explore o interior de um computador e resolva protocolos para remover os vírus.':THEMES[selectedMap].summary; updateHUD();
    startLobbyMusic();
}
function endMission(victory) {
    if (gameState!=='playing') return;
    if (activeChallenge?.cleanup) activeChallenge.cleanup();
    if (challengeRevealTimer) { clearTimeout(challengeRevealTimer); challengeRevealTimer = null; }
    gameState='ended'; stopMusic(); lastMissionVictory=victory;
    activeChallenge = null; challengeCancel.disabled = false; clearPhysicalChallengeLayout(); challengeScreen.classList.add('hidden'); challengeTimer.textContent=''; interactionPrompt.classList.add('hidden'); missionTimeBox.classList.add('hidden');
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    if (victory) {
        soundVictory();
        if (gameType === 'desinfeccao') {
            addCredits(800);
            $('#end-title').textContent='COMPUTADOR DESINFECTADO!';
            $('#end-message').textContent='Todos os componentes infectados foram recuperados. Você ganhou 800 créditos de conclusão, além das recompensas por componente. Visite a loja para desbloquear skins e melhorias permanentes.';
        } else {
            const finishedIndex=mapIndex(selectedMap)+1;
            if(finishedIndex<3 && unlockedMap<finishedIndex+1){unlockedMap=finishedIndex+1;saveUnlockedMap();}
            $('#end-title').textContent='ZONA PURIFICADA!';
            $('#end-message').textContent=`Você derrotou ${theme.bossName}. Missão concluída! Você recebeu créditos para a loja.`;
            addCredits(100 + Math.floor(score / 50));
        }
    } else {
        soundDefeat();
        $('#end-title').textContent=gameType==='desinfeccao'?'DESINFECÇÃO INTERROMPIDA':'MISSÃO FALHOU!';
        $('#end-message').textContent='Os robôs-vírus venceram desta vez. Melhore suas habilidades na loja e tente novamente.';
    }
    $('#end-score').textContent=score.toLocaleString('pt-BR'); endScreen.classList.remove('hidden'); updateMapCards(); updateHUD();
}
function togglePause() {
    if(gameState==='challenge') return;
    if(gameState==='playing'){
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
        gameState='paused';stopMusic();soundButton();pauseScreen.classList.remove('hidden');updateHUD();
    } else if(gameState==='paused'){
        gameState='playing';soundButton();pauseScreen.classList.add('hidden');startMusic();updateHUD();
        if (viewMode === 'first') requestMouseLook();
    }
}
$('#start-button').addEventListener('click',startMission);
setViewMode('third');
$('#pause-button').addEventListener('click',togglePause);
$('#resume-button').addEventListener('click',togglePause);
$('#menu-button').addEventListener('click',returnToMenu);
$('#restart-button').addEventListener('click',returnToMenu);

function activatePower() {
    if(gameState!=='playing') return;
    prepareAudio();
    if(powerCharge<effectivePowerCost()){tone(170,.08,'square',.05);showEvent(`PODER INSUFICIENTE • ${powerCharge}/${effectivePowerCost()} CRISTAIS`,theme.accent);return;}
    powerCharge=0;
    const now=elapsed;
    let affected=0;
    const radius=theme.id==='cidade'?13:theme.id==='nucleo'?7:10;

    if(theme.id==='cidade') {
        for(const enemy of enemies){
            if(!enemy.visible) continue;
            const distance=Math.hypot(player.position.x-enemy.position.x,player.position.z-enemy.position.z);
            if(distance<=radius&&Math.abs(playerGroundY-floorHeightAt(enemy.position.x,enemy.position.z))<4){enemy.userData.stunnedUntil=now+4.5;enemy.userData.stunAura.visible=true;affected++;}
        }
        if(boss&&bossActive){
            const distance=Math.hypot(player.position.x-boss.position.x,player.position.z-boss.position.z);
            if(distance<=15){boss.userData.health=Math.max(0,boss.userData.health-1);boss.userData.stunnedUntil=now+2.8;if(boss.userData.health<=0){score+=2000;endMission(true);}else showEvent('PULSO EMP ACERTOU O GUARDIÃO!',theme.accent);}
        }
        showEvent(`PULSO EMP • ${affected} VÍRUS ATORDOADOS`,theme.accent);
        empPulse.material.color.setHex(theme.accent);
    } else if(theme.id==='nucleo') {
        // Sobrecarga: arrancada temporária, proteção curta e impacto elétrico ao redor.
        dashUntil=now+3.2; invulnerableTime=Math.max(invulnerableTime,1.4);
        for(const enemy of enemies){
            if(!enemy.visible) continue;
            const distance=Math.hypot(player.position.x-enemy.position.x,player.position.z-enemy.position.z);
            if(distance<=radius){enemy.userData.stunnedUntil=now+2.4;enemy.userData.stunAura.visible=true;affected++;}
        }
        if(boss&&bossActive){
            const distance=Math.hypot(player.position.x-boss.position.x,player.position.z-boss.position.z);
            if(distance<=9){boss.userData.health=Math.max(0,boss.userData.health-2);boss.userData.stunnedUntil=now+1.8;if(boss.userData.health<=0){score+=2000;endMission(true);}}
        }
        empPulse.material.color.setHex(theme.accent2);
        showEvent(`SOBRECARGA • VELOCIDADE AUMENTADA • ${affected} ALVOS`,theme.accent2);
    } else if (theme.id === 'computador') {
        // Pulso de isolamento: atordoa vírus próximos e cria espaço ao redor do operador.
        for (const enemy of enemies) {
            if (!enemy.visible) continue;
            const dx = enemy.position.x - player.position.x;
            const dz = enemy.position.z - player.position.z;
            const distance = Math.hypot(dx, dz);
            if (distance <= radius) {
                enemy.userData.stunnedUntil = now + 4.2;
                enemy.userData.stunAura.visible = true;
                const push = Math.max(0, 3.2 - distance * .12);
                moveActor(enemy, (dx / Math.max(distance, .001)) * push, (dz / Math.max(distance, .001)) * push, .44);
                affected++;
            }
        }
        invulnerableTime = Math.max(invulnerableTime, 1.1);
        empPulse.material.color.setHex(theme.accent2);
        showEvent(`PULSO DE ISOLAMENTO • ${affected} VÍRUS CONTIDOS`, theme.accent2);
    } else {
        // Camuflagem viva: impede deteção e recupera uma vida até ao limite do modo.
        camouflageUntil=now+6.5;
        invulnerableTime=Math.max(invulnerableTime,1.1);
        lives=Math.min(currentRules().lives,lives+1);
        playerModel.visible=false;
        empPulse.material.color.setHex(theme.accent);
        for(const enemy of enemies){
            if(!enemy.visible) continue;
            const distance=Math.hypot(player.position.x-enemy.position.x,player.position.z-enemy.position.z);
            if(distance<=radius){enemy.userData.stunnedUntil=now+1.8;affected++;}
        }
        showEvent(`CAMUFLAGEM VIVA • OCULTO POR 6,5 SEGUNDOS`,theme.accent);
    }
    empPulse.position.set(player.position.x,playerGroundY+.12,player.position.z);
    empPulse.visible=true;empPulse.scale.set(1,1,1);empPulse.userData.life=0;
    soundPower();updateHUD();
}
function fireWeapon() {
    if (gameState !== 'playing' || activeChallenge || elapsed - lastShotAt < .34) return;
    const infiniteAmmo = gameType === 'desinfeccao';
    if (!infiniteAmmo && pulseAmmo <= 0) {
        showEvent('MUNIÇÃO ESGOTADA • RESTAM 0/10 DISPAROS', '#ff617f');
        tone(145, .12, 'square', .05);
        return;
    }
    prepareAudio();
    lastShotAt = elapsed;
    // No modo Desinfecção, o emissor tem munição infinita. Nos demais modos,
    // a reserva de 10 disparos continua limitada por missão.
    if (!infiniteAmmo) pulseAmmo--;
    const direction = new THREE.Vector3();
    let origin;
    if (viewMode === 'first') {
        camera.getWorldDirection(direction).normalize();
        origin = camera.getWorldPosition(new THREE.Vector3()).addScaledVector(direction, .85);
        firstPersonRecoil = .11;
    } else {
        const yaw = player.rotation.y;
        direction.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
        origin = new THREE.Vector3(player.position.x + direction.x * .9, player.position.y + 1.25 + playerModel.position.y, player.position.z + direction.z * .9);
    }
    const material = new THREE.MeshStandardMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 2.8, metalness: .2, roughness: .18 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10), material);
    mesh.position.copy(origin);
    actorsRoot.add(mesh);
    projectiles.push({ mesh, direction, age: 0, damage: ownedAbilities.includes('amplifier') ? 2 : 1 });
    tone(510, .075, 'square', .09); updateHUD();
}
function removeProjectileAt(index) {
    const shot = projectiles[index];
    actorsRoot.remove(shot.mesh); shot.mesh.geometry.dispose(); shot.mesh.material.dispose();
    projectiles.splice(index, 1);
}
function updateProjectiles(dt) {
    if (gameState !== 'playing') return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const shot = projectiles[i]; shot.age += dt;
        shot.mesh.position.addScaledVector(shot.direction, 27 * dt);
        shot.mesh.rotation.x += dt * 6; shot.mesh.rotation.y += dt * 5;
        let hit = false;
        for (const enemy of enemies) {
            if (!enemy.visible || (enemy.userData.model && !enemy.userData.model.visible)) continue;
            const dist = Math.hypot(shot.mesh.position.x - enemy.position.x, shot.mesh.position.z - enemy.position.z);
            if (dist < .85 && Math.abs(shot.mesh.position.y - (enemy.position.y + 1.0)) < 1.75) {
                enemy.userData.health = (enemy.userData.health || 3) - shot.damage;
                hit = true;
                if (enemy.userData.health <= 0) {
                    enemy.visible = false; score += 180; addCredits(25); showEvent('VÍRUS ELIMINADO • +180 PONTOS', theme.accent); soundVictory();
                } else {
                    enemy.userData.stunnedUntil = elapsed + .4; showEvent(`ACERTO • ${enemy.userData.health} PONTOS DE INTEGRIDADE RESTANTES`, theme.accent);
                    tone(290, .08, 'triangle', .07);
                }
                updateHUD(); break;
            }
        }
        if (!hit && boss && bossActive && boss.visible) {
            const dist = Math.hypot(shot.mesh.position.x - boss.position.x, shot.mesh.position.z - boss.position.z);
            if (dist < 1.75 && Math.abs(shot.mesh.position.y - (boss.position.y + 1.8)) < 3) {
                boss.userData.health = Math.max(0, boss.userData.health - shot.damage);
                hit = true; showEvent('DISPARO ACERTOU O GUARDIÃO', theme.accent); updateHUD(); tone(350, .1, 'sawtooth', .08);
                if (boss.userData.health <= 0) { score += 2000; endMission(true); }
            }
        }
        if (hit || shot.age > 2.6 || Math.abs(shot.mesh.position.x) > 58 || Math.abs(shot.mesh.position.z) > 58) removeProjectileAt(i);
    }
}
powerButton.addEventListener('click',activatePower);
$('#attack-button').addEventListener('click', fireWeapon); // Compatibilidade com toque/controle na tela.
// Disparo principal pelo botão esquerdo do mouse em primeira e terceira pessoa.
renderer.domElement.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gameState !== 'playing' || activeChallenge) return;
    event.preventDefault();
    fireWeapon();
});
window.addEventListener('keydown',event=>{
    const key=event.key.toLowerCase();
    if(event.code==='Space'||key.startsWith('arrow'))event.preventDefault();
    if (activeChallenge) { if (key === 'escape' && !activeChallenge.completing) closeComponentChallenge(); return; }
    keys[key]=true;
    if(event.code==='Space'&&gameState==='playing'&&jumpHeight<=.001&&jumpVelocity<=0){jumpVelocity=8.0;playerPlatform=null;}
    if(key==='q'&&!event.repeat)activatePower();
    if(key==='e'&&!event.repeat)openComponentChallenge();
    if(key==='v'&&!event.repeat&&gameState==='playing')toggleViewMode();
    if(key==='escape'&&(gameState==='playing'||gameState==='paused'))togglePause();
});
const keys={};
window.addEventListener('keyup',event=>{keys[event.key.toLowerCase()]=false;});
window.addEventListener('blur',()=>{for(const key of Object.keys(keys))keys[key]=false;});

function houseAt(x,z){return houses.find(h=>Math.abs(x-h.cx)<h.w/2-.5&&Math.abs(z-h.cz)<h.d/2-.5)||null;}
function updateHiding(){
    const inside=playerGroundY<.55?houseAt(player.position.x,player.position.z):null;
    const camouflaged=elapsed<camouflageUntil;
    playerHidden=Boolean(inside)||camouflaged;
    houses.forEach(h=>{h.roof.visible=h!==inside;});
    stealthStatus.classList.toggle('hidden',!playerHidden||gameState!=='playing');
    if(camouflaged)stealthStatus.textContent='CAMUFLAGEM VIVA ATIVA';
    else if(inside)stealthStatus.textContent=`ESCONDIDO: ${inside.name.toUpperCase()}`;
    playerModel.visible=viewMode!=='first'&&!camouflaged;
}
function collectCrystals(){
    for(const crystal of crystals){
        if(!crystal.active)continue;
        const d=Math.hypot(player.position.x-crystal.x,player.position.z-crystal.z);
        if(d<1.15&&Math.abs(playerGroundY-crystal.floorY)<1.15&&jumpHeight<2.2){
            crystal.active=false;crystal.root.visible=false;collected++;score+=250;powerCharge=Math.min(effectivePowerCost(),powerCharge+1);soundCollect();updateHUD();
            if(gameType!=='desinfeccao'&&collected>=currentRules().goal&&!bossActive){
                bossActive=true;boss.visible=true;boss.userData.health=currentRules().bossHp;boss.userData.maxHealth=currentRules().bossHp;
                boss.position.set(47, floorHeightAt(47,-46), -46);boss.userData.stunnedUntil=0;showEvent(`GUARDIÃO DETECTADO: ${theme.bossName}!`,theme.accent2);updateHUD();
            }
        }
    }
}
function damagePlayer(reason='INIMIGO'){
    if(invulnerableTime>0||playerHidden||gameState!=='playing')return;
    // Uma limpeza já validada tem 850 ms de confirmação visual; não permita que um golpe
    // cancele a transição e deixe a missão sem acionar a vitória do último componente.
    if(activeChallenge?.completing){invulnerableTime=Math.max(invulnerableTime,1.0);return;}
    if(activeChallenge){if(challengeRevealTimer){clearTimeout(challengeRevealTimer);challengeRevealTimer=null;}if(activeChallenge.cleanup)activeChallenge.cleanup();activeChallenge=null;challengeScreen.classList.add('hidden');challengeOptions.innerHTML='';challengeTarget.innerHTML='';clearPhysicalChallengeLayout();challengeTimer.textContent='';lastChallengeTimeShown=-1;showEvent('PROTOCOLO INTERROMPIDO • VOCÊ FOI ATINGIDO!','#ff4968');}
    if (shieldCharges > 0) {
        shieldCharges--; invulnerableTime = 2.4; soundPower(); showEvent('ESCUDO DE EMERGÊNCIA ABSORVEU O DANO!', '#55ffbe'); updateHUD(); return;
    }
    lives--;invulnerableTime=1.5;hazardCooldown=1.4;jumpHeight=0;jumpVelocity=0;
    player.position.set(gameType==='desinfeccao'?-21:0,0,gameType==='desinfeccao'?46:0);playerGroundY=0;soundDamage();showEvent(`DANO: ${reason}`,'#ff4267');updateHUD();if(lives<=0)endMission(false);
}
function updateHazards(dt){
    if(hazardCooldown>0)hazardCooldown=Math.max(0,hazardCooldown-dt);
    hazards.forEach(h=>{
        const pulse=1+Math.sin(elapsed*2.4+h.phase)*.08;h.ring.scale.setScalar(pulse);h.marker.rotation.y+=dt*1.5;h.marker.position.y=.34+Math.sin(elapsed*2+h.phase)*.12;
        h.active = theme.id !== 'nucleo' || Math.sin(elapsed * 1.25 + h.phase) > -.05;
        h.disk.material.opacity = h.active ? .17+((Math.sin(elapsed*2.2+h.phase)+1)*.06) : .035;
        h.ring.material.color.setHex(h.active ? theme.id === 'nucleo' ? 0xffdf42 : theme.hazard : 0x493a3a);
        const d=Math.hypot(player.position.x-h.x,player.position.z-h.z);
        if(gameState==='playing'&&h.active&&!playerHidden&&jumpHeight<.3&&d<h.radius&&hazardCooldown<=0&&invulnerableTime<=0){damagePlayer(theme.hazardName);}
    });
}
function updateEnemies(dt){
    const mode=currentRules();
    for(const enemy of enemies){
        if(!enemy.visible)continue;
        const data=enemy.userData;
        enemy.position.y=floorHeightAt(enemy.position.x,enemy.position.z);
        const dist=Math.hypot(player.position.x-enemy.position.x,player.position.z-enemy.position.z);
        const chasing=!playerHidden&&dist<=mode.aggro;
        let targetX=data.targetX,targetZ=data.targetZ;

        // Dentro do computador, os patrulheiros guardam os componentes ainda infectados.
        if(theme.id==='computador'&&!chasing){
            const remaining=infectedComponents.filter(part=>part.target&&!part.cleaned);
            if(remaining.length){
                const guard=remaining[data.guardIndex%remaining.length];
                targetX=guard.x;targetZ=guard.z;
            }
        }

        // Os vírus da floresta ficam camuflados entre as raízes até se aproximarem.
        data.model.visible=theme.id!=='floresta'||chasing||dist<7.5||elapsed<data.stunnedUntil;

        if(elapsed<data.stunnedUntil){
            data.stunAura.visible=true;data.moving=false;
        } else {
            data.stunAura.visible=false;
            if(chasing){targetX=player.position.x;targetZ=player.position.z;}
            else if(theme.id!=='computador'&&(elapsed>=data.nextWanderAt||Math.hypot(targetX-enemy.position.x,targetZ-enemy.position.z)<1.2)){
                data.targetX=THREE.MathUtils.randFloat(-49,49);data.targetZ=THREE.MathUtils.randFloat(-49,49);
                targetX=data.targetX;targetZ=data.targetZ;data.nextWanderAt=elapsed+THREE.MathUtils.randFloat(2.2,5.2);
            }
            let dx=targetX-enemy.position.x,dz=targetZ-enemy.position.z;
            const length=Math.hypot(dx,dz);data.moving=length>.14;
            if(data.moving){
                dx/=length;dz/=length;
                let speed=mode.speed*(chasing?1:.62)*(gameType==='rapido'?1.18:1);

                // No Núcleo Firewall, os robôs blindados carregam em investidas curtas.
                if(theme.id==='nucleo'&&chasing&&dist<11&&elapsed>=data.nextBurstAt){
                    data.burstUntil=elapsed+.72;data.nextBurstAt=elapsed+3.2+Math.random()*1.4;
                }
                const bursting=theme.id==='nucleo'&&elapsed<data.burstUntil;
                if(bursting)speed*=1.72;
                data.model.scale.setScalar(bursting?1.06:1);
                if(bursting){data.stunAura.visible=true;data.stunAura.material.color.setHex(theme.accent2);data.stunAura.material.opacity=.95;}

                // Tenta contornar obstáculos quando uma perseguição fica bloqueada.
                const oldX=enemy.position.x,oldZ=enemy.position.z;
                moveActor(enemy,dx*speed*dt,dz*speed*dt,.44);
                const moved=Math.hypot(enemy.position.x-oldX,enemy.position.z-oldZ);
                if(moved<.025&&chasing){
                    const side=Math.sin(data.phase+Math.floor(elapsed*2))>=0?1:-1;
                    moveActor(enemy,-dz*side*speed*dt,dx*side*speed*dt,.44);
                } else if(moved<.025&&!chasing){data.nextWanderAt=0;}
                enemy.rotation.y=Math.atan2(-dx,-dz);
            }
        }
        const gait=data.moving&&elapsed>=data.stunnedUntil?Math.sin(elapsed*11+data.phase)*.62:Math.sin(elapsed*2+data.phase)*.04;
        data.legs.forEach((part,i)=>part.pivot.rotation.x=gait*(i===0?1:-1));
        data.arms.forEach((part,i)=>part.pivot.rotation.x=-gait*(i===0?1:-1)*.8);
        data.model.position.y=Math.abs(gait)*.035;
        const sameLevel=Math.abs(playerGroundY-floorHeightAt(enemy.position.x,enemy.position.z))<1.0;
        if(gameState==='playing'&&!playerHidden&&data.model.visible&&elapsed>=data.stunnedUntil&&sameLevel&&jumpHeight<.45&&dist<1.05){
            const reason=theme.id==='nucleo'?'UNIDADE DE INVESTIDA':theme.id==='floresta'?'VÍRUS CAMUFLADO':theme.id==='computador'?'VÍRUS PATRULHEIRO':'ROBÔ-VÍRUS';
            damagePlayer(reason);
        }
    }
}
function updateBoss(dt){
    if(!boss||!bossActive||!boss.visible||gameState!=='playing')return;
    const data=boss.userData;boss.position.y=floorHeightAt(boss.position.x,boss.position.z);
    const dist=Math.hypot(player.position.x-boss.position.x,player.position.z-boss.position.z);
    if(elapsed<data.stunnedUntil){data.stunAura.visible=true;data.moving=false;}
    else if(playerHidden){data.stunAura.visible=false;data.moving=false;}
    else{
        data.stunAura.visible=false;let dx=player.position.x-boss.position.x,dz=player.position.z-boss.position.z;const length=Math.hypot(dx,dz);data.moving=length>.3;
        if(data.moving){dx/=length;dz/=length;boss.rotation.y=Math.atan2(-dx,-dz);moveActor(boss,dx*(currentRules().speed*.9)*dt,dz*(currentRules().speed*.9)*dt,.95);}
    }
    const gait=data.moving&&elapsed>=data.stunnedUntil?Math.sin(elapsed*8+data.phase)*.55:0;
    data.legs.forEach((p,i)=>p.pivot.rotation.x=gait*(i===0?1:-1));data.arms.forEach((p,i)=>p.pivot.rotation.x=-gait*(i===0?1:-1)*.8);
    if(!playerHidden&&jumpHeight<.55&&dist<2.0&&invulnerableTime<=0)damagePlayer('GUARDIÃO');
}
function updateCrystals(dt){
    for(const c of crystals){if(!c.active)continue;const t=elapsed+c.phase;c.root.position.y=c.floorY+Math.sin(t*2.1)*.08;c.core.rotation.y+=dt*1.25;c.core.rotation.x+=dt*.42;c.outer.rotation.y-=dt*.8;c.outer.rotation.x+=dt*.45;c.orbitA.rotation.z+=dt*.9;c.orbitB.rotation.y+=dt*.8;const pulse=1+Math.sin(t*3)*.075;c.core.scale.setScalar(pulse);c.sparkles.forEach((s,i)=>{const angle=t*1.3+i*(Math.PI*2/c.sparkles.length);s.position.set(Math.cos(angle)*.73,1.15+Math.sin(t*2+i)*.18,Math.sin(angle)*.73);});}
}
function updatePlayer(dt){
    if(gameState!=='playing' || activeChallenge)return;
    if(invulnerableTime>0)invulnerableTime=Math.max(0,invulnerableTime-dt);
    let dx=0,dz=0;if(keys['w']||keys['arrowup'])dz-=1;if(keys['s']||keys['arrowdown'])dz+=1;if(keys['a']||keys['arrowleft'])dx-=1;if(keys['d']||keys['arrowright'])dx+=1;
    if(viewMode==='first'){
        const strafe=dx, forward=-dz;
        dx=strafe*Math.cos(cameraYaw)-forward*Math.sin(cameraYaw);
        dz=-strafe*Math.sin(cameraYaw)-forward*Math.cos(cameraYaw);
    }
    const mag=Math.hypot(dx,dz),moving=mag>0;
    playerMoving = moving;
    if(moving){dx/=mag;dz/=mag;const inToxicPool=theme.id==='floresta'&&hazards.some(h=>Math.hypot(player.position.x-h.x,player.position.z-h.z)<h.radius);let speed=inToxicPool?3.0:5.6;if(ownedAbilities.includes('thrusters'))speed*=1.18;if(gameType==='rapido')speed*=1.45;if(elapsed<dashUntil)speed*=1.85;moveActor(player,dx*speed*dt,dz*speed*dt,.4);if(viewMode==='first')player.rotation.y=cameraYaw;else player.rotation.y=Math.atan2(-dx,-dz);walkTime+=dt*(inToxicPool?7:12);}
    const oldWorldY = player.position.y;
    const staticFloor = playerFloorHeightAt(player.position.x, player.position.z, playerGroundY, oldWorldY);
    const movingFloor = platformAt(player.position.x, player.position.z);
    if (gameType === 'desinfeccao' && jumpHeight <= 0 && jumpVelocity <= 0) {
        playerPlatform = null; playerGroundY = staticFloor; player.position.y = staticFloor;
    } else if (jumpHeight > 0 || jumpVelocity > 0) {
        jumpVelocity -= 18 * dt;
        let nextWorldY = oldWorldY + jumpVelocity * dt;
        const ceilingY = playerCeilingAt(player.position.x, player.position.z, playerGroundY);
        const playerBodyHeight = 2.28 * quickWorldScale;
        if (jumpVelocity > 0 && Number.isFinite(ceilingY) && oldWorldY + playerBodyHeight < ceilingY && nextWorldY + playerBodyHeight >= ceilingY) {
            nextWorldY = ceilingY - playerBodyHeight;
            jumpVelocity = 0;
        }
        if (jumpVelocity <= 0 && movingFloor && oldWorldY >= movingFloor.topY && nextWorldY <= movingFloor.topY) {
            playerGroundY = movingFloor.topY; player.position.y = movingFloor.topY;
            jumpHeight = 0; jumpVelocity = 0; playerPlatform = movingFloor;
        } else if (jumpVelocity <= 0 && oldWorldY >= staticFloor - .04 && nextWorldY <= staticFloor) {
            playerGroundY = staticFloor; player.position.y = staticFloor;
            jumpHeight = 0; jumpVelocity = 0; playerPlatform = null;
        } else {
            player.position.y = nextWorldY; playerGroundY = staticFloor;
            jumpHeight = Math.max(0, nextWorldY - staticFloor); playerPlatform = null;
        }
    } else if (movingFloor && Math.abs(oldWorldY - movingFloor.topY) <= .2) {
        playerPlatform = movingFloor; playerGroundY = movingFloor.topY; player.position.y = movingFloor.topY; jumpHeight = 0;
    } else {
        playerPlatform = null; playerGroundY = staticFloor;
        if (oldWorldY > staticFloor + .12) { player.position.y = oldWorldY; jumpHeight = oldWorldY - staticFloor; jumpVelocity = Math.min(jumpVelocity, 0); }
        else { player.position.y = staticFloor; jumpHeight = 0; jumpVelocity = 0; }
    }
    const gait=moving&&jumpHeight<.08?Math.sin(walkTime)*.72:0;
    playerLegs.forEach((p,i)=>p.pivot.rotation.x=gait*(i===0?1:-1));playerArms.forEach((p,i)=>p.pivot.rotation.x=-gait*(i===0?1:-1)*.8);
    playerModel.position.y=jumpHeight>.05?0:(moving?Math.abs(Math.sin(walkTime))*.035:Math.sin(elapsed*2)*.015);
    playerRing.material.color.setHex(invulnerableTime>0&&Math.floor(elapsed*12)%2===0?0xffffff:theme.accent);
    updateHiding();collectCrystals();
}
function updateEMP(dt){if(!empPulse.visible)return;empPulse.userData.life+=dt;const life=empPulse.userData.life;empPulse.scale.setScalar(1+life*9);empPulse.material.opacity=Math.max(0,.9-life*.9);if(life>=1)empPulse.visible=false;}

function requestMouseLook() {
    if (viewMode !== 'first' || gameState !== 'playing') return;
    if (renderer.domElement.requestPointerLock && document.pointerLockElement !== renderer.domElement) {
        try { renderer.domElement.requestPointerLock(); } catch { /* O navegador pode exigir clique explícito no canvas. */ }
    }
}
function setViewMode(mode) {
    viewMode = gameType === 'desinfeccao' ? 'first' : (mode === 'first' ? 'first' : 'third');
    if(viewMode==='first') {
        cameraYaw=player.rotation.y; cameraPitch=0;
        if (gameState === 'playing') requestMouseLook();
    } else if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
    playerModel.visible=viewMode==='third'&&elapsed>=camouflageUntil;
    cameraToggle.textContent=viewMode==='first'?'V — 3ª PESSOA':'V — 1ª PESSOA';
    cameraToggle.classList.toggle('hidden', gameType === 'desinfeccao');
    document.querySelectorAll('[data-view="third"]').forEach(button => { button.disabled = gameType === 'desinfeccao'; button.classList.toggle('mode-secondary', gameType === 'desinfeccao'); });
    reticle.classList.toggle('hidden',viewMode!=='first'||gameState!=='playing');
    document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('selected',button.dataset.view===viewMode));
}
function toggleViewMode(){if(gameType==='desinfeccao'){setViewMode('first');return;}setViewMode(viewMode==='third'?'first':'third');soundButton();}
cameraToggle.addEventListener('click',toggleViewMode);
// Fallback: alguns navegadores só permitem capturar o mouse depois de um clique no canvas.
renderer.domElement.addEventListener('click', () => {
    if (viewMode === 'first' && gameState === 'playing') requestMouseLook();
});
document.addEventListener('mousemove',event=>{
    if(viewMode!=='first'||document.pointerLockElement!==renderer.domElement||gameState!=='playing')return;
    cameraYaw-=event.movementX*.0022;
    cameraPitch=THREE.MathUtils.clamp(cameraPitch-event.movementY*.0018,-.65,.55);
});

document.querySelectorAll('[data-game-type]').forEach(button=>button.addEventListener('click',()=>{
    gameType=button.dataset.gameType;
    if (gameType === 'desinfeccao') viewMode = 'first';
    setViewMode(viewMode);
    document.querySelectorAll('[data-game-type]').forEach(other=>other.classList.toggle('selected',other===button));
    gameTypeSummary.textContent=gameType==='rapido'?'Arena compacta, menos inimigos e objetivo reduzido para partidas curtas.':gameType==='desinfeccao'?'Entre no gabinete de um computador, encontre componentes infectados e complete desafios para limpar o sistema.':'Explore o mundo inteiro, entre nos prédios e descubra rotas alternativas.';
    modeSummary.textContent=gameType==='desinfeccao'?`Remova os componentes infectados e sobreviva a ${({facil:5,medio:7,dificil:9})[selectedMode]} vírus patrulheiros.`:currentRules().summary;
    document.querySelectorAll('.map-card').forEach(card=>{
        card.classList.toggle('mode-secondary',gameType==='desinfeccao');
        card.disabled = gameType === 'desinfeccao';
        card.setAttribute('aria-disabled', gameType === 'desinfeccao' ? 'true' : 'false');
    });
    mapSummary.textContent=gameType==='desinfeccao'?'Modo especial: use o mapa exclusivo do interior de um computador. A seleção dos três mundos está disponível nos modos Exploração e Jogo Rápido.':THEMES[selectedMap].summary;
    if(gameState==='menu')createMap(selectedMap);
    soundButton();
}));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(gameType==='desinfeccao'&&button.dataset.view==='third')return;setViewMode(button.dataset.view);soundButton();}));
document.querySelectorAll('[data-music]').forEach(button=>button.addEventListener('click',()=>{
    selectedMusic=button.dataset.music;
    document.querySelectorAll('[data-music]').forEach(other=>other.classList.toggle('selected',other===button));
    prepareAudio();stopMusic();
    const preview=selectedMusic==='industrial'?[82,123,98]:selectedMusic==='wild'?[147,175,220]:[110,165,220];
    preview.forEach((note,i)=>setTimeout(()=>tone(note,.2,selectedMusic==='industrial'?'square':selectedMusic==='wild'?'sine':'triangle',.05),i*130));
    startLobbyMusic();
    soundButton();
}));

let previousTime=performance.now();
function animate(now=performance.now()){
    requestAnimationFrame(animate);const dt=Math.min((now-previousTime)/1000,.05);previousTime=now;elapsed+=dt;
    updateCrystals(dt);updateEMP(dt);
    updateChallengeTimers(dt);
    if(gameState==='playing'){updateMovingPlatforms(dt);updatePlayer(dt);updateEnemies(dt);updateBoss(dt);updateHazards(dt);updateProjectiles(dt);updateComputerInteractions();}
    else {enemies.forEach(e=>{if(e.visible)e.userData.model.position.y=Math.sin(elapsed*2+e.userData.phase)*.025;});}
    firstPersonRecoil = Math.max(0, firstPersonRecoil - dt * 1.8);
    firstPersonArm.visible = viewMode === 'first' && gameState === 'playing' && !activeChallenge && elapsed >= camouflageUntil;
    firstPersonArm.position.set(.015 + (playerMoving ? Math.sin(walkTime * 6) * .018 : 0), -.005 + (playerMoving ? Math.abs(Math.sin(walkTime * 6)) * .018 : 0), firstPersonRecoil);
    firstPersonArm.rotation.x = playerMoving ? Math.sin(walkTime * 6) * .025 : 0;
    const playerWorld=player.getWorldPosition(new THREE.Vector3());
    if(viewMode==='first'){
        const eyeHeight=1.62*quickWorldScale;
        camera.position.set(playerWorld.x,playerWorld.y+eyeHeight,playerWorld.z);
        const cp=Math.cos(cameraPitch);
        const direction=new THREE.Vector3(-Math.sin(cameraYaw)*cp,Math.sin(cameraPitch),-Math.cos(cameraYaw)*cp);
        camera.lookAt(playerWorld.clone().add(new THREE.Vector3(0,eyeHeight,0)).add(direction.multiplyScalar(12)));
        reticle.classList.toggle('hidden',gameState!=='playing');
    } else {
        const distance=gameType==='rapido'?12.5:10.6;
        const height=gameType==='rapido'?7.5:6.4;
        const offset=new THREE.Vector3(0,height,distance); // terceira pessoa: direção fixa, não gira com o corpo
        const target=playerWorld.clone().add(offset);
        camera.position.lerp(target,1-Math.exp(-4.0*dt));
        camera.lookAt(playerWorld.x,playerWorld.y+1.2*quickWorldScale,playerWorld.z-.2*quickWorldScale);
        reticle.classList.add('hidden');
    }
    updateMinimap();
    renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});

// Inicia no primeiro mapa; todos os mundos estão liberados desde o início.
createMap('cidade');
mapSummary.textContent=THEMES.cidade.summary;
updateMapCards();
modeSummary.textContent=currentRules().summary;
camera.position.set(0,8,18);camera.lookAt(0,0,0);persistShop();updateHUD();animate();
