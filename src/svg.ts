// Configuration
const PADDING = 15;
const PADDLE_WIDTH = 75;
const PADDLE_HEIGHT = 10;
const PADDLE_RADIUS = 5;
const PADDLE_BRICK_GAP = 100;
const BALL_RADIUS = 8;
const BRICK_SIZE = 12;
const BRICK_GAP = 3;
const BRICK_RADIUS = 3;
const ANIMATE_STEP = 1;
const SECONDS_PER_FRAME = 1 / 30;
const MAX_FRAMES = 30000;
const BALL_SPEED = 10;

export type ColorPalette = [string, string, string, string, string];

const GITHUB_LIGHT: ColorPalette = ["#f0f0f0", "#ffb7ff", "#ff77ff", "#ff00ff", "#a100a1"];
const GITHUB_DARK: ColorPalette = ["#1a1a1b", "#4a004a", "#7b007b", "#b900b9", "#ff00ff"];

export interface Options {
  enableGhostBricks?: boolean;
  paddleColor?: string;
  ballColor?: string;
  bricksColors?: "github_light" | "github_dark" | ColorPalette;
}

type BrickStatus = "visible" | "hidden";

interface Brick {
  x: number;
  y: number;
  status: BrickStatus;
  colorClass: string;
  hasCommit?: boolean;
}

type FrameState = {
  ballX: number;
  ballY: number;
  paddleX: number;
  bricks: BrickStatus[];
};

interface GitHubContributionDay {
  level: 0 | 1 | 2 | 3 | 4;
  contributionCount: number;
}

interface GithubContributionResponse {
  days: (GitHubContributionDay | null)[][];
  defaultColorPalette: ColorPalette;
}

// --- Utility & Simulation Functions ---

function circleRectCollision(cX: number, cY: number, cR: number, rX: number, rY: number, rW: number, rH: number): boolean {
  const closestX = Math.max(rX, Math.min(cX, rX + rW));
  const closestY = Math.max(rY, Math.min(cY, rY + rH));
  const dx = cX - closestX;
  const dy = cY - closestY;
  return dx * dx + dy * dy <= cR * cR;
}

function simulate(bricks: Brick[], canvasWidth: number, canvasHeight: number, paddleY: number, enableGhostBricks: boolean): FrameState[] {
  let ballX = canvasWidth / 2;
  let ballY = canvasHeight - 30;
  let launchAngle = -Math.PI / 4;
  let ballVelocityX = BALL_SPEED * Math.cos(launchAngle);
  let ballVelocityY = BALL_SPEED * Math.sin(launchAngle);

  const simulatedBricks: Brick[] = bricks.map((brick) => ({ ...brick }));
  const frameHistory: FrameState[] = [];
  let currentFrame = 0;
  let paddlePositionX = (canvasWidth - PADDLE_WIDTH) / 2;

  while (simulatedBricks.some((brick) => brick.status === "visible" && (!enableGhostBricks || brick.hasCommit)) && currentFrame < MAX_FRAMES) {
    paddlePositionX = Math.max(PADDING, Math.min(canvasWidth - PADDING - PADDLE_WIDTH, ballX - PADDLE_WIDTH / 2));
    ballX += ballVelocityX;
    ballY += ballVelocityY;

    if (ballX + ballVelocityX > canvasWidth - PADDING - BALL_RADIUS || ballX + ballVelocityX < PADDING + BALL_RADIUS) ballVelocityX = -ballVelocityX;
    if (ballY + ballVelocityY < PADDING + BALL_RADIUS) ballVelocityY = -ballVelocityY;

    if (ballVelocityY > 0 && ballY + ballVelocityY + BALL_RADIUS >= paddleY && ballY + BALL_RADIUS <= paddleY) {
      ballVelocityY = -Math.abs(ballVelocityY);
      ballY = paddleY - BALL_RADIUS;
    }

    for (let i = 0; i < simulatedBricks.length; i++) {
      const brick = simulatedBricks[i];
      if (brick.status === "visible" && (!enableGhostBricks || brick.hasCommit) && circleRectCollision(ballX, ballY, BALL_RADIUS, brick.x, brick.y, BRICK_SIZE, BRICK_SIZE)) {
        ballVelocityY = -ballVelocityY;
        brick.status = "hidden";
        break;
      }
    }
    
    if (currentFrame % ANIMATE_STEP === 0) {
      frameHistory.push({ ballX, ballY, paddleX: paddlePositionX, bricks: simulatedBricks.map((b) => b.status) });
    }
    currentFrame++;
  }
  return frameHistory;
}

// --- SVG Generation ---

