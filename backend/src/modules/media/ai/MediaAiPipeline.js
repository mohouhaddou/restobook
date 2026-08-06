'use strict';
/** Provider-neutral AI enrichment pipeline. Results live in media.metadata.ai, so adding
 * taggers, transcription, scene detection, summaries, quizzes, subtitles, thumbnail scoring,
 * SEO and related-content engines never requires a schema migration. */
class MediaAiPipeline{constructor(){this.processors=new Map()}register(name,processor){if(typeof processor?.run!=='function')throw new TypeError('AI processor must expose run(media, context)');this.processors.set(name,processor);return this}async run(media,names=[...this.processors.keys()],context={}){const output={...(media.metadata?.ai||{})};for(const name of names){const processor=this.processors.get(name);if(!processor)continue;output[name]={status:'complete',generated_at:new Date().toISOString(),result:await processor.run(media,context)}}await media.update({metadata:{...(media.metadata||{}),ai:output}});return output}}
module.exports=new MediaAiPipeline();
