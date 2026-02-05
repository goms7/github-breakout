"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSVG = generateSVG;
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
 * 2. 파티클 지속시간 1초로 연장
 */
const PARTICLE_COUNT = 8; // 파편 개수 증가
const PARTICLE_RADIUS = 2; // 파편 크기 증가
const PARTICLE_DURATION = 1.0; // 0.5초에서 1.0초로 연장
const GITHUB_LIGHT = ["#ebedf0", "#fbc2eb", "#fa71cd", "#d83395", "#a61265"];
const GITHUB_DARK = ["#151B23", "#1a4a1a", "#2d7a2d", "#39b039", "#39ff14"];
function fetchGithubContributionsGraphQL(userName, githubToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `query($userName:String!){user(login: $userName){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionLevel contributionCount color}}}}}}`;
        const res = yield fetch("https://api.github.com/graphql", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `bearer ${githubToken}` }, body: JSON.stringify({ query, variables: { userName } }) });
        if (!res.ok)
            throw new Error(`GitHub API error: ${res.status}`);
        const json = yield res.json();
        const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
        const defaultColorPalette = { 0: "#000", 1: "#000", 2: "#000", 3: "#000", 4: "#000" };
        const levels = [];
        for (let c = 0; c < weeks.length; c++) {
            levels[c] = [];
            const days = weeks[c].contributionDays;
            for (let r = 0; r < days.length; r++) {
                const level = (days[r].contributionLevel === "FOURTH_QUARTILE" && 4) || (days[r].contributionLevel === "THIRD_QUARTILE" && 3) || (days[r].contributionLevel === "SECOND_QUARTILE" && 2) || (days[r].contributionLevel === "FIRST_QUARTILE" && 1) || 0;
                defaultColorPalette[level] = days[r].color;
                levels[c][r] = { level, contributionCount: days[r].contributionCount };
            }
        }
        return { days: levels, defaultColorPalette: Object.values(defaultColorPalette) };
    });
}
function circleRectCollision(cX, cY, cR, rX, rY, rW, rH) {
    const closestX = Math.max(rX, Math.min(cX, rX + rW));
    const closestY = Math.max(rY, Math.min(cY, rY + rH));
    const dx = cX - closestX;
    const dy = cY - closestY;
    return dx * dx + dy * dy <= cR * cR;
}
function simulate(bricks, canvasWidth, canvasHeight, paddleY, enableGhostBricks) {
    let ballX = canvasWidth / 2;
    let ballY = canvasHeight - 30;
    let ballVelocityX = BALL_SPEED * Math.cos(-Math.PI / 4);
    let ballVelocityY = BALL_SPEED * Math.sin(-Math.PI / 4);
    const simulatedBricks = bricks.map((b) => (Object.assign({}, b)));
    const frameHistory = [];
    let currentFrame = 0;
    while (simulatedBricks.some((b) => b.status === "visible" && (!enableGhostBricks || b.hasCommit)) && currentFrame < MAX_FRAMES) {
        let hitBrickIndex = -1;
        let paddleX = Math.max(PADDING, Math.min(canvasWidth - PADDING - PADDLE_WIDTH, ballX - PADDLE_WIDTH / 2));
        ballX += ballVelocityX;
        ballY += ballVelocityY;
        if (ballX > canvasWidth - PADDING - BALL_RADIUS || ballX < PADDING + BALL_RADIUS)
            ballVelocityX = -ballVelocityX;
        if (ballY < PADDING + BALL_RADIUS)
            ballVelocityY = -ballVelocityY;
        if (ballVelocityY > 0 && ballY + ballVelocityY + BALL_RADIUS >= paddleY && ballY + BALL_RADIUS <= paddleY) {
            ballVelocityY = -Math.abs(ballVelocityY);
            ballY = paddleY - BALL_RADIUS;
        }
        for (let i = 0; i < simulatedBricks.length; i++) {
            const brick = simulatedBricks[i];
            if (brick.status === "visible" && (!enableGhostBricks || brick.hasCommit) && circleRectCollision(ballX, ballY, BALL_RADIUS, brick.x, brick.y, BRICK_SIZE, BRICK_SIZE)) {
                ballVelocityY = -ballVelocityY;
                brick.status = "hidden";
                hitBrickIndex = i;
                break;
            }
        }
        frameHistory.push({ ballX, ballY, paddleX, bricks: simulatedBricks.map((b) => b.status), hitBrickIndex });
        currentFrame++;
    }
    return frameHistory;
}
function getAnimValues(arr) { return arr.map((v) => typeof v === 'number' ? v.toFixed(0) : String(v)).join(";"); }
function minifySVG(svg) { return svg.replace(/\s{2,}/g, " ").replace(/>\s+</g, "><").replace(/\n/g, ""); }
function generateSVG(username_1, githubToken_1) {
    return __awaiter(this, arguments, void 0, function* (username, githubToken, options = {}) {
        var _a, _b, _c, _d;
        const { enableGhostBricks = true, paddleColor = "#1F6FEB", ballColor = "#1F6FEB", bricksColors } = options;
        const colorDays = yield fetchGithubContributionsGraphQL(username, githubToken);
        const brickColumnCount = colorDays.days.length;
        const canvasWidth = brickColumnCount * (BRICK_SIZE + BRICK_GAP) + PADDING * 2 - BRICK_GAP;
        const bricksTotalHeight = 7 * (BRICK_SIZE + BRICK_GAP) - BRICK_GAP;
        const paddleY = PADDING + bricksTotalHeight + PADDLE_BRICK_GAP;
        const canvasHeight = paddleY + PADDLE_HEIGHT + PADDING;
        let colorPalette = colorDays.defaultColorPalette;
        if (bricksColors === "github_light")
            colorPalette = GITHUB_LIGHT;
        else if (bricksColors === "github_dark")
            colorPalette = GITHUB_DARK;
        else if (Array.isArray(bricksColors))
            colorPalette = bricksColors;
        const bricks = [];
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < 7; r++) {
                const day = (colorDays.days[c] && colorDays.days[c][r]) || null;
                if (!day)
                    continue;
                bricks.push({ x: c * (BRICK_SIZE + BRICK_GAP) + PADDING, y: r * (BRICK_SIZE + BRICK_GAP) + PADDING, colorClass: `c${day.level}`, status: "visible", hasCommit: day.contributionCount > 0 });
            }
        }
        const states = simulate(bricks, canvasWidth, canvasHeight, paddleY, enableGhostBricks);
        const animationDuration = states.length * SECONDS_PER_FRAME;
        // 1. 공 색상 애니메이션 생성 (충돌 시 빨간색)
        const ballFillValues = states.map(s => s.hitBrickIndex !== -1 ? "#ff0000" : ballColor);
        const style = `<style>${colorPalette.map((color, i) => `.c${i}{fill:${color}}`).join("")}</style>`;
        const brickSymbol = `<defs><symbol id="brick"><rect width="${BRICK_SIZE}" height="${BRICK_SIZE}" rx="${BRICK_RADIUS}"/></symbol></defs>`;
        let brickUses = "";
        let particles = "";
        bricks.forEach((brick, i) => {
            let hitFrame = states.findIndex(s => s.hitBrickIndex === i);
            if (hitFrame !== -1) {
                const tStart = hitFrame / (states.length - 1);
                const tEnd = Math.min(1, tStart + PARTICLE_DURATION / animationDuration);
                const origColor = colorPalette[parseInt(brick.colorClass.replace("c", ""))] || colorPalette[0];
                brickUses += `<use href="#brick" x="${brick.x}" y="${brick.y}" fill="${origColor}"><animate attributeName="fill" values="${origColor};${origColor};${colorPalette[0]};${colorPalette[0]}" keyTimes="0;${tStart.toFixed(4)};${tStart.toFixed(4)};1" dur="${animationDuration}s" repeatCount="indefinite"/></use>`;
                for (let j = 0; j < PARTICLE_COUNT; j++) {
                    const angle = (j * Math.PI * 2) / PARTICLE_COUNT;
                    const dx = Math.cos(angle) * 25;
                    const dy = Math.sin(angle) * 25;
                    particles += `<circle r="${PARTICLE_RADIUS}" fill="${origColor}" opacity="0">
          <animate attributeName="cx" values="${brick.x + BRICK_SIZE / 2};${brick.x + BRICK_SIZE / 2};${brick.x + BRICK_SIZE / 2 + dx}" keyTimes="0;${tStart.toFixed(4)};${tEnd.toFixed(4)}" dur="${animationDuration}s" repeatCount="indefinite"/>
          <animate attributeName="cy" values="${brick.y + BRICK_SIZE / 2};${brick.y + BRICK_SIZE / 2};${brick.y + BRICK_SIZE / 2 + dy}" keyTimes="0;${tStart.toFixed(4)};${tEnd.toFixed(4)}" dur="${animationDuration}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${tStart.toFixed(4)};${tStart.toFixed(4)};${tEnd.toFixed(4)};1" dur="${animationDuration}s" repeatCount="indefinite"/>
        </circle>`;
                }
            }
            else {
                brickUses += `<use href="#brick" x="${brick.x}" y="${brick.y}" class="${brick.colorClass}"/>`;
            }
        });
        const paddleRect = `<g transform="translate(0,${paddleY})"><rect width="${PADDLE_WIDTH}" height="${PADDLE_HEIGHT}" rx="${PADDLE_RADIUS}" fill="${paddleColor}"><animate attributeName="x" values="${getAnimValues(states.map(s => s.paddleX))}" dur="${animationDuration}s" repeatCount="indefinite"/></rect></g>`;
        // 공: 색상 애니메이션 적용 (초기값 포함)
        const ballCircle = `<circle r="${BALL_RADIUS}" cx="${(_b = (_a = states[0]) === null || _a === void 0 ? void 0 : _a.ballX) !== null && _b !== void 0 ? _b : canvasWidth / 2}" cy="${(_d = (_c = states[0]) === null || _c === void 0 ? void 0 : _c.ballY) !== null && _d !== void 0 ? _d : canvasHeight - 30}" fill="${ballColor}">
    <animate attributeName="fill" values="${getAnimValues(ballFillValues)}" dur="${animationDuration}s" repeatCount="indefinite"/>
    <animate attributeName="cx" values="${getAnimValues(states.map(s => s.ballX))}" dur="${animationDuration}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${getAnimValues(states.map(s => s.ballY))}" dur="${animationDuration}s" repeatCount="indefinite"/>
  </circle>`;
        return minifySVG(`<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">${style}${brickSymbol}${brickUses}${particles}${paddleRect}${ballCircle}</svg>`);
    });
}
