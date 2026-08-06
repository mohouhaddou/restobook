'use strict';
const REQUIRED=['packageType','packageVersion','seriesId','seriesTitle','episodeId','episodeNumber','episodeTitle','episodeVersion','language','generatedAt'];
class ManifestValidationError extends Error{constructor(errors){super(errors.join(' '));this.name='ManifestValidationError';this.errors=errors;this.status=422}}
class ManifestValidator{
 static validate(manifest){
  const errors=[];if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw new ManifestValidationError(['Invalid manifest.json.']);
  for(const field of REQUIRED)if(manifest[field]===undefined||manifest[field]===null||manifest[field]==='')errors.push(`Missing ${field}.`);
  if(manifest.packageType!==undefined&&manifest.packageType!=='ifilino-comic')errors.push('Invalid packageType; expected ifilino-comic.');
  const version=Number(manifest.packageVersion);if(manifest.packageVersion!==undefined&&(!Number.isInteger(version)||version<1||version>2))errors.push('Unsupported packageVersion.');
  for(const field of ['episodeNumber','episodeVersion'])if(manifest[field]!==undefined&&(!Number.isInteger(Number(manifest[field]))||Number(manifest[field])<1))errors.push(`Invalid ${field}.`);
  if(manifest.seasonNumber!==undefined&&(!Number.isInteger(Number(manifest.seasonNumber))||Number(manifest.seasonNumber)<1))errors.push('Invalid seasonNumber.');
  if(manifest.publicationOrder!==undefined&&(!Number.isInteger(Number(manifest.publicationOrder))||Number(manifest.publicationOrder)<1))errors.push('Invalid publicationOrder.');
  if(manifest.generatedAt&&!Number.isFinite(Date.parse(manifest.generatedAt)))errors.push('Invalid generatedAt.');
  if(manifest.minimumImporterVersion&&Number.parseFloat(manifest.minimumImporterVersion)>2)errors.push('minimumImporterVersion is newer than this importer.');
  for(const field of ['seriesId','episodeId'])if(manifest[field]&&!/^[a-z0-9][a-z0-9._-]{1,190}$/i.test(manifest[field]))errors.push(`Invalid ${field} format.`);
  if(errors.length)throw new ManifestValidationError(errors);return {...manifest,packageVersion:version,episodeNumber:Number(manifest.episodeNumber),episodeVersion:Number(manifest.episodeVersion),seasonNumber:Number(manifest.seasonNumber||1),publicationOrder:Number(manifest.publicationOrder||manifest.episodeNumber)};
 }
}
module.exports={ManifestValidator,ManifestValidationError,REQUIRED};