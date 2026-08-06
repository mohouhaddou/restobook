'use strict';
const { PlayQuiz, PlayQuestion, PlayAnswer } = require('../../../../models');
const SUPPORTED = new Set(['fr','ar','en']);
function languageOf(locale){const value=String(locale||'fr').slice(0,2).toLowerCase();return SUPPORTED.has(value)?value:'fr';}
function localized(value,translations,locale){const language=languageOf(locale);return language==='fr'?value:(translations?.[language]||value);}
async function listQuizzes({category=null,gameId=null}={}){const where={active:true};if(category)where.category=category;if(gameId)where.game_id=gameId;return PlayQuiz.findAll({where,order:[['sort_order','ASC']],raw:true});}
async function getQuiz(quizId){return PlayQuiz.findByPk(quizId,{raw:true});}
async function getQuizQuestions(quizId,locale='fr'){
  const questions=await PlayQuestion.findAll({where:{quiz_id:quizId,active:true},order:[['sort_order','ASC']],include:[{model:PlayAnswer,as:'answers'}]});
  return questions.map(q=>({id:q.id,questionType:q.question_type,questionText:localized(q.question_text,q.translations,locale),explanation:localized(q.explanation,q.explanation_translations,locale),discoverUrl:q.discover_url,imageUrl:q.image_url,difficulty:q.difficulty,points:q.points,locationName:q.question_type==='guess_place'?undefined:q.location_name,answers:(q.answers||[]).map(a=>({id:a.id,text:localized(a.answer_text,a.translations,locale)}))}));
}
async function getQuestionsForScoring(quizId){return PlayQuestion.findAll({where:{quiz_id:quizId,active:true},include:[{model:PlayAnswer,as:'answers'}]});}
module.exports={getQuestionsForScoring,getQuiz,getQuizQuestions,listQuizzes,languageOf};
