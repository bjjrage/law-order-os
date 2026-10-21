import type { IncomingMessage, ServerResponse } from 'node:http';
export function handleJunta(req:IncomingMessage,res:ServerResponse,origin:string):Promise<boolean>;
