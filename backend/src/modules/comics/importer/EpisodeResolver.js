'use strict';const {QueryTypes}=require('sequelize');
class EpisodeResolver{static async find(sequelize,uid,transaction){return(await sequelize.query('SELECT * FROM comic_episodes WHERE episode_uid=:uid LIMIT 1',{replacements:{uid},transaction,type:QueryTypes.SELECT}))[0]||null}}
module.exports=EpisodeResolver;