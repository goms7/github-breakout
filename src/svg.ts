/**
 * Configuration & Constants
 */
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

/**
 * Particle Settings
 */
const PARTICLE_COUNT = 5;      
const PARTICLE_RADIUS = 1.5;   
const PARTICLE_DURATION = 0.5; 

export type ColorPalette = [string, string, string, string, string];

const GITHUB_LIGHT: ColorPalette = [
  "#ebedf0", 
  "#fbc2eb",
  "#fa71cd", 
  "#d83395", 
  "#a61265", 
];

// GITHUB_DARK: 어두운 모드용 (네온 핑크 테마)
const GITHUB_DARK: ColorPalette = [
  "#151B23",
  "#4a004a", 
  "#7b007b", 
  "#b900b9",
  "#ff00ff", 
];

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

async function fetchGithubContributionsGraphQL(
  userName: string,
  githubToken: string,
): Promise<GithubContributionResponse> {
  const query = `
    query($userName:String!) {
      user(login: $userName){
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionLevel
                contributionCount
                color
              }
            }
          }
        }
      }
    }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `bearer ${githubToken}`,
    },
    body: JSON.stringify({ query, variables: { userName } }),
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  const json = await res.json();
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  const defaultColorPalette: Record<0 | 1 | 2 | 3 | 4, string> = { 0: "#000", 1: "#000", 2: "#000", 3: "#000", 4: "#000" };
  const levels: (GitHubContributionDay | null)[][] = [];

  for (let c = 0; c < weeks.length; c++) {
    levels[c] = [];
    const days = weeks[c].contributionDays;
    for (let r = 0; r < days.length; r++) {
      const level =
        (days[r].contributionLevel === "FOURTH_QUARTILE" && 4) ||
        (days[r].contributionLevel === "THIRD_QUARTILE" && 3) ||
        (days[r].contributionLevel === "SECOND_QUARTILE" && 2) ||
        (days[r].contributionLevel === "FIRST_QUARTILE" && 1) || 0;

      defaultColorPalette[level] = days[r].color;
      levels[c][r] = { level, contributionCount: days[r].contributionCount };
    }
  }
  return {
    days: levels,
    defaultColorPalette: Object.values(defaultColorPalette) as ColorPalette,
  };
}

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
  let ballVelocityX = BALL_SPEED * Math.cos(-Math.PI / 4);
  let ballVelocityY = BALL_SPEED * Math.sin(-Math.PI / 4);
  const simulatedBricks: Brick[] = bricks.map((brick) => ({ ...brick }));
  const frameHistory: FrameState[] = [];
  let currentFrame = 0;
  let paddleX = (canvasWidth - PADDLE_WIDTH) / 2;

  while (simulatedBricks.some((b) => b.status === "visible" && (!enableGhostBricks || b.hasCommit)) && currentFrame < MAX_FRAMES) {
    paddleX = Math.max(PADDING, Math.min(canvasWidth - PADDING - PADDLE_WIDTH, ballX - PADDLE_WIDTH / 2));
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
      frameHistory.push({ ballX, ballY, paddleX, bricks: simulatedBricks.map((b) => b.status) });
    }
    currentFrame++;
  }
  return frameHistory;
}

function getAnimValues(arr: number[]): string { return arr.map((v) => v.toFixed(0)).join(";"); }
function minifySVG(svg: string): string { return svg.replace(/\s{2,}/g, " ").replace(/>\s+</g, "><").replace(/\n/g, ""); }

export async function generateSVG(username: string, githubToken: string, options: Options = {}): Promise<string> {
  const { enableGhostBricks = true, paddleColor = "#1F6FEB", ballColor = "#1F6FEB", bricksColors } = options;
  const colorDays = await fetchGithubContributionsGraphQL(username, githubToken);
  const brickColumnCount = colorDays.days.length;
  const canvasWidth = brickColumnCount * (BRICK_SIZE + BRICK_GAP) + PADDING * 2 - BRICK_GAP;
  const bricksTotalHeight = 7 * (BRICK_SIZE + BRICK_GAP) - BRICK_GAP;
  const paddleY = PADDING + bricksTotalHeight + PADDLE_BRICK_GAP;
  const canvasHeight = paddleY + PADDLE_HEIGHT + PADDING;

  let colorPalette: ColorPalette = colorDays.defaultColorPalette;
  if (bricksColors === "github_light") colorPalette = GITHUB_LIGHT;
  else if (bricksColors === "github_dark") colorPalette = GITHUB_DARK;
  else if (Array.isArray(bricksColors) && bricksColors.length === 5) colorPalette = bricksColors as ColorPalette;

  const bricks: Brick[] = [];
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < 7; r++) {
      const day = (colorDays.days[c] && colorDays.days[c][r]) || null;
      if (!day) continue;
      bricks.push({ x: c * (BRICK_SIZE + BRICK_GAP) + PADDING, y: r * (BRICK_SIZE + BRICK_GAP) + PADDING, colorClass: `c${day.level}`, status: "visible", hasCommit: day.contributionCount > 0 });
    }
  }

  const states = simulate(bricks, canvasWidth, canvasHeight, paddleY, enableGhostBricks);
  const animationDuration = states.length * SECONDS_PER_FRAME * ANIMATE_STEP;

  const brickAnimData = bricks.map((b, i) => {
    let firstZero = -1;
    for (let f = 0; f < states.length; ++f) {
      if (states[f].bricks[i] !== "visible") { firstZero = f; break; }
    }
    if (firstZero === -1) return { animate: false, firstZero: undefined };
    const t = firstZero / (states.length - 1);
    return { animate: true, keyTimes: `0;${t.toFixed(4)};${t.toFixed(4)};1`, values: "1;1;0;0", firstZero };
  });

  const style = `<style>${colorPalette.map((color, i) => `.c${i}{fill:${color}}`).join("")}</style>`;
  const brickSymbol = `<defs><symbol id="brick"><rect width="${BRICK_SIZE}" height="${BRICK_SIZE}" rx="${BRICK_RADIUS}"/></symbol></defs>`;

  let brickUses = "";
  let particles = "";

  bricks.forEach((brick, i) => {
    const anim = brickAnimData[i];
    const levelIdx = parseInt(brick.colorClass.replace("c", ""));
    const origColor = colorPalette[levelIdx] || colorPalette[0];

    // ✅ 에러 해결 포인트: 'anim.animate'와 'anim.firstZero'가 확실히 있을 때만 실행하도록 체크
    if (anim.animate && typeof anim.firstZero === 'number') {
      const tStart = anim.firstZero / (states.length - 1);
      const tEnd = Math.min(1, tStart + PARTICLE_DURATION / animationDuration);

      if (enableGhostBricks) {
        brickUses += `<use href="#brick" x="${brick.x}" y="${brick.y}" fill="${origColor}"><animate attributeName="fill" values="${origColor};${origColor};${colorPalette[0]};${colorPalette[0]}" keyTimes="0;${tStart.toFixed(4)};${tStart.toFixed(4)};1" dur="${animationDuration}s" repeatCount="indefinite"/></use>`;
      } else {
        brickUses += `<use href="#brick" x="${brick.x}" y="${brick.y}" class="${brick.colorClass}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${tStart.toFixed(4)};${tStart.toFixed(4)};1" dur="${animationDuration}s" repeatCount="indefinite"/></use>`;
      }

      for (let j = 0; j < PARTICLE_COUNT; j++) {
        const angle = (j * Math.PI * 2) / PARTICLE_COUNT;
        const dx = Math.cos(angle) * 15;
        const dy = Math.sin(angle) * 15;
        particles += `<circle r="${PARTICLE_RADIUS}" fill="${origColor}" opacity="0">
          <animate attributeName="cx" values="${brick.x + BRICK_SIZE/2};${brick.x + BRICK_SIZE/2};${brick.x + BRICK_SIZE/2 + dx}" keyTimes="0;${tStart.toFixed(4)};${tEnd.toFixed(4)}" dur="${animationDuration}s" repeatCount="indefinite"/>
          <animate attributeName="cy" values="${brick.y + BRICK_SIZE/2};${brick.y + BRICK_SIZE/2};${brick.y + BRICK_SIZE/2 + dy}" keyTimes="0;${tStart.toFixed(4)};${tEnd.toFixed(4)}" dur="${animationDuration}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${tStart.toFixed(4)};${tStart.toFixed(4)};${tEnd.toFixed(4)};1" dur="${animationDuration}s" repeatCount="indefinite"/>
        </circle>`;
      }
    } else {
      brickUses += `<use href="#brick" x="${brick.x}" y="${brick.y}" class="${brick.colorClass}"/>`;
    }
  });

  const paddleRect = `<g transform="translate(0,${paddleY})"><rect width="${PADDLE_WIDTH}" height="${PADDLE_HEIGHT}" rx="${PADDLE_RADIUS}" fill="${paddleColor}"><animate attributeName="x" values="${getAnimValues(states.map(s => s.paddleX))}" dur="${animationDuration}s" repeatCount="indefinite"/></rect></g>`;
  const ballCircle = `<circle r="${BALL_RADIUS}" fill="${ballColor}"><animate attributeName="cx" values="${getAnimValues(states.map(s => s.ballX))}" dur="${animationDuration}s" repeatCount="indefinite"/><animate attributeName="cy" values="${getAnimValues(states.map(s => s.ballY))}" dur="${animationDuration}s" repeatCount="indefinite"/></circle>`;

  return minifySVG(`<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">${style}${brickSymbol}${brickUses}${particles}${paddleRect}${ballCircle}</svg>`);
}
