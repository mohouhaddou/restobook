export interface AuditEvent{readonly id:string;readonly action:string;readonly actor:string;readonly target:string;readonly date:string;readonly metadata:Readonly<Record<string,unknown>>;}
