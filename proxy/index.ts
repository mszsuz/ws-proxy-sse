import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import * as fs from 'fs';
import * as path from 'path';

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings.json'), 'utf8'));

const fastify = Fastify({ logger: false });
fastify.register(fastifyWebsocket);

const PORT = settings.proxy.port;

fastify.register(async function (fastify) {
  fastify.get('/proxy', { websocket: true }, (connection, req) => {
    const socket = connection;
    let isProcessing = false;
    
    console.log('🔌 WebSocket client connected');

    socket.on('message', async (message: Buffer) => {
      // Если уже обрабатываем запрос, игнорируем новые
      if (isProcessing) {
        console.log('⏳ Already processing request, ignoring new message');
        return;
      }

      const messageStr = message.toString();
      
      try {
        isProcessing = true;
        const requestData = JSON.parse(messageStr);
        const { protocol, address, port, path, method, body } = requestData;
        const headers = requestData.headers || {};
        const url = `${protocol}://${address}:${port}${path}`;
        const messageText = body?.message || 'No message';
        
        console.log(`📨 ${method} ${path} → ${messageText}`);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        // Собираем заголовки ответа
        const responseHeaders: { [key: string]: string } = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        const connectedMsg = JSON.stringify({ 
          type: 'connected', 
          payload: { 
            status: response.status,
            headers: responseHeaders
          } 
        });
        console.log(`✅ Server connected (${response.status})`);
        console.log(`📋 Headers: ${JSON.stringify(responseHeaders)}`);
        socket.send(connectedMsg);

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let hasReceivedData = false;
          
          // Таймаут для чтения SSE потока (из настроек)
          let timeout: NodeJS.Timeout | null = null;
          if (settings.proxy.sseTimeout > 0) {
            timeout = setTimeout(async () => {
              console.log(`⏰ SSE read timeout (${settings.proxy.sseTimeout}ms), forcing close`);
              try {
                await reader.cancel();
              } catch (e) {
                // Игнорируем ошибки при отмене
              }
            }, settings.proxy.sseTimeout);
          }
          
          try {
            // Объект для накопления полей SSE сообщения
            let currentMessage: {
              id?: string;
              event?: string;
              data?: string[];
              retry?: string;
            } = {};

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log(`🔚 SSE stream ended`);
                break;
              }

              hasReceivedData = true;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data:')) {
                  const data = line.substring(5).trim();
                  if (data) {
                    if (!currentMessage.data) {
                      currentMessage.data = [];
                    }
                    currentMessage.data.push(data);
                  }
                } else if (line.startsWith('event:')) {
                  const event = line.substring(6).trim();
                  currentMessage.event = event;
                } else if (line.startsWith('id:')) {
                  const id = line.substring(3).trim();
                  currentMessage.id = id;
                } else if (line.startsWith('retry:')) {
                  const retry = line.substring(6).trim();
                  currentMessage.retry = retry;
                } else if (line.trim() === '') {
                  // Пустая строка - конец сообщения, отправляем накопленные данные
                  if (currentMessage.data && currentMessage.data.length > 0) {
                    const sseMessage = {
                      type: 'sse-event',
                      payload: {
                        id: currentMessage.id,
                        event: currentMessage.event || 'message',
                        data: currentMessage.data.join('\n'), // Объединяем множественные data поля
                        retry: currentMessage.retry
                      }
                    };
                    
                    const messageStr = JSON.stringify(sseMessage);
                    socket.send(messageStr);
                    
                    // Логируем для отладки
                    try {
                      const echoData = JSON.parse(currentMessage.data.join('\n'));
                      console.log(`📥 SSE Event [${currentMessage.event || 'message'}]: ${echoData.response || currentMessage.data.join('\n')}`);
                    } catch (e) {
                      console.log(`📥 SSE Event [${currentMessage.event || 'message'}]: ${currentMessage.data.join('\n')}`);
                    }
                    
                    if (currentMessage.id) {
                      console.log(`🆔 SSE ID: ${currentMessage.id}`);
                    }
                    if (currentMessage.retry) {
                      console.log(`🔄 SSE Retry: ${currentMessage.retry}`);
                    }
                  }
                  
                  // Сбрасываем объект для следующего сообщения
                  currentMessage = {};
                }
              }
            }
          } catch (readError) {
            console.log(`⚠️ SSE stream read error: ${readError}`);
          } finally {
            if (timeout) clearTimeout(timeout);
            reader.releaseLock();
          }
        }
        
        const closedMsg = JSON.stringify({ type: 'closed', payload: { reason: 'Server closed connection normally.' } });
        console.log(`🔚 Server closed`);
        socket.send(closedMsg);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Error: ${errorMessage}`);
        const errorMsg = JSON.stringify({ type: 'error', payload: { message: errorMessage } });
        socket.send(errorMsg);
      } finally {
        isProcessing = false;
      }
    });

    socket.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });
  });
});

fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error(`❌ Failed to start proxy server:`, err);
    process.exit(1);
  }
  console.log(`🚀 WebSocket to SSE Proxy запущен на порту ${PORT}`);
});
