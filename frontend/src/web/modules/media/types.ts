export type MediaModule='kids'|'discover'|'sports'|'play';
export type MediaType='youtube'|'audio'|'pdf'|'image'|'coloring'|'downloadable';
export interface MediaItem{id:number;uuid:string;module:MediaModule;entity_type:string;entity_id:number;media_type:MediaType;provider:string;title:string;description?:string|null;url:string;external_id?:string|null;thumbnail?:string|null;duration?:string|null;language:string;sort_order:number;featured:boolean;visible:boolean;created_at:string;updated_at:string}
