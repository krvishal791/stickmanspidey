export type AttackType = 'punch' | 'kick' | 'jumpKick' | 'special' | null;

export interface AttackBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FighterState {
  id: 'p1' | 'p2';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: { x: number; y: number };
  color: string;
  secColor: string;
  health: number;
  isAttacking: boolean;
  attackType: AttackType;
  facing: 1 | -1;
  attackBox: AttackBox;
  hitFlash: number;
  animFrame: number;
  comboCount: number;
  lastHitTime: number;
  specialCount: number;
  totalDamageDealt: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
}

// Pre-computed skyline buildings for consistent 60fps rendering
const SKYLINE_BUILDINGS = [
  { x: 20, w: 65, h: 240, windows: 4 },
  { x: 95, w: 80, h: 310, windows: 5 },
  { x: 190, w: 55, h: 200, windows: 3 },
  { x: 260, w: 95, h: 350, spire: true, windows: 6 },
  { x: 375, w: 70, h: 260, windows: 4 },
  { x: 465, w: 90, h: 290, windows: 5 },
  { x: 575, w: 65, h: 220, windows: 4 },
  { x: 655, w: 105, h: 370, spire: true, windows: 6 },
  { x: 775, w: 75, h: 250, windows: 4 },
  { x: 865, w: 85, h: 300, windows: 5 },
  { x: 960, w: 55, h: 230, windows: 3 },
];

