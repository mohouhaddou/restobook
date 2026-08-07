export const COMICS = [];

export const GENRES = ['Adventure','Arabic','Educational','Fantasy','Historical','Kids','Mystery','Sci-fi','Superheroes'];

export const getComic = slug => COMICS.find(comic => comic.slug === slug) || { slug, title:'Loading...', subtitle:'', genre:'Comics', status:'Published', rating:0, readers:'0', accent:'red', cover:'', banner:'', progress:0, chapter:1, author:'iFilino Comics', synopsis:'', episodes:[], pages:[] };