export async function generateSVG(username: string, githubToken: string, options: Options = {}): Promise<string> {
  const { enableGhostBricks = true, paddleColor = "#1F6FEB", ballColor = "#1F6FEB", bricksColors } = options;
  
  // 가상의 데이터 fetch 로직 (실제 환경에 맞게 fetchGithubContributionsGraphQL 호출 필요)
  // 여기서는 구조 유지를 위해 이전 코드의 데이터 처리 흐름을 따릅니다.
  const colorDays = await fetchGithubContributionsGraphQL(username, githubToken); 

  const brickColumnCount = colorDays.days.length;
  const canvasWidth = brickColumnCount * (BRICK_SIZE + BRICK_GAP) + PADDING * 2 - BRICK_GAP;
  const bricksTotalHeight = 7 * (BRICK_SIZE + BRICK_GAP) - BRICK_GAP;
  const paddleY = PADDING + bricksTotalHeight + PADDLE_BRICK_GAP;
  const canvasHeight = paddleY + PADDLE_HEIGHT + PADDING;

  let colorPalette: ColorPalette = colorDays.defaultColorPalette;
  if (bricksColors === "github_light") colorPalette = GITHUB_LIGHT;
  else if (bricksColors === "github_dark") colorPalette = GITHUB_DARK;
  else if (Array.isArray(bricksColors)) colorPalette = bricksColors;

  const bricks: Brick[] = [];
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < 7; r++) {
      const day = (colorDays.days[c] && colorDays.days[c][r]) || null;
      if (!day) continue;
      bricks.push({
        x: c * (BRICK_SIZE + BRICK_GAP) + PADDING,
        y: r * (BRICK_SIZE + BRICK_GAP) + PADDING,
        colorClass: `c${day.level}`,
        status: "visible",
        hasCommit: day.contributionCount > 0,
      });
    }
  }

  const states = simulate(bricks, canvasWidth, canvasHeight, paddleY, enableGhostBricks);
  const animationDuration = states.length * SECONDS_PER_FRAME;

  const brickAnimData = bricks.map((b, i) => {
    let firstZero = -1;
    for (let f = 0; f < states.length; ++f) {
      if (states[f].bricks[i] !== "visible") { firstZero = f; break; }
    }
    return { animate: firstZero !== -1, firstZero };
  });

  const style = `<style>${colorPalette.map((color, i) => `.c${i}{fill:${color}}`).join("")}</style>`;
  const brickSymbol = `<defs><symbol id="brick"><rect width="${BRICK_SIZE}" height="${BRICK_SIZE}" rx="${BRICK_RADIUS}"/></symbol></defs>`;

  const brickUses = bricks.map((brick, i) => {
    const anim = brickAnimData[i];
    if (!anim.animate) return `<use href="#brick" x="${brick.x}" y="${brick.y}" class="${brick.colorClass}" />`;

    const t = anim.firstZero / (states.length - 1);
    const tStr = t.toFixed(4);
    const pDur = 0.5; // 파티클 지속 시간 (초)
    let tEnd = t + (pDur / animationDuration);
    if (tEnd > 1) tEnd = 1;
    const tEndStr = tEnd.toFixed(4);

    let elements = "";
    // 1. 벽돌 애니메이션
    const origColor = colorPalette[parseInt(brick.colorClass.replace('c', ''))] || colorPalette[0];
    elements += `<use href="#brick" x="${brick.x}" y="${brick.y}" fill="${origColor}">
      <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${tStr};${tStr};1" dur="${animationDuration}s" repeatCount="indefinite"/>
    </use>`;

    // 2. 파티클 애니메이션 (안전한 keyTimes 적용)
    const dirs = [[-1,-1], [1,-1], [-1,1], [1,1]];
    dirs.forEach(([dx, dy]) => {
      elements += `<rect x="${brick.x + 4}" y="${brick.y + 4}" width="3" height="3" fill="orange" opacity="0">
        <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${tStr};${tStr};${tEndStr};1" dur="${animationDuration}s" repeatCount="indefinite" />
        <animate attributeName="x" values="${brick.x+4};${brick.x+4};${brick.x+4+dx*20};${brick.x+4+dx*20}" keyTimes="0;${tStr};${tEndStr};1" dur="${animationDuration}s" repeatCount="indefinite" />
        <animate attributeName="y" values="${brick.y+4};${brick.y+4};${brick.y+4+dy*20};${brick.y+4+dy*20}" keyTimes="0;${tStr};${tEndStr};1" dur="${animationDuration}s" repeatCount="indefinite" />
      </rect>`;
    });
    return elements;
  }).join("");

  const paddleRect = `<rect x="0" y="${paddleY}" width="${PADDLE_WIDTH}" height="${PADDLE_HEIGHT}" rx="${PADDLE_RADIUS}" fill="${paddleColor}">
    <animate attributeName="x" values="${states.map(s => s.paddleX.toFixed(0)).join(";")}" dur="${animationDuration}s" repeatCount="indefinite"/>
  </rect>`;

  const ballCircle = `<circle r="${BALL_RADIUS}" fill="${ballColor}">
    <animate attributeName="cx" values="${states.map(s => s.ballX.toFixed(0)).join(";")}" dur="${animationDuration}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${states.map(s => s.ballY.toFixed(0)).join(";")}" dur="${animationDuration}s" repeatCount="indefinite"/>
  </circle>`;

  return `<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">${style}${brickSymbol}${brickUses}${paddleRect}${ballCircle}</svg>`.replace(/\s{2,}/g, " ");
}
