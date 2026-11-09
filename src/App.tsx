import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AttackType,
  FighterState,
  FloatingText,
  Particle,
  drawArenaStage,
  drawFighter,
} from './game/canvasRenderer';
import { soundEngine } from './audio/soundEngine';

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;
const GRAVITY = 0.7;
const FLOOR_OFFSET = 50;

export type DifficultyLevel = 'easy' | 'medium' | 'difficult';

interface DifficultyConfig {
  label: string;
  moveSpeed: number;
  retreatSpeed: number;
  attackCooldownFrames: number;
  jumpChancePerCheck: number;
  jumpKickChance: number;
  specialReactionFrames: number;
  evadePlayerAttackChance: number;
  aggressionRange: number;
  description: string;
}

const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    moveSpeed: 2.8,
    retreatSpeed: 1.8,
    attackCooldownFrames: 52,
    jumpChancePerCheck: 0.15,
    jumpKickChance: 0.2,
    specialReactionFrames: 90,
    evadePlayerAttackChance: 0.08,
    aggressionRange: 80,
    description: 'Slower pacing, basic punches/kicks, and wide openings.',
  },
  medium: {
    label: 'Medium',
    moveSpeed: 4.3,
    retreatSpeed: 3.2,
    attackCooldownFrames: 28,
    jumpChancePerCheck: 0.42,
    jumpKickChance: 0.55,
    specialReactionFrames: 42,
    evadePlayerAttackChance: 0.35,
    aggressionRange: 95,
    description: 'Balanced spacing, aerial jump kicks, and timed Shield Bashes.',
  },
  difficult: {
    label: 'Difficult',
    moveSpeed: 5.5,
    retreatSpeed: 4.8,
    attackCooldownFrames: 15,
    jumpChancePerCheck: 0.75,
    jumpKickChance: 0.88,
    specialReactionFrames: 14,
    evadePlayerAttackChance: 0.78,
    aggressionRange: 112,
    description: 'Fast footwork, reactive jump-evasion, heavy aerial kicks, and instant Shield Bash punishes.',
  },
};

