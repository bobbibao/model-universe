// One answer, as people read it: "Intro: 1) first; 2) second; 3) third." becomes the intro and a numbered list, any
// other answer stays one paragraph. The words are the same either way (the page's FAQPage data keeps the plain text).
const STEP = /\s*(?:;\s*)?\b\d\)\s+/;

export default function FaqAnswer({ text }: { text: string }) {
  const [intro, ...steps] = text.split(STEP);
  if (steps.length < 2) return <p className="faq-answer">{text}</p>;
  return (
    <div className="faq-answer">
      {intro && <p>{intro}</p>}
      <ol>
        {steps.map((step, index) => (
          <li key={index}>{step.replace(/[;.]\s*$/, '')}</li>
        ))}
      </ol>
    </div>
  );
}
