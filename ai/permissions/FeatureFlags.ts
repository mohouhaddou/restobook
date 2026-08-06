export class FeatureFlags{public constructor(private readonly flags:Readonly<Record<string,boolean>>){}enabled(id:string){return this.flags[id]??false;}list(){return{...this.flags};}}
