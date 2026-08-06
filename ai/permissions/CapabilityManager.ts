export class CapabilityManager{supports(available:readonly string[],required:readonly string[]){return required.every(x=>available.includes(x));}}
