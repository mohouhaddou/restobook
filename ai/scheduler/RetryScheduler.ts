export class RetryScheduler{delay(base:number,multiplier:number,attempt:number){return base*multiplier**Math.max(0,attempt-1);}}
