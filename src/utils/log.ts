import axios from 'axios';
import { DISCORD_WEBHOOK_URL, GLOBAL_CONFIG } from 'src/settings';
import util from 'util';

const COLORS = {
  DEBUG: '\x1b[34m',
  INFO: '\x1b[32m',
  SUCCESS: '\x1b[42m\x1b[37m',
  WARNING: '\x1b[33m',
  ERROR: '\x1b[31m',
  CRITICAL: '\x1b[41m\x1b[37m'
} as const;

type LogType = keyof typeof COLORS;

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function convertMarkdownBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, `${BOLD}$1${RESET}`);
}

function getFormattedDate(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `${yy}.${mm}.${dd} ${hh}:${min}:${ss}`;
}

class Logger {
  private log(logType: LogType, ...args: any[]) {
    const dateStr = getFormattedDate();
    const color = COLORS[logType];
    const padType = logType.padStart(8, ' '); // 왼쪽을 공백으로 채움
    const formattedArgs = util.format(...args); // 하나로 합침
    const terminalContent = `${BOLD}${color}${padType}:${RESET}   ${dateStr}   ${convertMarkdownBold(formattedArgs)}`;

    // 에러나 경고는 stderr 스트림으로 분리 출력
    if (logType === 'ERROR' || logType === 'CRITICAL' || logType === 'WARNING') {
      console.error(terminalContent);
    } else {
      console.log(terminalContent);
    }
  }

  public d(...args: any[]) {
    this.log('DEBUG', ...args);
  }

  public i(...args: any[]) {
    this.log('INFO', ...args);
  }

  public s(...args: any[]) {
    this.log('SUCCESS', ...args);
  }

  public w(...args: any[]) {
    this.log('WARNING', ...args);
  }

  public e(...args: any[]) {
    this.log('ERROR', ...args);
  }

  public c(...args: any[]) {
    this.log('CRITICAL', ...args);
  }
}

export const logger = new Logger();

export async function discordAlert(
  message: string,
  important = false,
  with_ai = false
) {
  if (!DISCORD_WEBHOOK_URL) {
    logger.w('DISCORD_WEBHOOK_URL is not defined. Discord alert will be skipped.');
    return;
  }

  let content = message;

  if (important) {
    const roleId = GLOBAL_CONFIG.discordAlertRoleID['backend'];
    if (roleId) {
      content = `<@&${roleId}>\n${message}`;
    }
  }

  if (with_ai) {
    const roleId_AI = GLOBAL_CONFIG.discordAlertRoleID['ai'];
    const roleId_backend = GLOBAL_CONFIG.discordAlertRoleID['backend'];
    if (roleId_AI && roleId_backend) {
      content = `<@&${roleId_AI}><@&${roleId_backend}>\n${message}`;
    }
  }

  try {
    await
      axios.post(DISCORD_WEBHOOK_URL, {
        content
      });
  } catch (error) {
    logger.e("discord webhook failed:", error);
  }
}