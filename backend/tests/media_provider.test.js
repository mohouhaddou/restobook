'use strict';
const assert=require('assert');const youtube=require('../src/modules/media/providers/youtubeProvider');
assert.equal(youtube.extractId('https://youtu.be/dQw4w9WgXcQ'),'dQw4w9WgXcQ');
assert.equal(youtube.extractId('https://youtube.com/watch?v=dQw4w9WgXcQ'),'dQw4w9WgXcQ');
assert.throws(()=>youtube.extractId('https://example.com/watch?v=dQw4w9WgXcQ'),/Invalid YouTube URL/);
assert.throws(()=>youtube.extractId('javascript:alert(1)'),/Invalid YouTube URL/);
console.log('media provider tests passed');
