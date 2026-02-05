// Configuration
const PADDING = 15; // Padding around the canvas in pixels

const PADDLE_WIDTH = 75; // Paddle width in pixels
const PADDLE_HEIGHT = 10; // Paddle height in pixels
const PADDLE_RADIUS = 5; // Paddle corner radius in pixels
const PADDLE_BRICK_GAP = 100; // Gap between the last row of bricks and the paddle in pixels

const BALL_RADIUS = 8; // Ball radius in pixels

const BRICK_SIZE = 12; // Brick size in pixels
const BRICK_GAP = 3; // Gap between bricks in pixels
const BRICK_RADIUS = 3; // Radius for rounded corners of bricks

const ANIMATE_STEP = 1; // Step size for animation frames
const SECONDS_PER_FRAME = 1 / 30; // Duration of each frame in seconds (30 FPS)
const MAX_FRAMES = 30000; // Maximum number of frames to simulate
const BALL_SPEED = 10; // Speed of the ball in pixels per frame

export type ColorPalette = [string, string, string, string, string];

// GitHub colors
const GITHUB_LIGHT: ColorPalette = [
  "#ebedf0",
  "#9be9a8",
  "#40c463",
  "#30a14e",
  "#216e39",
];
const GITHUB_DARK: ColorPalette = [
  "#151B23",
  "#033A16",
  "#196C2E",
  "#2EA043",
  "#56D364",
];

// Options for the SVG generation
export interface Options {
  enableGhostBricks?: boolean;
  paddleColor?: string;
  ballColor?: string;
  bricksColors?: "github_light" | "github_dark" | ColorPalette;
}

type BrickStatus = "visible" | "hidden";

// Brick interface
interface Brick {
  x: number; // Brick x position
  y: number; // Brick y position
  status: BrickStatus; // Brick visibility status
  colorClass: string; // CSS class for color
  hasCommit?: boolean; // Indicates if this brick has commit or is empty
}

// One frame of the simulation state
type FrameState = {
  ballX: number; // Ball x position
  ballY: number; // Ball y position
  paddleX: number; // Paddle x position
  bricks: BrickStatus[]; // Array of brick statuses (visible or hidden)
};

// Interface for GitHub Contribution Graph
interface GitHubContributionDay {
  level: 0 | 1 | 2 | 3 | 4;
  contributionCount: number;
}

// Interface for GitHub Contribution Response
interface GithubContributionResponse {
  days: (GitHubContributionDay | null)[][];
  defaultColorPalette: ColorPalette;
}

/**
 * Fetches the GitHub contributions calendar for a user using the GraphQL API.
 */
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
    body: JSON.stringify({
      query,
      variables: { userName },
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error("GitHub GraphQL error: " + JSON.stringify(json.errors));
  }

  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  const defaultColorPalette: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "#000", 1: "#000", 2: "#000", 3: "#000", 4: "#000",
  };
  const levels: (GitHubContributionDay | null)[][] = [];
  for (let c = 0; c < weeks.length; c++) {
    levels[c] = [];
    const days = weeks[c].contributionDays;
    for (let r = 0; r < days.length; r++) {
      const level =
        (days[r].contributionLevel === "FOURTH_QUARTILE" && 4) ||
        (days[r].contributionLevel === "THIRD_QUARTILE" && 3) ||
        (days[r].contributionLevel === "SECOND_QUARTILE" && 2) ||
        (days[r].contributionLevel === "FIRST_QUARTILE" && 1) ||
        0;

      defaultColorPalette[level] = days[r].color;
      levels[c][r] = {
        level,
        contributionCount: days[r].contributionCount,
      };
    }
  }
  return {
    days: levels,
    defaultColorPalette: Object.values(defaultColorPalette) as ColorPalette,
  };
}

function circleRectCollision(
  circleX: number, circleY: number, circleRadius: number,
  rectX: number, rectY: number, rectWidth: number, rectHeight: number,
): boolean {
  const closestX = Math.max(rectX, Math.min(circleX, rectX + rectWidth));
  const closestY = Math.max(rectY, Math.min(circleY, rectY + rectHeight));
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  return dx * dx + dy * dy <= circleRadius * circleRadius;
}

