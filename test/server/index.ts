import Fastify from 'fastify';
import * as fs from 'fs';
import * as path from 'path';

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../../settings.json'), 'utf8'));

const server = Fastify({ logger: false });
const PORT = settings.testServer.port;

server.post('/events', async (request, reply) => {
  // Устанавливаем заголовки, необходимые для SSE
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  
  // Добавляем дополнительные заголовки для тестирования
  reply.raw.setHeader('X-Server-Name', 'Test SSE Server');
  reply.raw.setHeader('X-Server-Version', '1.0.0');
  reply.raw.setHeader('X-Request-ID', `req-${Date.now()}`);
  reply.raw.setHeader('X-Custom-Header', 'Custom Value');
  
  reply.raw.flushHeaders(); // Отправляем заголовки клиенту немедленно

  const body = request.body as { message?: string };
  const receivedMessage = body?.message || 'No message received';
  
  console.log(`📨 Received: ${receivedMessage}`);

  // Отправляем ответы в одной SSE сессии (количество из настроек)
  const responseCount = settings.testServer?.responseCount || 3;
  for (let i = 1; i <= responseCount; i++) {
    const echoMessage = JSON.stringify({ 
      type: 'echo',
      originalMessage: receivedMessage,
      timestamp: new Date().toISOString(),
      response: `Echo ${i}/${responseCount}: ${receivedMessage}`,
      sequence: i
    });
    
    // Отправляем разные типы SSE сообщений для демонстрации
    if (i === 1) {
      // Первое сообщение - обычное с ID
      reply.raw.write(`id: echo-${Date.now()}-${i}\n`);
      reply.raw.write(`data: ${echoMessage}\n\n`);
    } else if (i === 2) {
      // Второе сообщение - с типом события
      reply.raw.write(`id: echo-${Date.now()}-${i}\n`);
      reply.raw.write(`event: user-message\n`);
      reply.raw.write(`data: ${echoMessage}\n\n`);
    } else {
      // Третье сообщение - с retry и множественными data полями
      reply.raw.write(`id: echo-${Date.now()}-${i}\n`);
      reply.raw.write(`event: final-message\n`);
      reply.raw.write(`retry: 5000\n`);
      reply.raw.write(`data: ${echoMessage}\n`);
      reply.raw.write(`data: Additional data line\n\n`);
    }
    
    console.log(`📤 Echo ${i}/${responseCount}: ${receivedMessage}`);
    
    // Пауза между сообщениями (из настроек)
    const responseDelay = settings.testServer?.responseDelay || 1000;
    if (i < responseCount) {
      await new Promise(resolve => setTimeout(resolve, responseDelay));
    }
  }
  
  // Закрываем соединение после отправки всех ответов
  reply.raw.end();
  console.log('🔌 Client disconnected');

  // Обрабатываем закрытие соединения клиентом (прокси)
  request.raw.on('close', () => {
    console.log('🔌 Client disconnected (by client)');
  });
});

server.listen({ port: PORT }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