export function drawArenaStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameCount: number,
  specialUnlocked: boolean
) {
  const floorY = height - 50;

  // Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, floorY);
  skyGrad.addColorStop(0, '#0b1120');
  skyGrad.addColorStop(0.55, '#162038');
  skyGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, floorY);

  // Subtle ambient moon / spotlight glow in center
  const radial = ctx.createRadialGradient(width / 2, floorY - 180, 10, width / 2, floorY - 180, 440);
  radial.addColorStop(0, specialUnlocked ? 'rgba(16, 185, 129, 0.11)' : 'rgba(56, 189, 248, 0.08)');
  radial.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, floorY);

  // Distant City Skyline
  SKYLINE_BUILDINGS.forEach((b, bIdx) => {
    const by = floorY - b.h;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(b.x, by, b.w, b.h);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, by, b.w, b.h);

    if (b.spire) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(b.x + b.w / 2 - 2, by - 38, 4, 38);
      // Beacon light on spire
      const pulse = Math.sin(frameCount * 0.06 + bIdx) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.6})`;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, by - 40, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lit building windows grid
    const colW = (b.w - 16) / b.windows;
    const rows = Math.floor((b.h - 30) / 22);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < b.windows; c++) {
        const hash = (bIdx * 31 + r * 7 + c * 13) % 10;
        if (hash < 6) {
          ctx.fillStyle = hash < 2 ? 'rgba(250, 204, 21, 0.22)' : 'rgba(148, 163, 184, 0.14)';
          ctx.fillRect(b.x + 8 + c * colW, by + 14 + r * 22, Math.max(4, colW - 5), 10);
        }
      }
    }
  });

  // Rooftop safety railing
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY - 34);
  ctx.lineTo(width, floorY - 34);
  ctx.moveTo(0, floorY - 18);
  ctx.lineTo(width, floorY - 18);
  ctx.stroke();

  for (let postX = 24; postX < width; postX += 64) {
    ctx.fillStyle = '#334155';
    ctx.fillRect(postX, floorY - 36, 4, 36);
  }

  // Floor (50px height matching original canvas.height - 50)
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, height);
  floorGrad.addColorStop(0, '#475569');
  floorGrad.addColorStop(0.2, '#334155');
  floorGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorY, width, 50);

  // Hazard / Helipad floor markings
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, floorY, width, 3);

  ctx.save();
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.14)';
  ctx.lineWidth = 2;
  for (let gx = 0; gx < width; gx += 80) {
    ctx.beginPath();
    ctx.moveTo(gx, floorY);
    ctx.lineTo(gx - 25, height);
    ctx.stroke();
  }

  // Center arena starting markers
  ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
  ctx.fillRect(200, floorY + 3, 50, 4);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.45)';
  ctx.fillRect(750, floorY + 3, 50, 4);
  ctx.restore();
}

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  showHitboxes: boolean,
  classicBlockMode: boolean,
  frameCount: number
) {
  ctx.save();

  // Floor shadow under fighter
  const floorY = 576 - 50;
  const heightOffGround = Math.max(0, floorY - (fighter.y + fighter.height));
  const shadowScale = Math.max(0.4, 1 - heightOffGround / 300);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(
    fighter.x + fighter.width / 2,
    floorY + 6,
    26 * shadowScale,
    6 * shadowScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  if (classicBlockMode) {
    // Original prototype block rendering
    ctx.fillStyle = fighter.hitFlash > 0 ? '#ffffff' : fighter.color;
    ctx.fillRect(fighter.x, fighter.y, fighter.width, fighter.height / 2);
    ctx.fillStyle = fighter.hitFlash > 0 ? '#f8fafc' : fighter.secColor;
    ctx.fillRect(fighter.x, fighter.y + fighter.height / 2, fighter.width, fighter.height / 2);
  } else {
    // Detailed Hero Character Rendering inside the 50x150 bounding geometry
    if (fighter.id === 'p1') {
      drawSpiderMan(ctx, fighter, frameCount);
    } else {
      drawCaptainAmerica(ctx, fighter, frameCount);
    }
  }

  // Draw Special & Attack Visual Effects
  if (fighter.isAttacking && fighter.attackType) {
    drawAttackEffects(ctx, fighter, frameCount);
  }

  // Draw Attack Box overlay (matches user's rgba(255, 255, 0, 0.5) when showHitboxes is active)
  if (fighter.isAttacking && showHitboxes) {
    ctx.fillStyle = 'rgba(255, 255, 0, 0.42)';
    ctx.fillRect(
      fighter.attackBox.x,
      fighter.attackBox.y,
      fighter.attackBox.width,
      fighter.attackBox.height
    );
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      fighter.attackBox.x,
      fighter.attackBox.y,
      fighter.attackBox.width,
      fighter.attackBox.height
    );
  }

  if (showHitboxes) {
    // Subtle hurtbox outline around the 50x150 fighter body
    ctx.strokeStyle = fighter.id === 'p1' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(fighter.x, fighter.y, fighter.width, fighter.height);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawSpiderMan(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  frameCount: number
) {
  const isMoving = Math.abs(f.velocity.x) > 0.5;
  const isAir = f.velocity.y !== 0;
  const bob = isMoving ? Math.sin(frameCount * 0.35) * 3 : Math.sin(frameCount * 0.1) * 1.5;
  const stride = isMoving ? Math.sin(frameCount * 0.35) * 10 : 0;

  const cx = f.x + f.width / 2;
  const topY = f.y + bob;
  const flash = f.hitFlash > 0;

  const red = flash ? '#ffffff' : '#dc2626';
  const darkRed = flash ? '#e2e8f0' : '#991b1b';
  const blue = flash ? '#cbd5e1' : '#1d4ed8';

  // Legs (Lower half: y + 75 to y + 150)
  ctx.lineCap = 'round';
  ctx.lineWidth = 13;

  // Back leg
  ctx.strokeStyle = blue;
  ctx.beginPath();
  ctx.moveTo(cx - f.facing * 6, f.y + 82);
  if (f.isAttacking && (f.attackType === 'kick' || f.attackType === 'jumpKick')) {
    ctx.lineTo(cx - f.facing * 12, f.y + 144);
  } else {
    ctx.lineTo(cx - f.facing * 8 - stride, f.y + 144);
  }
  ctx.stroke();

  // Front leg (extends on kick / jumpKick)
  ctx.strokeStyle = blue;
  ctx.beginPath();
  ctx.moveTo(cx + f.facing * 6, f.y + 82);
  if (f.isAttacking && f.attackType === 'kick') {
    ctx.lineTo(cx + f.facing * 68, f.y + 92);
  } else if (f.isAttacking && f.attackType === 'jumpKick') {
    ctx.lineTo(cx + f.facing * 85, f.y + 122);
  } else if (isAir) {
    ctx.lineTo(cx + f.facing * 14, f.y + 130);
  } else {
    ctx.lineTo(cx + f.facing * 8 + stride, f.y + 144);
  }
  ctx.stroke();

  // Red Boots overlay on lower shins
  ctx.strokeStyle = red;
  ctx.lineWidth = 13;
  if (!f.isAttacking || (f.attackType !== 'kick' && f.attackType !== 'jumpKick')) {
    ctx.beginPath();
    ctx.moveTo(cx + f.facing * 8 + stride * 0.7, f.y + 120);
    ctx.lineTo(cx + f.facing * 8 + stride, f.y + 144);
    ctx.stroke();
  }

  // Torso (Upper half: y + 32 to y + 86)
  ctx.fillStyle = blue;
  ctx.beginPath();
  ctx.roundRect(f.x + 6, topY + 34, f.width - 12, 52, 8);
  ctx.fill();

  // Red chest & shoulder panel
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.roundRect(f.x + 5, topY + 34, f.width - 10, 32, [8, 8, 4, 4]);
  ctx.fill();

  // Black Spider emblem on chest
  if (!flash) {
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.ellipse(cx + f.facing * 4, topY + 49, 3.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Red Belt
  ctx.fillStyle = red;
  ctx.fillRect(f.x + 6, topY + 78, f.width - 12, 8);

  // Head / Mask
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.roundRect(f.x + 9, topY + 4, f.width - 18, 30, 12);
  ctx.fill();
  ctx.strokeStyle = darkRed;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Expressive Spider-Man Eyes (facing direction)
  const eyeX = cx + f.facing * 7;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(eyeX - f.facing * 6, topY + 14);
  ctx.lineTo(eyeX + f.facing * 8, topY + 18);
  ctx.lineTo(eyeX - f.facing * 2, topY + 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Arms (extend on punch or Web Blast special)
  ctx.strokeStyle = red;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(cx + f.facing * 6, topY + 42);
  if (f.isAttacking && f.attackType === 'punch') {
    ctx.lineTo(cx + f.facing * 66, topY + 36);
  } else if (f.isAttacking && f.attackType === 'special') {
    ctx.lineTo(cx + f.facing * 52, topY + 46);
  } else {
    ctx.lineTo(cx + f.facing * 16 - stride * 0.5, topY + 66);
  }
  ctx.stroke();
}

function drawCaptainAmerica(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  frameCount: number
) {
  const isMoving = Math.abs(f.velocity.x) > 0.5;
  const isAir = f.velocity.y !== 0;
  const bob = isMoving ? Math.sin(frameCount * 0.35) * 3 : Math.sin(frameCount * 0.1) * 1.5;
  const stride = isMoving ? Math.sin(frameCount * 0.35) * 10 : 0;

  const cx = f.x + f.width / 2;
  const topY = f.y + bob;
  const flash = f.hitFlash > 0;

  const capBlue = flash ? '#ffffff' : '#1e40af';
  const slatePants = flash ? '#cbd5e1' : '#475569';
  const bootRed = flash ? '#f8fafc' : '#b91c1c';

  // Legs (Lower half: y + 75 to y + 150)
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;

  // Back leg
  ctx.strokeStyle = slatePants;
  ctx.beginPath();
  ctx.moveTo(cx - f.facing * 6, f.y + 82);
  ctx.lineTo(cx - f.facing * 8 - stride, f.y + 144);
  ctx.stroke();

  // Front leg
  ctx.strokeStyle = slatePants;
  ctx.beginPath();
  ctx.moveTo(cx + f.facing * 6, f.y + 82);
  if (f.isAttacking && f.attackType === 'kick') {
    ctx.lineTo(cx + f.facing * 68, f.y + 92);
  } else if (f.isAttacking && f.attackType === 'jumpKick') {
    ctx.lineTo(cx + f.facing * 85, f.y + 122);
  } else if (isAir) {
    ctx.lineTo(cx + f.facing * 14, f.y + 130);
  } else {
    ctx.lineTo(cx + f.facing * 8 + stride, f.y + 144);
  }
  ctx.stroke();

  // Red Combat Boots
  ctx.strokeStyle = bootRed;
  ctx.lineWidth = 14;
  if (!f.isAttacking || (f.attackType !== 'kick' && f.attackType !== 'jumpKick')) {
    ctx.beginPath();
    ctx.moveTo(cx + f.facing * 8 + stride * 0.7, f.y + 122);
    ctx.lineTo(cx + f.facing * 8 + stride, f.y + 144);
    ctx.stroke();
  }

  // Torso (Upper half)
  ctx.fillStyle = capBlue;
  ctx.beginPath();
  ctx.roundRect(f.x + 5, topY + 34, f.width - 10, 52, 8);
  ctx.fill();

  // Red & White Stripes on lower abdomen
  if (!flash) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#dc2626';
      ctx.fillRect(f.x + 8 + i * 7, topY + 64, 7, 16);
    }
    // White Star on Chest
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + f.facing * 4, topY + 48, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tactical Utility Belt
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(f.x + 5, topY + 78, f.width - 10, 7);

  // Head & Helmet
  ctx.fillStyle = '#fed7aa'; // Chin/face
  ctx.beginPath();
  ctx.roundRect(f.x + 9, topY + 4, f.width - 18, 30, 11);
  ctx.fill();

  // Blue Helmet Cowl
  ctx.fillStyle = capBlue;
  ctx.beginPath();
  ctx.roundRect(f.x + 8, topY + 3, f.width - 16, 20, [11, 11, 3, 3]);
  ctx.fill();

  // 'A' Emblem on Helmet
  if (!flash) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', cx + f.facing * 6, topY + 15);
  }

  // Lead Arm + Vibranium Shield
  ctx.strokeStyle = capBlue;
  ctx.lineWidth = 12;
  const armEndX =
    f.isAttacking && f.attackType === 'punch'
      ? cx + f.facing * 66
      : f.isAttacking && f.attackType === 'special'
      ? cx + f.facing * 95
      : cx + f.facing * 18;
  const armEndY =
    f.isAttacking && f.attackType === 'punch'
      ? topY + 36
      : f.isAttacking && f.attackType === 'special'
      ? topY + 52
      : topY + 58;

  ctx.beginPath();
  ctx.moveTo(cx + f.facing * 4, topY + 42);
  ctx.lineTo(armEndX, armEndY);
  ctx.stroke();

  // Vibranium Round Shield
  const shieldX = armEndX + f.facing * 4;
  const shieldY = armEndY;
  ctx.save();
  ctx.beginPath();
  ctx.arc(shieldX, shieldY, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f8fafc';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(shieldX, shieldY, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#1d4ed8';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(shieldX, shieldY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAttackEffects(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  frameCount: number
) {
  const box = f.attackBox;
  ctx.save();

  if (f.attackType === 'special') {
    if (f.id === 'p1') {
      // SPIDER-MAN: WEB BLAST SPECIAL (250px range)
      const originX = f.facing === 1 ? box.x : box.x + box.width;
      const targetX = f.facing === 1 ? box.x + box.width : box.x;
      const midY = box.y + box.height / 2;

      // Outer webbing glow
      const grad = ctx.createLinearGradient(originX, midY, targetX, midY);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.7, 'rgba(226, 232, 240, 0.85)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.3)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(originX, midY);
      ctx.lineTo(targetX, midY);
      ctx.stroke();

      // Intersecting spiral web strands across the 250x80 special hitbox
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      for (let strand = -1; strand <= 1; strand += 2) {
        ctx.beginPath();
        ctx.moveTo(originX, midY);
        for (let step = 0; step <= box.width; step += 25) {
          const px = originX + f.facing * step;
          const py = midY + Math.sin(step * 0.08 + frameCount * 0.5) * 28 * strand;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Vertical web rungs
      for (let step = 35; step < box.width; step += 38) {
        const px = originX + f.facing * step;
        const spread = Math.min(34, step * 0.16);
        ctx.beginPath();
        ctx.moveTo(px, midY - spread);
        ctx.lineTo(px, midY + spread);
        ctx.stroke();
      }
    } else {
      // CAPTAIN AMERICA: SHIELD BASH SPECIAL (250px range)
      const originX = f.facing === 1 ? box.x : box.x + box.width;
      const targetX = f.facing === 1 ? box.x + box.width : box.x;
      const midY = box.y + box.height / 2;

      const grad = ctx.createLinearGradient(originX, midY, targetX, midY);
      grad.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
      grad.addColorStop(0.5, 'rgba(96, 165, 250, 0.65)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0.9)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y + 8, box.width, box.height - 16, 32);
      ctx.fill();

      // Kinetic shield afterimages racing across the 250px zone
      for (let i = 1; i <= 3; i++) {
        const sx = originX + f.facing * (i * 72);
        ctx.strokeStyle = i === 3 ? '#ffffff' : 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sx, midY, 26, -Math.PI * 0.45, Math.PI * 0.45, f.facing === -1);
        ctx.stroke();
      }
    }
  } else {
    // Standard Punch, Kick, Jump Kick motion arc
    const arcX = f.facing === 1 ? box.x + box.width * 0.65 : box.x + box.width * 0.35;
    const arcY = box.y + box.height / 2;
    ctx.strokeStyle =
      f.attackType === 'jumpKick'
        ? '#facc15'
        : f.id === 'p1'
        ? '#f87171'
        : '#60a5fa';
    ctx.lineWidth = f.attackType === 'jumpKick' ? 5 : 3.5;
    ctx.beginPath();
    ctx.arc(
      arcX,
      arcY,
      box.height * 0.48,
      f.facing === 1 ? -Math.PI * 0.45 : Math.PI * 0.55,
      f.facing === 1 ? Math.PI * 0.45 : Math.PI * 1.45
    );
    ctx.stroke();
  }

  ctx.restore();
}
