'use strict';
class VersionConflictError extends Error{constructor(message,code){super(message);this.name='VersionConflictError';this.code=code;this.status=409}}
class VersionManager{static action(stored,incoming){if(stored===null||stored===undefined)return'create';const a=Number(stored),b=Number(incoming);if(b===a)throw new VersionConflictError('This episode already exists or is newer.','DUPLICATE_EPISODE_VERSION');if(b<a)throw new VersionConflictError('Episode version is older.','OLDER_EPISODE_VERSION');return'update'}}
module.exports={VersionManager,VersionConflictError};