function simulate(
  bricks: Brick[], canvasWidth: number, canvasHeight: number,
  paddleY: number, enableGhostBricks: boolean,
): FrameState[] {
  let ballX = canvasWidth / 2;
  let ballY = canvasHeight - 30;
  let launchAngle = -Math.PI / 4;
  let ballVelocityX = BALL_SPEED * Math.cos(launchAngle);
  let ballVelocityY = BALL_SPEED * Math.sin(launchAngle);

  const simulatedBricks: Brick[] = bricks.map((brick) => ({ ...brick }));
  const frameHistory: FrameState[] = [];
  let currentFrame = 0;
  let paddlePositionX = (canvasWidth - PADDLE_WIDTH) / 2;

  while (
    simulatedBricks.some((brick) => brick.status === "visible" && (!enableGhostBricks || brick.hasCommit)) &&
    currentFrame < MAX_FRAMES
  ) {
    paddlePositionX = Math.max(PADDING, Math.min(canvasWidth - PADDING - PADDLE_WIDTH, ballX - PADDLE_WIDTH / 2));
    ballX += ballVelocityX;
    ballY += ballVelocityY;

    if (ballX + ballVelocityX > canvasWidth - PADDING - BALL_RADIUS || ballX + ballVelocityX < PADDING + BALL_RADIUS) {
      ballVelocityX = -ballVelocityX;
    }
    if (ballY + ballVelocityY < PADDING + BALL_RADIUS) {
      ballVelocityY = -ballVelocityY;
    }

    if (ballVelocityY > 0 && ballY + ballVelocityY + BALL_RADIUS >= paddleY && ballY + BALL_RADIUS <= paddleY) {
      ballVelocityY = -Math.abs(ballVelocityY);
      ballY = paddleY - BALL_RADIUS;
    }

    for (let i = 0; i < simulatedBricks.length; i++) {
      const brick = simulatedBricks[i];
      if (brick.status === "visible" && (!enableGhostBricks || brick.hasCommit) &&
          circleRectCollision(ballX, ballY, BALL_RADIUS, brick.x, brick.y, BRICK_SIZE, BRICK_SIZE)) {
        ballVelocityY = -ballVelocityY;
        brick.status = "hidden";
        break;
      }
    }

    ballX = Math.max(PADDING + BALL_RADIUS, Math.min(canvasWidth - PADDING - BALL_RADIUS, ballX));
    ballY = Math.max(PADDING + BALL_RADIUS, Math.min(canvasHeight - PADDING - BALL_RADIUS, ballY));

    if (currentFrame % ANIMATE_STEP === 0) {
      frameHistory.push({ ballX, ballY, paddleX: paddlePositionX, bricks: simulatedBricks.map((b) => b.status) });
    }
    currentFrame++;
  }
  return frameHistory;
}

function getAnimValues(arr: number[]): string {
  return arr.map((v) => v.toFixed(0)).join(";");
}

function minifySVG(svg: string): string {
  return svg.replace(/\s{2,}/g, " ").replace(/>\s+</g, "><").replace(/\n/g, "");
}

