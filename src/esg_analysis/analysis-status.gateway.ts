// src/analysis/analysis-status.gateway.ts
import {
    WebSocketGateway,
    WebSocketServer,
  } from '@nestjs/websockets';
  import { Server } from 'socket.io';
  
  export interface AnalysisStatusUpdatePayload {
    analysisId: string;
    orgId: string;
    status: string;
    payment_status?: string | null;
    shipping_status?: string | null;
  }
  
  @WebSocketGateway({
    namespace: '/analysis-status',
    cors: {
      origin: [process.env.ALLOWED_ORIGINS].filter(Boolean),
      credentials: true,
    },
  })
  export class AnalysisStatusGateway {
    @WebSocketServer()
    server: Server;
  
    sendStatusUpdate(payload: AnalysisStatusUpdatePayload) {
      // 🔊 broadcast global (si querés rooms por user/org se puede después)
      this.server.emit('analysisStatusUpdated', payload);
    }
  }
  