function createInitialFighter(id: 'p1' | 'p2'): FighterState {
  if (id === 'p1') {
    return {
      id: 'p1',
      name: 'Spider-Man',
      x: 200,
      y: CANVAS_HEIGHT - FLOOR_OFFSET - 150,
      width: 50,
      height: 150,
      velocity: { x: 0, y: 0 },
      color: 'red',
      secColor: 'blue',
      health: 100,
      isAttacking: false,
      attackType: null,
      facing: 1,
      attackBox: { x: 250, y: 0, width: 100, height: 50 },
      hitFlash: 0,
      animFrame: 0,
      comboCount: 0,
      lastHitTime: 0,
      specialCount: 0,
      totalDamageDealt: 0,
    };
  }
  return {
    id: 'p2',
    name: 'Captain America (CPU)',
    x: 750,
    y: CANVAS_HEIGHT - FLOOR_OFFSET - 150,
    width: 50,
    height: 150,
    velocity: { x: 0, y: 0 },
    color: 'blue',
    secColor: 'grey',
    health: 100,
    isAttacking: false,
    attackType: null,
    facing: -1,
    attackBox: { x: 650, y: 0, width: 100, height: 50 },
    hitFlash: 0,
    animFrame: 0,
    comboCount: 0,
    lastHitTime: 0,
    specialCount: 0,
    totalDamageDealt: 0,
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // React UI State
  const [p1Health, setP1Health] = useState<number>(100);
  const [p2Health, setP2Health] = useState<number>(100);
  const [timeRemaining, setTimeRemaining] = useState<number>(15);
  const [specialUnlocked, setSpecialUnlocked] = useState<boolean>(false);
  const [winner, setWinner] = useState<'p1' | 'p2' | null>(null);
  const [score, setScore] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const [roundNumber, setRoundNumber] = useState<number>(1);

  // CPU Difficulty & Arena Settings
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [showHitboxes, setShowHitboxes] = useState<boolean>(true);
  const [classicBlockMode, setClassicBlockMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [combatLog, setCombatLog] = useState<string>(
    'Round 1 · You control Spider-Man vs. CPU Captain America (Medium)'
  );

  // Mutable Game Loop Refs
  const p1Ref = useRef<FighterState>(createInitialFighter('p1'));
  const p2Ref = useRef<FighterState>(createInitialFighter('p2'));
  const keysRef = useRef<Record<string, boolean>>({});
  const specialUnlockedRef = useRef<boolean>(false);
  const winnerRef = useRef<'p1' | 'p2' | null>(null);
  const difficultyRef = useRef<DifficultyLevel>('medium');
  const showHitboxesRef = useRef<boolean>(true);
  const classicBlockRef = useRef<boolean>(false);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const screenShakeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const cpuStateRef = useRef<{
    lastAttackFrame: number;
    lastSpecialFrame: number;
    strafeDir: 1 | -1;
    strafeUntilFrame: number;
  }>({
    lastAttackFrame: 0,
    lastSpecialFrame: 0,
    strafeDir: 1,
    strafeUntilFrame: 0,
  });
  const attackTimeoutsRef = useRef<{ p1: number | null; p2: number | null }>({
    p1: null,
    p2: null,
  });

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    showHitboxesRef.current = showHitboxes;
  }, [showHitboxes]);

  useEffect(() => {
    classicBlockRef.current = classicBlockMode;
  }, [classicBlockMode]);

  useEffect(() => {
    soundEngine.enabled = soundEnabled;
  }, [soundEnabled]);

  const spawnHitParticles = useCallback(
    (x: number, y: number, color: string, count: number = 14) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6.5;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          size: 3 + Math.random() * 4,
          color,
          alpha: 1,
          decay: 0.03 + Math.random() * 0.025,
        });
      }
    },
    []
  );

  const spawnFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      x,
      y,
      vy: -1.8,
      text,
      color,
      alpha: 1,
      scale: 1,
    });
  }, []);

  const updateHitboxGeometry = useCallback((fighter: FighterState) => {
    if (fighter.attackType === 'punch') {
      fighter.attackBox.y = fighter.y + 20;
      fighter.attackBox.width = 80;
      fighter.attackBox.height = 30;
    } else if (fighter.attackType === 'kick') {
      fighter.attackBox.y = fighter.y + 70;
      fighter.attackBox.width = 100;
      fighter.attackBox.height = 40;
    } else if (fighter.attackType === 'jumpKick') {
      fighter.attackBox.y = fighter.y + 100;
      fighter.attackBox.width = 120;
      fighter.attackBox.height = 50;
    } else if (fighter.attackType === 'special') {
      fighter.attackBox.y = fighter.y + 30;
      fighter.attackBox.width = 250; // Huge range
      fighter.attackBox.height = 80;
    }
    fighter.attackBox.x =
      fighter.facing === 1 ? fighter.x + fighter.width : fighter.x - fighter.attackBox.width;
  }, []);

  const triggerAttack = useCallback(
    (playerKey: 'p1' | 'p2', requestedType: 'punch' | 'kick' | 'special') => {
      if (winnerRef.current) return;
      const fighter = playerKey === 'p1' ? p1Ref.current : p2Ref.current;

      if (requestedType === 'special' && !specialUnlockedRef.current) {
        if (playerKey === 'p1') {
          spawnFloatingText(
            fighter.x + fighter.width / 2,
            fighter.y - 10,
            'LOCKED!',
            '#facc15'
          );
        }
        return;
      }

      let finalType: Exclude<AttackType, null> = requestedType;
      if (requestedType === 'kick' && fighter.velocity.y !== 0) {
        finalType = 'jumpKick'; // Transform kick to jump kick in air
      }

      fighter.isAttacking = true;
      fighter.attackType = finalType;
      updateHitboxGeometry(fighter);

      soundEngine.playSwing(finalType, playerKey === 'p1' ? 'spidey' : 'cap');

      if (attackTimeoutsRef.current[playerKey]) {
        window.clearTimeout(attackTimeoutsRef.current[playerKey]!);
      }

      attackTimeoutsRef.current[playerKey] = window.setTimeout(() => {
        fighter.isAttacking = false;
        fighter.attackType = null;
      }, 130);
    },
    [spawnFloatingText, updateHitboxGeometry]
  );

  // 15-second Special Move Countdown Timer
  useEffect(() => {
    if (specialUnlocked || winner) return;

    const timerInterval = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerInterval);
          specialUnlockedRef.current = true;
          setSpecialUnlocked(true);
          soundEngine.playSpecialUnlocked();
          setCombatLog('SPECIAL MOVES UNLOCKED · Press H for Spider-Man Web Blast!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerInterval);
  }, [specialUnlocked, winner, roundNumber]);

  // Reset / Rematch handler
  const handleResetMatch = useCallback(
    (nextRound: boolean = false, customDiff?: DifficultyLevel) => {
      if (attackTimeoutsRef.current.p1) window.clearTimeout(attackTimeoutsRef.current.p1);
      if (attackTimeoutsRef.current.p2) window.clearTimeout(attackTimeoutsRef.current.p2);

      p1Ref.current = createInitialFighter('p1');
      p2Ref.current = createInitialFighter('p2');
      particlesRef.current = [];
      floatingTextsRef.current = [];
      screenShakeRef.current = 0;
      cpuStateRef.current = {
        lastAttackFrame: 0,
        lastSpecialFrame: 0,
        strafeDir: 1,
        strafeUntilFrame: 0,
      };

      winnerRef.current = null;
      specialUnlockedRef.current = false;

      setP1Health(100);
      setP2Health(100);
      setWinner(null);
      setSpecialUnlocked(false);
      setTimeRemaining(15);

      const activeDiff = customDiff ?? difficultyRef.current;
      const diffLabel = DIFFICULTY_CONFIGS[activeDiff].label;

      if (nextRound) {
        setRoundNumber((r) => {
          const next = r + 1;
          setCombatLog(
            `Round ${next} started · CPU Difficulty: ${diffLabel} · Specials unlock in 15s`
          );
          return next;
        });
      } else {
        setCombatLog(
          `Match ready · CPU Difficulty: ${diffLabel} · Specials unlock in 15s`
        );
      }
    },
    []
  );

  const handleSelectDifficulty = useCallback((level: DifficultyLevel) => {
    setDifficulty(level);
    difficultyRef.current = level;
    setCombatLog(
      `CPU Difficulty set to ${DIFFICULTY_CONFIGS[level].label} · ${DIFFICULTY_CONFIGS[level].description}`
    );
  }, []);

  const handleInstantUnlockSpecials = useCallback(() => {
    if (specialUnlockedRef.current) return;
    specialUnlockedRef.current = true;
    setSpecialUnlocked(true);
    setTimeRemaining(0);
    soundEngine.playSpecialUnlocked();
    setCombatLog('SPECIAL MOVES UNLOCKED · Press H for Spider-Man Web Blast!');
  }, []);

  // Keyboard Listeners: Player controls Spider-Man (WASD + F, G, H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysRef.current[normalizedKey] = true;
      keysRef.current[e.key] = true;

      if (e.repeat) return;

      // Quick rematch shortcut
      if (normalizedKey === 'r' && winnerRef.current) {
        handleResetMatch(true);
        return;
      }

      // Spider-Man (P1) Attacks: F (Punch), G (Kick / Jump Kick), H (Web Blast Special)
      if (normalizedKey === 'f') triggerAttack('p1', 'punch');
      if (normalizedKey === 'g') triggerAttack('p1', 'kick');
      if (normalizedKey === 'h') triggerAttack('p1', 'special');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysRef.current[normalizedKey] = false;
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerAttack, handleResetMatch]);

  // Main 60FPS Game Loop with 3-Tier CPU AI Engine
  useEffect(() => {
    let animationFrameId: number;

    const detectCollision = (attacker: FighterState, defender: FighterState) => {
      return (
        attacker.attackBox.x < defender.x + defender.width &&
        attacker.attackBox.x + attacker.attackBox.width > defender.x &&
        attacker.attackBox.y < defender.y + defender.height &&
        attacker.attackBox.y + attacker.attackBox.height > defender.y &&
        attacker.isAttacking
      );
    };

    const applyHitDamage = (
      attacker: FighterState,
      defender: FighterState,
      setDefenderHealth: React.Dispatch<React.SetStateAction<number>>
    ) => {
      const attackType = attacker.attackType;
      const damage =
        attackType === 'special' ? 20 : attackType === 'jumpKick' ? 15 : 5;

      defender.health = Math.max(0, defender.health - damage);
      defender.isAttacking = false; // Cancel defender's attack if hit
      defender.hitFlash = 8;
      attacker.isAttacking = false; // Only hit once per press
      attacker.totalDamageDealt += damage;
      if (attackType === 'special') attacker.specialCount += 1;

      // Knockback physics impulse
      defender.velocity.x = attacker.facing * (damage >= 15 ? 7 : 3);

      // Update combo tracking
      const now = performance.now();
      if (now - attacker.lastHitTime < 1800) {
        attacker.comboCount += 1;
      } else {
        attacker.comboCount = 1;
      }
      attacker.lastHitTime = now;

      setDefenderHealth(defender.health);
      soundEngine.playHit(damage);

      screenShakeRef.current = damage >= 20 ? 12 : damage >= 15 ? 7 : 3;

      const hitX = defender.x + defender.width / 2;
      const hitY = defender.y + 55;
      const sparkColor =
        attackType === 'special'
          ? '#10b981'
          : attackType === 'jumpKick'
          ? '#facc15'
          : attacker.id === 'p1'
          ? '#ef4444'
          : '#3b82f6';

      spawnHitParticles(hitX, hitY, sparkColor, damage >= 15 ? 24 : 12);

      const moveLabel =
        attackType === 'special'
          ? attacker.id === 'p1'
            ? 'WEB BLAST!'
            : 'SHIELD BASH!'
          : attackType === 'jumpKick'
          ? 'JUMP KICK!'
          : attackType === 'kick'
          ? 'KICK'
          : 'PUNCH';

      spawnFloatingText(
        hitX,
        defender.y - 8,
        `-${damage} ${moveLabel}`,
        sparkColor
      );

      setCombatLog(
        `${attacker.name} landed ${moveLabel} (-${damage} HP)${
          attacker.comboCount > 1 ? ` · ${attacker.comboCount}x COMBO` : ''
        }`
      );

      if (defender.health <= 0 && !winnerRef.current) {
        winnerRef.current = attacker.id;
        setWinner(attacker.id);
        setScore((prev) => ({
          ...prev,
          [attacker.id]: prev[attacker.id] + 1,
        }));
        soundEngine.playKO();
        setCombatLog(`K.O.! ${attacker.name} wins Round ${roundNumber}!`);
      }
    };

    const updateFighterPhysics = (fighter: FighterState) => {
      fighter.x += fighter.velocity.x;
      fighter.y += fighter.velocity.y;

      const groundY = CANVAS_HEIGHT - FLOOR_OFFSET - fighter.height;
      if (fighter.y >= groundY) {
        fighter.y = groundY;
        fighter.velocity.y = 0;
      } else {
        fighter.velocity.y += GRAVITY;
      }

      // Screen boundaries
      if (fighter.x < 0) fighter.x = 0;
      if (fighter.x + fighter.width > CANVAS_WIDTH) {
        fighter.x = CANVAS_WIDTH - fighter.width;
      }

      if (fighter.hitFlash > 0) fighter.hitFlash--;

      updateHitboxGeometry(fighter);
    };

    const runCaptainAmericaCPU = (
      p1: FighterState,
      p2: FighterState,
      frame: number
    ) => {
      if (winnerRef.current) {
        p2.velocity.x = 0;
        return;
      }

      const cfg = DIFFICULTY_CONFIGS[difficultyRef.current];
      const cpuMem = cpuStateRef.current;

      const dx = p1.x - p2.x;
      const absDist = Math.abs(dx);
      const dirToPlayer: 1 | -1 = dx >= 0 ? 1 : -1;
      p2.facing = dirToPlayer;

      // 1. Reactive Defensive Evasion (Medium & Difficult react when Spider-Man attacks)
      if (
        p1.isAttacking &&
        absDist < (p1.attackType === 'special' ? 270 : 135) &&
        p2.velocity.y === 0 &&
        frame % 10 === 0
      ) {
        if (Math.random() < cfg.evadePlayerAttackChance) {
          // Jump over Spider-Man's attack or dash back
          p2.velocity.y = -15;
          p2.velocity.x = -dirToPlayer * cfg.retreatSpeed;
          soundEngine.playJump();
          return;
        }
      }

      // 2. Special Move Execution (Shield Bash - 250px range, 20 damage)
      if (
        specialUnlockedRef.current &&
        absDist <= 240 &&
        absDist >= 55 &&
        frame - cpuMem.lastSpecialFrame >= cfg.specialReactionFrames &&
        frame - cpuMem.lastAttackFrame >= Math.floor(cfg.attackCooldownFrames * 0.7)
      ) {
        // Higher difficulty fires Shield Bash more decisively
        const specialChance =
          difficultyRef.current === 'difficult'
            ? 0.85
            : difficultyRef.current === 'medium'
            ? 0.45
            : 0.2;
        if (Math.random() < specialChance) {
          cpuMem.lastSpecialFrame = frame;
          cpuMem.lastAttackFrame = frame;
          triggerAttack('p2', 'special');
          return;
        }
      }

      // 3. Horizontal Footwork & Spacing
      if (absDist > cfg.aggressionRange) {
        // Advance toward Spider-Man
        p2.velocity.x = dirToPlayer * cfg.moveSpeed;
      } else if (absDist < 42) {
        // Too close: micro-space back to land clean hitbox
        p2.velocity.x = -dirToPlayer * cfg.retreatSpeed;
      } else {
        // In combat pocket: Difficult weaves in and out, Easy stands still more often
        if (difficultyRef.current === 'difficult') {
          if (frame > cpuMem.strafeUntilFrame) {
            cpuMem.strafeDir = Math.random() > 0.35 ? dirToPlayer : (-dirToPlayer as 1 | -1);
            cpuMem.strafeUntilFrame = frame + 16;
          }
          p2.velocity.x = cpuMem.strafeDir * (cfg.moveSpeed * 0.65);
        } else {
          p2.velocity.x = 0;
        }
      }

      // 4. Offensive Jumps & Aerial Jump Kicks (15 Damage)
      if (p2.velocity.y === 0 && absDist < 165 && absDist > 55 && frame % 45 === 0) {
        if (Math.random() < cfg.jumpChancePerCheck) {
          p2.velocity.y = -15;
          soundEngine.playJump();
        }
      }

      // If airborne near Spider-Man, execute Jump Kick (15 DMG)
      if (
        p2.velocity.y !== 0 &&
        absDist <= 125 &&
        frame - cpuMem.lastAttackFrame >= cfg.attackCooldownFrames
      ) {
        if (Math.random() < cfg.jumpKickChance) {
          cpuMem.lastAttackFrame = frame;
          triggerAttack('p2', 'kick'); // Automatically becomes jumpKick in air
          return;
        }
      }

      // 5. Ground Attacks: Punch (80px range) & Kick (100px range)
      if (
        absDist <= cfg.aggressionRange + 10 &&
        frame - cpuMem.lastAttackFrame >= cfg.attackCooldownFrames
      ) {
        cpuMem.lastAttackFrame = frame;
        // Choose kick at slightly longer range (80-105px), punch up close
        const attackChoice: 'punch' | 'kick' =
          absDist > 78 ? 'kick' : Math.random() > 0.45 ? 'punch' : 'kick';
        triggerAttack('p2', attackChoice);
      }
    };

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      frameCountRef.current += 1;
      const frame = frameCountRef.current;
      const p1 = p1Ref.current;
      const p2 = p2Ref.current;
      const keys = keysRef.current;

      // Player 1 Movement (Spider-Man: WASD or Arrow Keys)
      p1.velocity.x = 0;
      if (!winnerRef.current) {
        if (keys['a'] || keys['ArrowLeft']) {
          p1.velocity.x = -5;
          p1.facing = -1;
        } else if (keys['d'] || keys['ArrowRight']) {
          p1.velocity.x = 5;
          p1.facing = 1;
        }
        if ((keys['w'] || keys['ArrowUp']) && p1.velocity.y === 0) {
          p1.velocity.y = -15;
          soundEngine.playJump();
        }
      }

      // Player 2 Movement & Combat: Controlled by Computer / CPU
      runCaptainAmericaCPU(p1, p2, frame);

      // Apply Physics & Update Hitboxes
      updateFighterPhysics(p1);
      updateFighterPhysics(p2);

      // Collision Logic
      if (detectCollision(p1, p2) && p1.isAttacking) {
        applyHitDamage(p1, p2, setP2Health);
      }
      if (detectCollision(p2, p1) && p2.isAttacking) {
        applyHitDamage(p2, p1, setP1Health);
      }

      // Render Canvas Frame
      ctx.save();
      if (screenShakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(shakeX, shakeY);
        screenShakeRef.current *= 0.82;
        if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
      }

      drawArenaStage(
        ctx,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        frame,
        specialUnlockedRef.current
      );

      drawFighter(
        ctx,
        p1,
        showHitboxesRef.current,
        classicBlockRef.current,
        frame
      );
      drawFighter(
        ctx,
        p2,
        showHitboxesRef.current,
        classicBlockRef.current,
        frame
      );

      // Update & Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.18;
        pt.alpha -= pt.decay;
        if (pt.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Update & Draw Floating Combat Text
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.vy;
        ft.alpha -= 0.022;
        if (ft.alpha <= 0) {
          floatingTextsRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = '700 18px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#090d16';
        ctx.fillText(ft.text, ft.x + 1.5, ft.y + 1.5);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();
    };

    animationFrameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    roundNumber,
    spawnFloatingText,
    spawnHitParticles,
    triggerAttack,
    updateHitboxGeometry,
  ]);

  const getHealthStatusText = (hp: number) => {
    if (hp <= 0) return 'K.O.';
    if (hp <= 25) return 'CRITICAL';
    if (hp <= 55) return 'WOUNDED';
    return 'READY';
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="w-full max-w-[1200px] mx-auto flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80">
        <a
          href="#arena"
          className="font-display text-2xl font-bold tracking-wider text-white whitespace-nowrap shrink-0"
        >
          MARVEL CLASH
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => {
              const order: DifficultyLevel[] = ['easy', 'medium', 'difficult'];
              const next = order[(order.indexOf(difficulty) + 1) % order.length];
              handleSelectDifficulty(next);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            CPU Difficulty: {DIFFICULTY_CONFIGS[difficulty].label}
          </button>
          <button
            type="button"
            onClick={() => setShowHitboxes((prev) => !prev)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showHitboxes ? 'Hitboxes: Visible' : 'Hitboxes: Hidden'}
          </button>
          <button
            type="button"
            onClick={() => setClassicBlockMode((prev) => !prev)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {classicBlockMode ? 'Style: Classic Blocks' : 'Style: Hero Sprites'}
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {soundEnabled ? 'Audio: On' : 'Audio: Muted'}
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => handleResetMatch(false)}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset Match
          </button>
        </div>
      </header>

      {/* Main Arena Workspace */}
      <main
        id="arena"
        className="flex-1 w-full max-w-[1120px] mx-auto px-4 py-4 flex flex-col items-center"
      >
        {/* CPU Difficulty Selection Bar */}
        <div className="w-full max-w-[1024px] flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-800/70">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">
              Captain America CPU Difficulty:
            </span>
            <div
              role="group"
              aria-label="Select CPU Difficulty"
              className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg"
            >
              {(['easy', 'medium', 'difficult'] as DifficultyLevel[]).map((level) => {
                const active = difficulty === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleSelectDifficulty(level)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? level === 'easy'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : level === 'medium'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {DIFFICULTY_CONFIGS[level].label}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            {DIFFICULTY_CONFIGS[difficulty].description}
          </p>
        </div>

        {/* Fighter HUD Bar (#ui) */}
        <div
          id="ui"
          className="w-full max-w-[1024px] grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-6 mb-3"
        >
          {/* Player 1: Spider-Man (Controlled by You) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-display text-2xl font-bold tracking-wide text-white">
                  Spider-Man (You)
                </h2>
                <span className="text-xs text-slate-400 font-mono-tabular">
                  Wins: {score.p1}
                </span>
              </div>
              <span className="text-xs font-mono-tabular text-slate-300">
                {p1Health} / 100 HP · {getHealthStatusText(p1Health)}
              </span>
            </div>
            <div className="w-full h-7 bg-red-950/90 border border-slate-700 rounded-sm overflow-hidden p-0.5">
              <div
                id="p1-health"
                className="h-full bg-emerald-400 transition-all duration-100"
                style={{ width: `${p1Health}%` }}
              />
            </div>
          </div>

          {/* Center Round & Special Timer Status (#special-status) */}
          <div className="flex flex-col items-center justify-center px-3 pb-0.5 min-w-[240px]">
            <div className="text-xs text-slate-400 font-mono-tabular mb-1">
              Round {roundNumber} · CPU ({DIFFICULTY_CONFIGS[difficulty].label})
            </div>
            <div
              id="special-status"
              className={`font-display text-xl font-bold tracking-wide text-center transition-colors ${
                specialUnlocked ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {specialUnlocked ? (
                'SPECIAL MOVES UNLOCKED!'
              ) : (
                <>
                  Special Move Unlocks in{' '}
                  <span id="timer" className="font-mono-tabular">
                    {timeRemaining}
                  </span>
                  s
                </>
              )}
            </div>
          </div>

          {/* Player 2: Captain America (Computer / CPU) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono-tabular text-slate-300">
                {p2Health} / 100 HP · {getHealthStatusText(p2Health)}
              </span>
              <div className="flex items-baseline gap-2.5">
                <span className="text-xs text-slate-400 font-mono-tabular">
                  Wins: {score.p2}
                </span>
                <h2 className="font-display text-2xl font-bold tracking-wide text-white text-right">
                  Captain America (CPU · {DIFFICULTY_CONFIGS[difficulty].label})
                </h2>
              </div>
            </div>
            <div className="w-full h-7 bg-red-950/90 border border-slate-700 rounded-sm overflow-hidden p-0.5 flex justify-end">
              <div
                id="p2-health"
                className="h-full bg-emerald-400 transition-all duration-100"
                style={{ width: `${p2Health}%` }}
              />
            </div>
          </div>
        </div>

        {/* Game Canvas Container */}
        <div className="relative w-full max-w-[1024px] rounded-lg overflow-hidden border-2 border-slate-700 shadow-2xl bg-slate-900">
          <canvas
            ref={canvasRef}
            id="gameCanvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-auto block aspect-[16/9]"
          />

          {/* Victory / K.O. Overlay Modal */}
          {winner && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
              <p className="text-xs font-mono-tabular text-amber-400 mb-1">
                ROUND {roundNumber} COMPLETE · CPU DIFFICULTY:{' '}
                {DIFFICULTY_CONFIGS[difficulty].label.toUpperCase()}
              </p>
              <h1 className="font-display text-5xl font-bold tracking-wide text-white mb-2">
                {winner === 'p1'
                  ? 'VICTORY! SPIDER-MAN WINS!'
                  : 'DEFEAT! CAPTAIN AMERICA (CPU) WINS!'}
              </h1>
              <p className="text-sm text-slate-300 mb-5 font-mono-tabular">
                Your Damage Dealt: {p1Ref.current.totalDamageDealt} HP · CPU Damage Dealt:{' '}
                {p2Ref.current.totalDamageDealt} HP
              </p>

              {/* Change Difficulty for Next Round */}
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs text-slate-400">Next Round Difficulty:</span>
                {(['easy', 'medium', 'difficult'] as DifficultyLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      handleSelectDifficulty(level);
                      handleResetMatch(true, level);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      difficulty === level
                        ? 'bg-white text-slate-950 border-white'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    Play {DIFFICULTY_CONFIGS[level].label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleResetMatch(true)}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Next Round (Press R)
              </button>
            </div>
          )}
        </div>

        {/* Controls & Interactive Arcade Deck (.controls) */}
        <div className="w-full max-w-[1024px] mt-3.5 grid grid-cols-1 lg:grid-cols-[1.2fr_auto_1fr] items-center gap-4 border-t border-slate-800/80 pt-3.5 text-xs text-slate-300">
          {/* Your Spider-Man Controls & Quick Trigger Deck */}
          <div className="flex flex-col gap-2">
            <p className="text-slate-300">
              <strong className="text-white">Your Controls (Spider-Man):</strong> WASD or Arrows to
              move/jump · F: Punch (5) · G: Kick (5 / Air 15) · H: Web Blast (20)
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => triggerAttack('p1', 'punch')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                [F] Punch (5 DMG)
              </button>
              <button
                type="button"
                onClick={() => triggerAttack('p1', 'kick')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                [G] Kick / Jump Kick (5 / 15 DMG)
              </button>
              <button
                type="button"
                onClick={() => triggerAttack('p1', 'special')}
                disabled={!specialUnlocked}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  specialUnlocked
                    ? 'bg-red-600/90 hover:bg-red-500 text-white'
                    : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                [H] Web Blast {specialUnlocked ? '· 20 DMG' : `(${timeRemaining}s)`}
              </button>
            </div>
          </div>

          {/* Center Combat Feed & Special Unlock Helper */}
          <div className="flex flex-col items-center gap-1.5 px-3">
            <span className="font-mono-tabular text-xs text-slate-400 text-center">
              {combatLog}
            </span>
            {!specialUnlocked && (
              <button
                type="button"
                onClick={handleInstantUnlockSpecials}
                className="px-3 py-1 text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Unlock Specials Immediately
              </button>
            )}
          </div>

          {/* CPU Opponent Profile */}
          <div className="flex flex-col lg:items-end gap-1.5 text-slate-400 lg:text-right">
            <p className="text-slate-200 font-medium">
              CPU Opponent: Captain America ({DIFFICULTY_CONFIGS[difficulty].label})
            </p>
            <p className="font-mono-tabular text-xs">
              Speed: {DIFFICULTY_CONFIGS[difficulty].moveSpeed} · Evasion:{' '}
              {Math.round(DIFFICULTY_CONFIGS[difficulty].evadePlayerAttackChance * 100)}% · Shield
              Bash: {specialUnlocked ? 'ACTIVE (20 DMG)' : `Unlocks in ${timeRemaining}s`}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
