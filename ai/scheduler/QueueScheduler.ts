export class QueueScheduler<T>{private readonly x:T[]=[];enqueue(v:T){this.x.push(v);}next(){return this.x.shift();}size(){return this.x.length;}}
