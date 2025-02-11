
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 600;

// プレイヤー情報
const player = { x: 400, y: 300, speed: 3 };
// 敵、弾、エフェクト、キー入力用配列／オブジェクト
const enemies = [];
const bullets = [];
const effects = [];
const keys = {};

// スコア・レベル管理
let score = 0;
let level = 1;
const scorePerLevel = 100; // レベルアップに必要なスコア

// 現在の武器パラメータ（初期は少し弱め）
const currentWeapon = {
  bulletSpeed: 4,      // 弾速
  turningRate: 0.05,   // 追尾の補正率
  spread: 0,           // 連射（0なら単発、数値が大きいほど発射弾数が増える）
  piercing: 0,         // 貫通回数（0なら貫通なし）
  explosive: false,    // 爆発属性（trueなら衝突時に周囲へダメージ）
  explosiveLevel: 0    // 爆発性能の強さ（爆発範囲等に影響）
};

// アップグレードメニュー用変数
let upgradeMenuActive = false;
let upgradeOptions = [];
let upgradeBoxes = [];

// 選択可能なアップグレード一覧（同じものを選ぶと累積的に性能が向上）
const availableUpgrades = [
  {
    name: "Faster Bullets",
    description: "弾速が+1上昇する",
    apply: function() {
      currentWeapon.bulletSpeed += 1;
    }
  },
  {
    name: "Better Homing",
    description: "追尾性能が+0.05向上する",
    apply: function() {
      currentWeapon.turningRate += 0.05;
    }
  },
  {
    name: "Spread Shot",
    description: "連射（発射弾数）が増加する",
    apply: function() {
      // 初回は3連射（spread=2で左右にそれぞれ1発＋中央1発）
      // 既に連射なら、最大5発（spread最大値は4）まで増加
      if (currentWeapon.spread === 0) {
        currentWeapon.spread = 2;
      } else if (currentWeapon.spread < 4) {
        currentWeapon.spread += 1;
      }
    }
  },
  {
    name: "Piercing Shots",
    description: "弾が貫通し、1体以上を貫けるようになる",
    apply: function() {
      currentWeapon.piercing += 1;
    }
  },
  {
    name: "Explosive Rounds",
    description: "弾が爆発し、範囲ダメージを与える",
    apply: function() {
      if (!currentWeapon.explosive) {
        currentWeapon.explosive = true;
        currentWeapon.explosiveLevel = 1;
      } else {
        currentWeapon.explosiveLevel += 1;
      }
    }
  }
];

// キーボード入力の設定
document.addEventListener("keydown", (e) => (keys[e.key] = true));
document.addEventListener("keyup", (e) => (keys[e.key] = false));

// マウスクリック時の処理：アップグレードメニュー中なら武器選択、通常なら弾発射
canvas.addEventListener("click", (e) => {
  if (upgradeMenuActive) {
    processUpgradeMenuClick(e);
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // プレイヤーからクリック位置への角度を計算
  const dx = mouseX - player.x;
  const dy = mouseY - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return;
  
  const mainAngle = Math.atan2(dy, dx);
  
  // 連射（Spread Shot）があれば複数発射、なければ1発
  const spreadCount = currentWeapon.spread > 0 ? currentWeapon.spread + 1 : 1;
  const spreadAngle = 15 * (Math.PI / 180); // 15度ずつずらす
  
  for (let i = 0; i < spreadCount; i++) {
    let angle = mainAngle;
    if (spreadCount > 1) {
      // 中央の弾を基準に左右にずらす
      angle = mainAngle + (i - (spreadCount - 1) / 2) * spreadAngle;
    }
    const vx = Math.cos(angle) * currentWeapon.bulletSpeed;
    const vy = Math.sin(angle) * currentWeapon.bulletSpeed;
    // 各弾は発射時に現在の武器性能（貫通、爆発）をコピー
    bullets.push({
      x: player.x,
      y: player.y,
      vx,
      vy,
      speed: currentWeapon.bulletSpeed,
      radius: 5,
      piercing: currentWeapon.piercing,         // 残り貫通回数
      explosive: currentWeapon.explosive,         // 爆発属性
      explosiveLevel: currentWeapon.explosiveLevel  // 爆発性能（後述：爆発範囲に影響）
    });
  }
});

// プレイヤー移動（アップグレード中は一時停止）
function movePlayer() {
  if (!upgradeMenuActive) {
    if (keys["ArrowUp"] || keys["w"]) player.y -= player.speed;
    if (keys["ArrowDown"] || keys["s"]) player.y += player.speed;
    if (keys["ArrowLeft"] || keys["a"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"]) player.x += player.speed;
    
    player.x = Math.max(0, Math.min(canvas.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height, player.y));
  }
}

// 敵生成（アップグレード中は一時停止）
function spawnEnemy() {
  if (!upgradeMenuActive) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    enemies.push({ x, y, speed: 1.5 });
  }
}
setInterval(spawnEnemy, 1000);

// 敵移動（プレイヤー追尾、レベルに応じて加速）
function moveEnemies() {
  if (!upgradeMenuActive) {
    enemies.forEach((enemy) => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const speedMultiplier = 1 + (level - 1) * 0.2;
        enemy.x += (dx / dist) * enemy.speed * speedMultiplier;
        enemy.y += (dy / dist) * enemy.speed * speedMultiplier;
      }
    });
  }
}

