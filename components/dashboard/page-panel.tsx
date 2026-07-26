type Props = {
  title: string;
  description: string;
};

/** Honest empty state for routes that are navigable but not shipped yet. */
export function PagePanel({ title, description }: Props) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-1 border-b border-[rgba(33,37,41,0.05)] px-5 py-4">
        <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529]">
          {title}
        </h2>
        <p className="text-[13px] text-[#868e96]">{description}</p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 py-14">
        <div className="max-w-sm text-center">
          <p className="text-[13px] font-medium text-[#495057]">
            This section is not available yet
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#868e96]">
            Core CRM workflows (dashboard, leads, users, and transfers) are live.
            {title} will land here without changing your existing data.
          </p>
        </div>
      </div>
    </section>
  );
}
