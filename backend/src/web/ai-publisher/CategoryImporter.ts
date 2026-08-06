export class CategoryImporter{normalize(value:string,fallback="actualite"){return value.trim().toLowerCase().replace(/\s+/g,"_")||fallback;}}
