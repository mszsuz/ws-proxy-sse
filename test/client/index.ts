import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../../settings.json'), 'utf8'));

const ws = new WebSocket(`ws://${settings.proxy.host}:${settings.proxy.port}/proxy`);

let messageCounter = 0;
let isWaitingForResponse = false;
let maxMessages = settings.testClient?.maxMessages || 3;

// Функция для получения читаемого состояния WebSocket
function getWebSocketState(state: number): string {
  const states: { [key: number]: string } = {
    [WebSocket.CONNECTING]: 'CONNECTING',
    [WebSocket.OPEN]: 'OPEN',
    [WebSocket.CLOSING]: 'CLOSING',
    [WebSocket.CLOSED]: 'CLOSED'
  };
  return states[state] || `UNKNOWN(${state})`;
}

function sendMessage() {
  // Проверяем состояние WebSocket соединения
  if (ws.readyState !== WebSocket.OPEN) {
    console.log(`❌ WebSocket not connected (state: ${getWebSocketState(ws.readyState)}). Skipping message #${messageCounter + 1}`);
    return;
  }

  // Не отправляем новое сообщение, если ждем ответа
  if (isWaitingForResponse) {
    console.log(`⏳ Waiting for response, skipping message #${messageCounter + 1}`);
    return;
  }

  messageCounter++;
  const message = `${settings.testClient.message} #${messageCounter}`;
  
  const requestPayload = {
    protocol: 'http',
    address: settings.testServer.host,
    port: settings.testServer.port,
    path: '/events',
    method: 'POST',
    headers: {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json'
    },
    body: {
      message: message
    }
  };

  console.log(`📤 #${messageCounter}: ${message}`);
  isWaitingForResponse = true;
  ws.send(JSON.stringify(requestPayload));
}

function scheduleNextMessage() {
  // Отправляем следующее сообщение только после получения ответа
  if (messageCounter < maxMessages && ws.readyState === WebSocket.OPEN) {
    // Пауза перед отправкой следующего сообщения (из настроек)
    const sendDelay = settings.testClient?.sendDelay || 1000;
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        sendMessage();
      }
    }, sendDelay);
  } else if (messageCounter >= maxMessages) {
    console.log(`✅ Отправлено ${maxMessages} сообщений. Завершение теста.`);
    ws.close();
  }
}

ws.on('open', () => {
  console.log('✅ Connected to Proxy WebSocket');
  console.log(`📋 Будет отправлено ${maxMessages} сообщений`);

  // Отправляем первое сообщение сразу
  sendMessage();
});

ws.on('message', (data: Buffer) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'connected') {
    console.log(`✅ Connected to server (${message.payload.status})`);
    if (message.payload.headers) {
      console.log(`📋 Server headers:`, message.payload.headers);
    }
  } else if (message.type === 'data') {
    // Старый формат (для обратной совместимости)
    const data = JSON.parse(message.payload);
    console.log(`📥 Echo: ${data.response}`);
    // Получили ответ, но ждем закрытия соединения
  } else if (message.type === 'sse-event') {
    // Новый формат с полными SSE полями
    const sseData = message.payload;
    console.log(`📥 SSE Event [${sseData.event}]:`);
    if (sseData.id) {
      console.log(`   🆔 ID: ${sseData.id}`);
    }
    if (sseData.retry) {
      console.log(`   🔄 Retry: ${sseData.retry}ms`);
    }
    
    try {
      const echoData = JSON.parse(sseData.data);
      console.log(`   📝 Data: ${echoData.response || sseData.data}`);
    } catch (e) {
      console.log(`   📝 Data: ${sseData.data}`);
    }
    // Получили ответ, но ждем закрытия соединения
  } else if (message.type === 'closed') {
    console.log(`🔚 Server closed: ${message.payload.reason}`);
    // Соединение закрыто, можем отправлять следующее сообщение
    isWaitingForResponse = false;
    // Планируем следующее сообщение через интервал
    scheduleNextMessage();
  } else if (message.type === 'error') {
    console.log(`❌ Error: ${message.payload.message}`);
    // Ошибка, можем отправлять следующее сообщение
    isWaitingForResponse = false;
    // Планируем следующее сообщение через интервал
    scheduleNextMessage();
  } else {
    // Выводим все остальные сообщения для отладки
    console.log(`📥 Received: ${JSON.stringify(message)}`);
  }
});

ws.on('close', (code: number, reason: Buffer) => {
  console.log(`❌ Disconnected (code: ${code}, reason: ${reason.toString()})`);
  console.log('\n📋 Тест завершен. Нажмите любую клавишу для выхода...');
  
  // Ждем нажатия клавиши перед выходом
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => {
    process.exit(0);
  });
});

ws.on('error', (error: Error) => {
  console.error('❌ WebSocket error:', error.message);
  console.log('\n📋 Произошла ошибка. Нажмите любую клавишу для выхода...');
  
  // Ждем нажатия клавиши перед выходом
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => {
    process.exit(0);
  });
});
