import React from 'react';

// Accordéon FAQ via <details>/<summary> natif — fonctionne sans JS (SSR-safe,
// aucun useState requis). Le schema.org FAQPage correspondant est généré
// côté backend (schemaGenerator.faqSchema) à partir de la même donnée.
const FAQ_TITLE = { ar: 'الأسئلة الشائعة', fr: 'Questions fréquentes' };

export default function FaqAccordion({ faq, language = 'fr' }) {
  if (!faq?.length) return null;
  const title = FAQ_TITLE[language] || FAQ_TITLE.fr;
  return (
    <section className="ifm-faq" aria-label={title}>
      <h2>{title}</h2>
      {faq.map((item, i) => (
        <details key={i} className="ifm-faq-item">
          <summary className="ifm-faq-question">{item.question}</summary>
          <div className="ifm-faq-answer">{item.answer}</div>
        </details>
      ))}
    </section>
  );
}
