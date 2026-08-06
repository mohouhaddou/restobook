'use strict';
class MetadataImporter{static episode(m,report,cover){return{number:m.episodeNumber,slug:m.episodeId,title:m.episodeTitle,language:m.language,version:m.episodeVersion,order:m.publicationOrder,cover,metadata:JSON.stringify(m.metadata||m),report:JSON.stringify(report),modes:JSON.stringify(m.readingModes||['classic','vertical'])}}}
module.exports=MetadataImporter;