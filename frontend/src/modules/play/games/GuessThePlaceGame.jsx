import React, { useEffect, useRef, useState } from 'react';
import { useLeafletMap } from '../../../shared/hooks/useLeafletMap';

export default function GuessThePlaceGame({ quiz, questions, onFinish }) {
  const [index, setIndex] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [mode, setMode] = useState('mcq');
  const [pin, setPin] = useState(null);
  const startRef = useRef(Date.now());
  const { containerRef, setMarker, setOnMapClick } = useLeafletMap({ center: [31.7917, -7.0926], zoom: 5 });

  const question = questions[index];

  useEffect(() => {
    setOnMapClick((lat, lng) => { setPin({ lat, lng }); setMarker('guess', { lat, lng, html: '📍' }); });
  }, [setOnMapClick, setMarker]);

  useEffect(() => { setPin(null); }, [index]);

  function finishOrNext(nextGuesses) {
    if (index + 1 >= questions.length) {
      const durationSeconds = Math.round((Date.now() - startRef.current) / 1000);
      onFinish({ quizId: quiz.id, guesses: nextGuesses, durationSeconds });
    } else {
      setGuesses(nextGuesses);
      setIndex(i => i + 1);
    }
  }

  function submitMcq(answerId) {
    finishOrNext([...guesses, { questionId: question.id, answerId }]);
  }

  function submitMap() {
    if (!pin) return;
    finishOrNext([...guesses, { questionId: question.id, lat: pin.lat, lng: pin.lng }]);
  }

  if (!question) return null;

  return (
    <div>
      <div className="play-quiz-progress">
        <span>Lieu {index + 1} / {questions.length}</span>
        <div className="play-tabs" style={{ margin: 0 }}>
          <button className={`play-tab ${mode === 'mcq' ? 'active' : ''}`} onClick={() => setMode('mcq')}>4 villes</button>
          <button className={`play-tab ${mode === 'map' ? 'active' : ''}`} onClick={() => setMode('map')}>Carte</button>
        </div>
      </div>

      {question.imageUrl && <img src={question.imageUrl} alt="" className="play-guess-image" />}
      <div className="play-quiz-question">{question.questionText}</div>

      {mode === 'mcq' ? (
        <div className="play-quiz-answers">
          {question.answers.map(a => (
            <button key={a.id} className="play-quiz-answer" onClick={() => submitMcq(a.id)}>{a.text}</button>
          ))}
        </div>
      ) : (
        <>
          <div ref={containerRef} className="play-guess-map" />
          <div style={{ textAlign: 'center' }}>
            <button className="play-btn" disabled={!pin} onClick={submitMap}>Valider ce point</button>
          </div>
        </>
      )}
    </div>
  );
}
