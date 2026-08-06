import type{AuditEvent}from"./AuditEvent";export interface AuditReport{readonly total:number;readonly actions:Readonly<Record<string,number>>;readonly events:readonly AuditEvent[];}
