type StatCardProps = {
  label: string;
  value: string;
  delta?: string;
  /** Secondary line under the value (e.g. TL / SE split). */
  detail?: string;
  compact?: boolean;
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  delta,
  detail,
  compact = false,
  onClick,
}: StatCardProps) {
  const interactive = Boolean(onClick);
  const className = [
    "h-full w-full rounded-xl border border-[rgba(33,37,41,0.06)] bg-white",
    "flex flex-col items-center justify-center text-center",
    "transition-[border-color,transform] duration-150",
    compact ? "px-3 py-3" : "p-4",
    interactive
      ? "lf-pressable cursor-pointer hover:border-[rgba(33,37,41,0.12)] active:scale-[0.99]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <p
        className={`font-medium text-[#6c757d] ${
          compact ? "text-[11px] leading-tight" : "text-[12px]"
        }`}
      >
        {label}
      </p>
      <div
        className={`flex items-end justify-center gap-2 ${
          compact ? "mt-2" : "mt-3 gap-3"
        }`}
      >
        <p
          className={`leading-none font-medium tracking-[-0.04em] tabular-nums text-[#212529] ${
            compact ? "text-[22px]" : "text-[28px]"
          }`}
        >
          {value}
        </p>
        {delta ? (
          <span className="shrink-0 rounded-full bg-[#f8f9fa] px-2 py-0.5 text-[11px] font-medium text-[#6c757d]">
            {delta}
          </span>
        ) : null}
      </div>
      {detail || compact ? (
        <p
          className={`text-[10px] tabular-nums tracking-[-0.01em] ${
            compact ? "mt-1.5 min-h-[14px]" : "mt-2 min-h-[16px]"
          } ${detail ? "text-[#868e96]" : "text-transparent select-none"}`}
          aria-hidden={detail ? undefined : true}
        >
          {detail ?? "\u00a0"}
        </p>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
