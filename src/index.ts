import { createApp } from 'src/app';
import { connectDB } from 'src/config/database';
import { APP_PORT, NODE_ENV } from 'src/settings';
import { logger, discordAlert } from "src/utils/log";
import { version } from '../package.json';
import { WebSocketServer } from 'ws';
import { VoiceSessionManager } from 'src/services/VoiceSessionManager';
import url from 'url';

const startServer = async () => {
  const startupMessage = `Starting server on ${NODE_ENV}-v${version}...`;
  const runningMessage = `Server is running on port ${APP_PORT} (${NODE_ENV}-v${version})`;
  logger.i(startupMessage);
  await discordAlert(startupMessage);

  await connectDB();
  const app = createApp();
  const PORT = APP_PORT;
  
  const server = app.listen(PORT, async () => {
    logger.s(runningMessage);
    await discordAlert(runningMessage);
  });

  // WebSocket Server 설정 (Express HTTP Server를 가로챔)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = url.parse(request.url || '', true);
    
    // /ws/chats/voice 경로로 들어오는 웹소켓 요청만 라우팅
    if (parsedUrl.pathname === '/ws/chats/voice') {
      const token = parsedUrl.query.token as string;
      if (!token) {
         socket.destroy();
         return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        // VoiceSessionManager에 웹소켓 위임
        VoiceSessionManager.getInstance().handleConnection(ws, token);
      });
    } else {
      // 기타 웹소켓 업그레이드 요청은 차단 또는 다른 라우터로 
      socket.destroy();
    }
  });

};

startServer();

