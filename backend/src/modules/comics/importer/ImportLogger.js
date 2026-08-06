'use strict';
class ImportLogger{constructor(){this.entries=[]}add(message,details={}){this.entries.push({at:new Date().toISOString(),message,...details});return this}json(){return this.entries}}
module.exports=ImportLogger;