// 弾の移動＋自動追尾＆敵との衝突判定
function moveBullets() {
  if (!upgradeMenuActive) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      
      // 自動追尾処理：シーン内で最も近い敵をターゲットにする
      if (enemies.length > 0) {
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        for (let enemy of enemies) {
          const dx = enemy.x - bullet.x;
          const dy = enemy.y - bullet.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearestDistance) {
            nearestDistance = d;
            nearestEnemy = enemy;
          }
        }
        if (nearestEnemy) {
          const dx = nearestEnemy.x - bullet.x;
          const dy = nearestEnemy.y - bullet.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const desiredVX = (dx / d) * bullet.speed;
          const desiredVY = (dy / d) * bullet.speed;
          // currentWeapon.turningRate を使って追尾の滑らかさを調整
          const turningRate = currentWeapon.turningRate;
          bullet.vx = bullet.vx * (1 - turningRate) + desiredVX * turningRate;
          bullet.vy = bullet.vy * (1 - turningRate) + desiredVY * turningRate;
          // 速度正規化
          const currentSpeed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
          if (currentSpeed !== 0) {
            bullet.vx = (bullet.vx / currentSpeed) * bullet.speed;
            bullet.vy = (bullet.vy / currentSpeed) * bullet.speed;
          }
        }
      }
      
      // 位置更新
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      
      // 画面外なら削除
      if (
        bullet.x < 0 ||
        bullet.x > canvas.width ||
        bullet.y < 0 ||
        bullet.y > canvas.height
      ) {
        bullets.splice(i, 1);
        continue;
      }
      
      // 敵との衝突判定
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        // 敵のサイズは中心から約10px、弾はradius:5 → 当たり判定は15px未満
        if (d < bullet.radius + 10) {
          // 衝突時のスコア加算
          score += 10;
          
          // 爆発属性の場合は、周囲にもダメージを与える
          if (bullet.explosive) {
            // 爆発範囲は爆発レベルで拡大（初期30px、以降+5pxずつ）
            const explosionRadius = 30 + 5 * (bullet.explosiveLevel - 1);
            // 爆発エフェクトの生成（豪華なラジアルグラデーションで描画）
            effects.push({
              x: enemy.x,
              y: enemy.y,
              radius: 0,
              maxRadius: explosionRadius,
              alpha: 1,
              type: "explosion"
            });
            // 爆発衝撃で範囲内の敵も除去（自分自身の衝突対象は既にヒットしているので j 以外を処理）
            for (let k = enemies.length - 1; k >= 0; k--) {
              const other = enemies[k];
              const dx2 = other.x - enemy.x;
              const dy2 = other.y - enemy.y;
              const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              if (d2 < explosionRadius) {
                // 爆発で倒した敵もスコア加算
                score += 10;
                enemies.splice(k, 1);
              }
            }
            // 爆発弾は衝突後に必ず消滅
            bullets.splice(i, 1);
          } else {
            // 爆発でない場合：弾が貫通するかどうか
            enemies.splice(j, 1);
            if (bullet.piercing > 0) {
              bullet.piercing -= 1;
              // 貫通性能が残っていれば弾は残す（ただし、無限に残らないよう注意）
            } else {
              bullets.splice(i, 1);
            }
          }
          
          // レベルアップ判定
          if (score >= level * scorePerLevel && !upgradeMenuActive) {
            activateUpgradeMenu();
            return; // アップグレード選択中は処理を中断
          }
          break; // この弾については他の敵との判定は不要
        }
      }
    }
  }
}

