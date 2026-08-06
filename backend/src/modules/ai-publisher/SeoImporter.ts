export interface GeneratedSeo{readonly [key:string]:unknown;readonly title:string;readonly description:string;readonly canonical:string;}
export class SeoImporter{generate(title:string,description:string,module:string,slug:string):GeneratedSeo{return{title:title.slice(0,60),description:description.slice(0,160),canonical:`https://ifilino.com/${module}/${slug}`};}}
