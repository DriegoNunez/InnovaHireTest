/** A question's figure. Plain <img>: figures are served by our own authenticated route. */
export function QuestionFigure({ figure, className = "" }: { figure: { id: string; alt: string } | null | undefined; className?: string }) {
  if (!figure) return null;
  return (
    <figure className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/figures/${figure.id}`} alt={figure.alt} className="mx-auto block h-auto max-h-[28rem] w-full max-w-3xl object-contain" draggable={false} />
    </figure>
  );
}