// エフェクトの更新（爆発エフェクトはより豪華に）
function updateEffects() {
  if (!upgradeMenuActive) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      if (effect.type === "explosion") {
        effect.radius += 2;      // 爆発は速く広がる
        effect.alpha -= 0.03;    // 徐々に透明に
      } else {
        effect.radius += 1;
        effect.alpha -= 0.02;
      }
      if (effect.alpha <= 0 || effect.radius >= effect.maxRadius) {
        effects.splice(i, 1);
      }
    }
  }
}

// 描画処理
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // プレイヤー描画（青い四角形）
  ctx.fillStyle = "blue";
  ctx.fillRect(player.x - 10, player.y - 10, 20, 20);
  
  // 敵描画（赤い四角形）
  ctx.fillStyle = "red";
  enemies.forEach((enemy) => {
    ctx.fillRect(enemy.x - 10, enemy.y - 10, 20, 20);
  });
  
  // 弾描画（黒い円）
  ctx.fillStyle = "black";
  bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // エフェクト描画
  effects.forEach((effect) => {
    if (effect.type === "explosion") {
      // 爆発エフェクト：中心は黄色、外側はオレンジ→赤、グラデーションで描画
      let grad = ctx.createRadialGradient(
        effect.x, effect.y, effect.radius * 0.2,
        effect.x, effect.y, effect.radius
      );
      grad.addColorStop(0, `rgba(255, 255, 0, ${effect.alpha})`);
      grad.addColorStop(0.5, `rgba(255, 165, 0, ${effect.alpha * 0.7})`);
      grad.addColorStop(1, `rgba(255, 0, 0, 0)`);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = `rgba(0, 255, 0, ${effect.alpha})`;
    }
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // スコアとレベル表示
  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText("Score: " + score, 10, 20);
  ctx.fillText("Level: " + level, 10, 45);
  
  // アップグレードメニュー描画（表示中ならオーバーレイ）
  if (upgradeMenuActive) {
    drawUpgradeMenu();
  }
}

// メインループ：アップグレード中は更新処理を一時停止
function gameLoop() {
  if (!upgradeMenuActive) {
    movePlayer();
    moveEnemies();
    moveBullets();
    updateEffects();
  }
  draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();


// ★★ 以下、アップグレードメニュー関連の実装 ★★

// レベルアップ時にアップグレードメニューを表示する
function activateUpgradeMenu() {
  upgradeMenuActive = true;
  // 今回は全アップグレード候補を表示（ここをランダムに絞っても可）
  upgradeOptions = availableUpgrades.slice(); // 配列のコピー
  upgradeBoxes = [];
  const boxWidth = 300;
  const boxHeight = 70;
  const spacing = 20;
  const totalHeight = upgradeOptions.length * (boxHeight + spacing) - spacing;
  const startY = canvas.height / 2 - totalHeight / 2;
  const startX = canvas.width / 2 - boxWidth / 2;
  
  for (let i = 0; i < upgradeOptions.length; i++) {
    upgradeBoxes.push({
      x: startX,
      y: startY + i * (boxHeight + spacing),
      width: boxWidth,
      height: boxHeight,
      upgrade: upgradeOptions[i]
    });
  }
}

// アップグレードメニューの描画（半透明背景＋各選択肢ボックス）
function drawUpgradeMenu() {
  // 背景オーバーレイ
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 各アップグレード候補のボックス
  upgradeBoxes.forEach(box => {
    ctx.fillStyle = "white";
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeStyle = "black";
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = "black";
    ctx.font = "18px Arial";
    ctx.fillText(box.upgrade.name, box.x + 10, box.y + 25);
    ctx.font = "14px Arial";
    ctx.fillText(box.upgrade.description, box.x + 10, box.y + 50);
  });
}

// クリック時、アップグレード候補のボックス内ならそのアップグレードを適用する
function processUpgradeMenuClick(e) {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  for (let box of upgradeBoxes) {
    if (
      clickX >= box.x &&
      clickX <= box.x + box.width &&
      clickY >= box.y &&
      clickY <= box.y + box.height
    ) {
      // 選択したアップグレードを適用
      box.upgrade.apply();
      level++;  // レベルアップ確定
      upgradeMenuActive = false;
      upgradeOptions = [];
      upgradeBoxes = [];
      // 選択時のエフェクト（緑の拡大エフェクト）
      effects.push({
        x: player.x,
        y: player.y,
        radius: 0,
        maxRadius: 50,
        alpha: 1,
        type: "upgrade"
      });
      break;
    }
  }
}