export async function generateSVG(
  username: string,
  githubToken: string,
  options: Options = {},
): Promise<string> {
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
  const animationDuration = states.length * SECONDS_PER_FRAME * ANIMATE_STEP;

  const ballX = states.map((s) => s.ballX);
  const ballY = states.map((s) => s.ballY);
  const paddleX = states.map((s) => s.paddleX);

  const brickAnimData = bricks.map((b, i) => {
    let firstZero = -1;
    for (let f = 0; f < states.length; ++f) {
      if (states[f].bricks[i] !== "visible") {
        firstZero = f;
        break;
      }
    }
    if (firstZero === -1) return { animate: false, opacity: 1, firstZero: -1 };
    const t = firstZero / (states.length - 1);
    return { animate: true, keyTimes: `0;${t.toFixed(4)};${t.toFixed(4)};1`, values: "1;1;0;0", firstZero };
  });

  const style = `<style>${colorPalette.map((color, i) => `.c${i}{fill:${color}}`).join("")}</style>`;
  const brickSymbol = `<defs><symbol id="brick"><rect x="0" y="0" width="${BRICK_SIZE}" height="${BRICK_SIZE}" rx="${BRICK_RADIUS}"/></symbol></defs>`;

  const brickUses = bricks.map((brick, i) => {
    const anim = brickAnimData[i];
    const t = anim.firstZero / (states.length - 1);
    const tStr = t.toFixed(4);
    const particleDuration = 0.5; // 파티클 지속 시간 (초)
    const tEndStr = (t + (particleDuration / animationDuration)).toFixed(4);
    let elements = "";

    // 1. 기본 벽돌 로직
    if (enableGhostBricks && anim.animate) {
      const origColor = colorPalette[parseInt(brick.colorClass.replace('c', ''))] || colorPalette[0];
      elements += `<use href="#brick" x="${brick.x}" y="${brick.y}" fill="${origColor}">
        <animate attributeName="fill" values="${origColor};${origColor};${colorPalette[0]};${colorPalette[0]}"
          keyTimes="0;${tStr};${tStr};1" dur="${animationDuration}s" fill="freeze" repeatCount="indefinite"/>
      </use>`;
    } else if (anim.animate) {
      elements += `<use href="#brick" x="${brick.x}" y="${brick.y}" class="${brick.colorClass}">
        <animate attributeName="opacity" values="${anim.values}" keyTimes="${anim.keyTimes}" dur="${animationDuration}s" fill="freeze" repeatCount="indefinite"/>
      </use>`;
    } else {
      elements += `<use href="#brick" x="${brick.x}" y="${brick.y}" class="${brick.colorClass}" />`;
    }

    // 2. [추가된 파티클 로직] 벽돌이 깨질 때 4방향으로 입자가 튐
    if (anim.animate) {
      const pSize = 3;
      const dirs = [[-1,-1], [1,-1], [-1,1], [1,1]]; // 대각선 방향들
      dirs.forEach(([dx, dy]) => {
        elements += `<rect x="${brick.x + 4}" y="${brick.y + 4}" width="${pSize}" height="${pSize}" fill="orange" opacity="0">
          <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${tStr};${tStr};${tEndStr};1" dur="${animationDuration}s" repeatCount="indefinite" />
          <animate attributeName="x" values="${brick.x+4};${brick.x+4};${brick.x+4+dx*15};${brick.x+4+dx*15}" keyTimes="0;${tStr};${tEndStr};1" dur="${animationDuration}s" repeatCount="indefinite" />
          <animate attributeName="y" values="${brick.y+4};${brick.y+4};${brick.y+4+dy*15};${brick.y+4+dy*15}" keyTimes="0;${tStr};${tEndStr};1" dur="${animationDuration}s" repeatCount="indefinite" />
        </rect>`;
      });
    }

    return elements;
  }).join("");

  const paddleRect = `<g transform="translate(0,${paddleY})">
    <rect y="0" width="${PADDLE_WIDTH}" height="${PADDLE_HEIGHT}" rx="${PADDLE_RADIUS}" fill="${paddleColor}">
      <animate attributeName="x" values="${getAnimValues(paddleX)}" dur="${animationDuration}s" repeatCount="indefinite"/>
    </rect>
  </g>`;

  const ballCircle = `<circle r="${BALL_RADIUS}" fill="${ballColor}">
    <animate attributeName="cx" values="${getAnimValues(ballX)}" dur="${animationDuration}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${getAnimValues(ballY)}" dur="${animationDuration}s" repeatCount="indefinite"/>
  </circle>`;

  const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    ${style}${brickSymbol}${brickUses}${paddleRect}${ballCircle}
  </svg>`.trim();

  return minifySVG(svg);
}
