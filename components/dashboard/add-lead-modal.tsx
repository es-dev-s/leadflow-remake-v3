"use client";

import { ActionButton } from "@/components/dashboard/action-button";
import { FirstResponseProofDrop } from "@/components/dashboard/first-response-proof-drop";
import { ScreenAwareDateTimePicker } from "@/components/dashboard/screen-aware-datetime-picker";
import { ScreenAwareSelect } from "@/components/dashboard/screen-aware-select";
import {
  createLead,
  fetchLead,
  lookupLeadContact,
  updateLead,
  type LeadDetail,
} from "@/lib/api";
import {
  LEAD_SOURCES,
  PORTAL_OTHER,
  PORTAL_WEBSITES,
  QUALIFICATION_OPTIONS,
  qualificationLabel,
  type CreateLeadPayload,
} from "@/lib/lead-form-options";
import {
  applyCountryToPhone,
  countrySelectOptions,
  ensurePhonePrefix,
  flagEmoji,
  findCountryByName,
  isCompletePhoneNumber,
  isMeaningfulPhone,
  matchCountryFromPhone,
  normalizePhoneInput,
  normalizeStoredPhone,
  phoneDigits,
} from "@/lib/country-dial-codes";
import { canChangeQualification, canEditLeadProfile } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";
import { useActionPhase } from "@/hooks/use-action-phase";
import { LoaderCircle, X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type LeadSavedEvent = {
  mode: "create" | "edit";
  id: string;
};

type Props = {
  open: boolean;
  leadId?: string | null;
  onClose: () => void;
  onSaved: (event: LeadSavedEvent) => void;
};

const EXIT_MS = 280;

function FieldLabel({
  htmlFor,
  children,
  required,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase"
      >
        {children}
        {required ? <span className="ml-1 text-[#e86812]">*</span> : null}
      </label>
      {hint ? <span className="text-[11px] text-[#adb5bd]">{hint}</span> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-4 border-b border-[rgba(33,37,41,0.05)] pb-3">
        <h3 className="text-[14px] font-medium tracking-[-0.02em] text-[#212529]">
          {title}
        </h3>
        <p className="mt-0.5 text-[12px] text-[#868e96]">{description}</p>
      </div>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#adb5bd] hover:border-[rgba(33,37,41,0.16)] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]";

function todayLocalDateValue() {
  // Business calendar day in Asia/Kathmandu.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Normalize API/detail dates to YYYY-MM-DD for the date picker + backend. */
function toFormDateValue(raw: string | null | undefined) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return todayLocalDateValue();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dt = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (dt) return `${dt[1]}-${dt[2]}-${dt[3]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return todayLocalDateValue();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  portalSelect: string;
  portalOther: string;
  source: string;
  facebookProfile: string;
  language: string;
  clientProfile: string;
  qualificationStatus: string;
  leadScore: number;
  createdAt: string;
  notes: string;
  firstClientMessageAt: string;
  firstAgentMessageAt: string;
  firstResponseProofPath: string;
};

function emptyForm(): FormState {
  return {
    fullName: "",
    email: "",
    phone: "+",
    country: "",
    city: "",
    portalSelect: "",
    portalOther: "",
    source: "",
    facebookProfile: "",
    language: "",
    clientProfile: "",
    qualificationStatus: "QUALIFIED",
    leadScore: 50,
    createdAt: todayLocalDateValue(),
    notes: "",
    firstClientMessageAt: "",
    firstAgentMessageAt: "",
    firstResponseProofPath: "",
  };
}

function formatDurationLabel(totalMinutes: number) {
  const whole = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Minutes between client and agent first-message times, or NaN if invalid. */
function durationBetween(clientAt: string, agentAt: string): number | null {
  const client = clientAt.trim();
  const agent = agentAt.trim();
  if (!client && !agent) return null;
  if (!client || !agent) return Number.NaN;
  const start = new Date(client);
  const end = new Date(agent);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Number.NaN;
  }
  if (end.getTime() < start.getTime()) return Number.NaN;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

function formFromDetail(detail: LeadDetail): FormState {
  const portal = (detail.portalWebsite ?? "").trim();
  const knownPortal = (PORTAL_WEBSITES as readonly string[]).includes(portal);
  const phone = ensurePhonePrefix(detail.phone, detail.country ?? "");
  const countryFromPhone = matchCountryFromPhone(phone, detail.country ?? "");
  const knownCountry = findCountryByName(detail.country ?? "");
  const country =
    knownCountry?.name ||
    countryFromPhone?.name ||
    (detail.country ?? "").trim() ||
    "";
  return {
    fullName: detail.fullName ?? "",
    email: detail.email ?? "",
    phone,
    country,
    city: detail.city ?? "",
    portalSelect: portal
      ? knownPortal
        ? portal
        : PORTAL_OTHER
      : "",
    portalOther: portal && !knownPortal ? portal : "",
    source: detail.source ?? "",
    facebookProfile: detail.facebookProfile ?? "",
    language: detail.language ?? "",
    clientProfile: detail.clientProfile ?? "",
    qualificationStatus: detail.qualificationStatus || "QUALIFIED",
    leadScore:
      typeof detail.leadScore === "number" ? detail.leadScore : 50,
    createdAt: toFormDateValue(detail.createdAt),
    notes: detail.notes ?? "",
    firstClientMessageAt: detail.firstClientMessageAt ?? "",
    firstAgentMessageAt: detail.firstAgentMessageAt ?? "",
    firstResponseProofPath: detail.firstResponseProofPath ?? "",
  };
}

const BASE_PORTAL_OPTIONS = [
  ...PORTAL_WEBSITES.map((portal) => ({ value: portal, label: portal })),
  { value: PORTAL_OTHER, label: PORTAL_OTHER },
];

export function AddLeadModal({ open, leadId, onClose, onSaved }: Props) {
  const titleId = useId();
  const isEdit = Boolean(leadId);
  const role = useAuthStore((s) => s.user?.role);
  const allowQualify = canChangeQualification(role);
  const allowProfileEdit = canEditLeadProfile(role);
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(false);
  const [entered, setEntered] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const {
    phase: submitPhase,
    start: startSubmit,
    succeed: succeedSubmit,
    fail: failSubmit,
    reset: resetSubmit,
    isBusy: submitting,
  } = useActionPhase();
  const [error, setError] = useState<string | null>(null);
  /** Team that already owns this phone (informational). */
  const [phoneTeam, setPhoneTeam] = useState<string | null>(null);
  const [phoneExists, setPhoneExists] = useState(false);
  /** Portals/sources already used with this phone on the platform. */
  const [existingPortals, setExistingPortals] = useState<string[]>([]);
  const [existingSources, setExistingSources] = useState<string[]>([]);
  const [phoneChecking, setPhoneChecking] = useState(false);

  function clearPhonePresence() {
    setPhoneTeam(null);
    setPhoneExists(false);
    setExistingPortals([]);
    setExistingSources([]);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setPresent(true);
      setError(null);
      clearPhonePresence();
      resetSubmit();
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setEntered(false);
    const timer = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!leadId) {
      setForm(emptyForm());
      setLoading(false);
      clearPhonePresence();
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    clearPhonePresence();
    void fetchLead(leadId, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return;
        setForm(formFromDetail(detail));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load lead");
        setForm(emptyForm());
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, leadId]);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && open) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [present, open, onClose, submitting]);

  const portalIsOther = form.portalSelect === PORTAL_OTHER;
  const portalWebsiteValue = portalIsOther
    ? form.portalOther.trim()
    : form.portalSelect.trim();
  const portalOptions = useMemo(() => {
    const known = new Set<string>([
      ...PORTAL_WEBSITES,
      PORTAL_OTHER,
      ...BASE_PORTAL_OPTIONS.map((o) => o.value),
    ]);
    const extras = existingPortals
      .filter((p) => p && !known.has(p) && p !== form.portalOther.trim())
      .map((p) => ({ value: p, label: p }));
    if (
      form.portalSelect &&
      form.portalSelect !== PORTAL_OTHER &&
      !known.has(form.portalSelect) &&
      !extras.some((e) => e.value === form.portalSelect)
    ) {
      extras.unshift({
        value: form.portalSelect,
        label: form.portalSelect,
      });
    }
    return [...extras, ...BASE_PORTAL_OPTIONS];
  }, [existingPortals, form.portalSelect, form.portalOther]);

  const markedPortalValues = useMemo(() => {
    const marked = new Set<string>();
    const knownByLower = new Map(
      PORTAL_WEBSITES.map((p) => [p.toLowerCase(), p] as const),
    );
    for (const p of existingPortals) {
      const t = p.trim();
      if (!t) continue;
      const known = knownByLower.get(t.toLowerCase());
      if (known) {
        marked.add(known);
      } else {
        // Custom / free-text portals map to the Other option + exact value.
        marked.add(PORTAL_OTHER);
        marked.add(t);
      }
    }
    return [...marked];
  }, [existingPortals]);

  const markedSourceValues = useMemo(() => {
    const marked = new Set<string>();
    const knownByLower = new Map(
      LEAD_SOURCES.map((s) => [s.toLowerCase(), s] as const),
    );
    for (const s of existingSources) {
      const t = s.trim();
      if (!t) continue;
      marked.add(knownByLower.get(t.toLowerCase()) ?? t);
    }
    return [...marked];
  }, [existingSources]);

  const sourceOptions = useMemo(() => {
    const base = LEAD_SOURCES.map((source) => ({
      value: source,
      label: source,
    }));
    const extras: { value: string; label: string }[] = [];
    const seen = new Set<string>(LEAD_SOURCES);
    for (const s of existingSources) {
      if (s && !seen.has(s)) {
        seen.add(s);
        extras.push({ value: s, label: s });
      }
    }
    if (
      form.source &&
      !seen.has(form.source)
    ) {
      extras.unshift({ value: form.source, label: form.source });
    }
    return [...extras, ...base];
  }, [form.source, existingSources]);

  const qualificationOptions = useMemo(() => {
    const known = new Set(
      QUALIFICATION_OPTIONS.map((option) => option.value),
    );
    if (form.qualificationStatus && !known.has(form.qualificationStatus as never)) {
      return [
        {
          value: form.qualificationStatus,
          label: form.qualificationStatus.replace(/_/g, " "),
        },
        ...QUALIFICATION_OPTIONS,
      ];
    }
    return [...QUALIFICATION_OPTIONS];
  }, [form.qualificationStatus]);

  const countryOptions = useMemo(() => countrySelectOptions(), []);

  const matchedDial = useMemo(() => {
    return matchCountryFromPhone(form.phone, form.country);
  }, [form.phone, form.country]);

  const selectedCountry = useMemo(
    () => findCountryByName(form.country),
    [form.country],
  );

  // When the phone looks complete, look up team + portals/sources already on file.
  // Indicators only — never blocks create/update.
  useEffect(() => {
    if (!open || loading) return;

    const complete = isCompletePhoneNumber(form.phone, form.country);
    if (!complete) {
      clearPhonePresence();
      setPhoneChecking(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPhoneChecking(true);
      const phone = normalizeStoredPhone(form.phone, form.country).replace(
        /\s+/g,
        " ",
      );
      void lookupLeadContact(
        {
          phone,
          excludeId: leadId || undefined,
        },
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.exists) {
            setPhoneExists(true);
            setPhoneTeam(result.teamName?.trim() || "Unassigned");
            setExistingPortals(
              Array.isArray(result.existingPortals)
                ? result.existingPortals.filter(Boolean)
                : [],
            );
            setExistingSources(
              Array.isArray(result.existingSources)
                ? result.existingSources.filter(Boolean)
                : [],
            );
          } else {
            setPhoneExists(false);
            setPhoneTeam(null);
            setExistingPortals([]);
            setExistingSources([]);
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          clearPhonePresence();
        })
        .finally(() => {
          if (!controller.signal.aborted) setPhoneChecking(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, loading, form.phone, form.country, leadId]);

  const setPhone = (raw: string, mode: "type" | "legacy" = "type") => {
    setForm((prev) => {
      const phone =
        mode === "legacy"
          ? normalizeStoredPhone(raw, prev.country)
          : normalizePhoneInput(raw, prev.country);
      const matched = matchCountryFromPhone(phone, prev.country);
      if (matched) {
        return { ...prev, phone, country: matched.name };
      }
      const current = findCountryByName(prev.country);
      if (current) {
        const digits = phoneDigits(phone);
        if (!digits || !digits.startsWith(current.dial)) {
          return { ...prev, phone, country: "" };
        }
      }
      return { ...prev, phone };
    });
  };

  const finalizePhone = () => {
    setForm((prev) => {
      const phone = normalizeStoredPhone(prev.phone, prev.country);
      const matched = matchCountryFromPhone(phone, prev.country);
      if (matched) {
        return { ...prev, phone, country: matched.name };
      }
      return { ...prev, phone };
    });
  };

  const setCountry = (country: string) => {
    setForm((prev) => ({
      ...prev,
      country,
      phone: country
        ? applyCountryToPhone(prev.phone, country)
        : ensurePhonePrefix(prev.phone),
    }));
  };

  const firstResponseMinutes = useMemo(
    () =>
      durationBetween(form.firstClientMessageAt, form.firstAgentMessageAt),
    [form.firstClientMessageAt, form.firstAgentMessageAt],
  );

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (isEdit && !allowProfileEdit) return false;
    if (!form.source) return false;
    if (!form.qualificationStatus) return false;
    if (portalIsOther && !form.portalOther.trim()) return false;
    if (Number.isNaN(firstResponseMinutes)) return false;
    return true;
  }, [form, portalIsOther, loading, firstResponseMinutes, isEdit, allowProfileEdit]);

  if (!mounted || !present) return null;

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    const portalWebsite = portalIsOther
      ? form.portalOther.trim()
      : form.portalSelect.trim();

    const payload: CreateLeadPayload = {
      source: form.source,
      qualificationStatus: form.qualificationStatus,
      leadScore: form.leadScore,
    };
    if (form.fullName.trim()) payload.fullName = form.fullName.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (isMeaningfulPhone(form.phone)) {
      payload.phone = normalizeStoredPhone(
        form.phone,
        form.country,
      ).replace(/\s+/g, " ");
    }
    if (form.country.trim()) payload.country = form.country.trim();
    if (form.city.trim()) payload.city = form.city.trim();
    if (portalWebsite) payload.portalWebsite = portalWebsite;
    if (form.facebookProfile.trim()) {
      payload.facebookProfile = form.facebookProfile.trim();
    }
    if (form.language.trim()) payload.language = form.language.trim();
    if (form.clientProfile.trim()) {
      payload.clientProfile = form.clientProfile.trim();
    }
    if (form.createdAt.trim()) payload.createdAt = form.createdAt.trim();
    if (form.notes.trim()) payload.notes = form.notes.trim();
    payload.firstClientMessageAt = form.firstClientMessageAt.trim() || null;
    payload.firstAgentMessageAt = form.firstAgentMessageAt.trim() || null;
    payload.firstResponseProofPath = form.firstResponseProofPath.trim() || "";

    startSubmit();
    setError(null);
    try {
      if (leadId) {
        await updateLead(leadId, payload);
        onSaved({ mode: "edit", id: leadId });
        await succeedSubmit("Saved");
      } else {
        const created = await createLead(payload);
        onSaved({ mode: "create", id: created.id });
        await succeedSubmit("Created");
      }
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? "Failed to update lead"
            : "Failed to create lead",
      );
      failSubmit();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        aria-label="Close dialog"
        className={[
          "absolute inset-0 z-0 bg-[rgba(15,17,20,0.38)] backdrop-blur-md transition-opacity duration-300 ease-out",
          entered ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      {/* Date/time panels portal here — under the drawer so they emerge from behind it. */}
      <div
        data-flyout-layer=""
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-flyout-host="drawer"
        className={[
          "relative z-[2] flex h-dvh w-full max-w-[560px] flex-col overflow-hidden border-l border-[rgba(33,37,41,0.08)] bg-white shadow-[-24px_0_80px_rgba(15,17,20,0.16)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[640px] lg:max-w-[720px]",
          entered ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="relative shrink-0 overflow-hidden border-b border-[rgba(33,37,41,0.06)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,247,239,0.95)_0%,rgba(255,255,255,0.55)_48%,rgba(248,249,250,0.9)_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 right-0 h-44 w-44 rounded-full bg-[rgba(232,104,18,0.1)] blur-3xl"
          />
          <div className="relative flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e86812]" />
                <p className="text-[11px] font-medium tracking-[0.16em] text-[#9a3f00] uppercase">
                  {isEdit ? "Edit capture" : "New capture"}
                </p>
              </div>
              <h2
                id={titleId}
                className="mt-2 text-[21px] font-medium tracking-[-0.04em] text-[#212529]"
              >
                {isEdit ? "Edit lead" : "Add new lead"}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6c757d]">
                {isEdit
                  ? "Update details, then save changes."
                  : "Slide-in capture — required fields marked in orange."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!submitting) onClose();
              }}
              className="lf-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(33,37,41,0.08)] bg-white/80 text-[#868e96] backdrop-blur-sm hover:bg-white hover:text-[#212529]"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="lf-scroll relative min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {loading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="flex items-center gap-2 text-[13px] text-[#868e96]">
                  <LoaderCircle size={16} className="animate-spin" />
                  Loading lead…
                </div>
              </div>
            ) : null}

            <Section
              title="Contact"
              description="Who the lead is and how to reach them."
            >
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="lead-fullName">Full name</FieldLabel>
                <input
                  id="lead-fullName"
                  className={inputClass}
                  value={form.fullName}
                  onChange={(e) => set("fullName")(e.target.value)}
                  placeholder="Client full name"
                  autoFocus={!isEdit}
                  disabled={loading}
                />
              </div>

              <div>
                <FieldLabel htmlFor="lead-email">Email</FieldLabel>
                <input
                  id="lead-email"
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="name@example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <FieldLabel htmlFor="lead-phone" hint="Starts with +">
                  Phone number
                </FieldLabel>
                <div
                  className={[
                    "group flex h-11 items-stretch overflow-hidden rounded-xl border bg-[#fbfbfc] transition-[border-color,box-shadow,background-color]",
                    phoneExists
                      ? "border-[rgba(232,104,18,0.35)] focus-within:border-[rgba(232,104,18,0.5)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]"
                      : [
                          "border-[rgba(33,37,41,0.1)] hover:border-[rgba(33,37,41,0.16)]",
                          "focus-within:border-[rgba(232,104,18,0.5)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]",
                        ].join(" "),
                  ].join(" ")}
                >
                  <div className="flex shrink-0 items-center gap-1.5 border-r border-[rgba(33,37,41,0.08)] bg-[rgba(33,37,41,0.02)] px-3">
                    <span
                      className="text-[15px] leading-none transition-opacity duration-200"
                      aria-hidden
                    >
                      {matchedDial ? flagEmoji(matchedDial.iso2) : "🌐"}
                    </span>
                    <span className="min-w-[2.25rem] text-[12px] font-medium tabular-nums text-[#495057]">
                      {matchedDial ? `+${matchedDial.dial}` : "+"}
                    </span>
                  </div>
                  <input
                    id="lead-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[13px] text-[#212529] outline-none placeholder:text-[#adb5bd]"
                    value={form.phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (!text.trim()) return;
                      e.preventDefault();
                      setPhone(text, "legacy");
                    }}
                    onBlur={() => finalizePhone()}
                    onFocus={(e) => {
                      const el = e.currentTarget;
                      if (el.value === "+") {
                        requestAnimationFrame(() => {
                          el.setSelectionRange(1, 1);
                        });
                      }
                    }}
                    placeholder="+977 98…"
                    disabled={loading}
                  />
                </div>
                <p className="mt-1.5 min-h-4 text-[11px] transition-colors duration-200">
                  {phoneChecking ? (
                    <span className="text-[#adb5bd]">Checking number…</span>
                  ) : phoneExists && phoneTeam ? (
                    <span className="text-[#9a3f00]">
                      Already in{" "}
                      <span className="font-medium">{phoneTeam}</span>
                    </span>
                  ) : isCompletePhoneNumber(form.phone, form.country) ? (
                    <span className="text-[#868e96]">
                      Number not on an existing lead
                    </span>
                  ) : matchedDial ? (
                    <span className="text-[#868e96]">
                      Matched{" "}
                      <span className="font-medium text-[#495057]">
                        {matchedDial.name}
                      </span>
                      <span className="text-[#adb5bd]">
                        {" "}
                        · finish the number to check teams
                      </span>
                    </span>
                  ) : form.phone.trim().length > 1 ? (
                    <span className="text-[#adb5bd]">
                      Keep typing the country code…
                    </span>
                  ) : (
                    <span className="text-[#adb5bd]">
                      Country updates as you type the code
                    </span>
                  )}
                </p>
              </div>

              <div>
                <FieldLabel htmlFor="lead-country">Country</FieldLabel>
                <ScreenAwareSelect
                  id="lead-country"
                  value={form.country}
                  options={countryOptions}
                  placeholder="Select country"
                  searchable
                  disabled={loading}
                  onChange={setCountry}
                />
                {selectedCountry ? (
                  <p className="mt-1.5 text-[11px] text-[#adb5bd]">
                    Dial code{" "}
                    <span className="font-medium tabular-nums text-[#495057]">
                      +{selectedCountry.dial}
                    </span>{" "}
                    stays in sync with the phone field
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-[#adb5bd]">
                    Or pick a country to fill the dial code
                  </p>
                )}
              </div>

              <div>
                <FieldLabel htmlFor="lead-city">City</FieldLabel>
                <input
                  id="lead-city"
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => set("city")(e.target.value)}
                  placeholder="Sydney"
                  disabled={loading}
                />
              </div>

              <div>
                <FieldLabel htmlFor="lead-language">Languages</FieldLabel>
                <input
                  id="lead-language"
                  className={inputClass}
                  value={form.language}
                  onChange={(e) => set("language")(e.target.value)}
                  placeholder="English"
                  disabled={loading}
                />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel htmlFor="lead-client-profile">
                  Client profile
                </FieldLabel>
                <input
                  id="lead-client-profile"
                  className={inputClass}
                  value={form.clientProfile}
                  onChange={(e) => set("clientProfile")(e.target.value)}
                  placeholder="Background, occupation, goals…"
                  disabled={loading}
                />
              </div>
            </Section>

            <Section
              title="Acquisition"
              description="Where this lead came from and which brand owns it."
            >
              <div className={portalIsOther ? "" : "sm:col-span-2"}>
                <FieldLabel htmlFor="lead-portal">Portal website</FieldLabel>
                <ScreenAwareSelect
                  id="lead-portal"
                  value={form.portalSelect}
                  options={portalOptions}
                  placeholder="Select portal"
                  searchable
                  markedValues={markedPortalValues}
                  markedHint="On file"
                  onChange={(value) => set("portalSelect")(value)}
                />
                {phoneExists && existingPortals.length > 0 ? (
                  <p className="mt-1.5 text-[11px] text-[#868e96]">
                    Already used with this number:{" "}
                    <span className="font-medium text-[#495057]">
                      {existingPortals.slice(0, 3).join(", ")}
                      {existingPortals.length > 3
                        ? ` +${existingPortals.length - 3}`
                        : ""}
                    </span>
                  </p>
                ) : null}
              </div>

              {portalIsOther ? (
                <div>
                  <FieldLabel htmlFor="lead-portal-other" required>
                    Other portal name
                  </FieldLabel>
                  <input
                    id="lead-portal-other"
                    className={[
                      inputClass,
                      existingPortals.some(
                        (p) =>
                          p.trim().toLowerCase() ===
                          form.portalOther.trim().toLowerCase(),
                      )
                        ? "border-[rgba(232,104,18,0.35)] bg-[#fff7ef]"
                        : "",
                    ].join(" ")}
                    value={form.portalOther}
                    onChange={(e) => set("portalOther")(e.target.value)}
                    placeholder="Enter portal name"
                    required
                    disabled={loading}
                  />
                </div>
              ) : null}

              <div>
                <FieldLabel htmlFor="lead-source" required>
                  Lead source
                </FieldLabel>
                <ScreenAwareSelect
                  id="lead-source"
                  value={form.source}
                  options={sourceOptions}
                  placeholder="Select source"
                  required
                  markedValues={markedSourceValues}
                  markedHint="On file"
                  onChange={(value) => set("source")(value)}
                />
                {phoneExists && existingSources.length > 0 ? (
                  <p className="mt-1.5 text-[11px] text-[#868e96]">
                    Already used with this number:{" "}
                    <span className="font-medium text-[#495057]">
                      {existingSources.slice(0, 3).join(", ")}
                      {existingSources.length > 3
                        ? ` +${existingSources.length - 3}`
                        : ""}
                    </span>
                  </p>
                ) : null}
              </div>

              <div>
                <FieldLabel htmlFor="lead-date">Date</FieldLabel>
                <ScreenAwareDateTimePicker
                  id="lead-date"
                  mode="date"
                  value={form.createdAt}
                  onChange={(value) => set("createdAt")(value)}
                  disabled={loading}
                  placeholder="Select lead date"
                />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel htmlFor="lead-fb">
                  Facebook profile / page
                </FieldLabel>
                <input
                  id="lead-fb"
                  className={inputClass}
                  value={form.facebookProfile}
                  onChange={(e) => set("facebookProfile")(e.target.value)}
                  placeholder="Meta page or profile name"
                  disabled={loading}
                />
              </div>
            </Section>

            <Section
              title="Qualification"
              description={
                allowQualify
                  ? "Status and score used for routing and reporting."
                  : "Qualification is set by analysts. You can still update score and other fields."
              }
            >
              <div className="sm:col-span-2">
                <FieldLabel required>Qualification</FieldLabel>
                {allowQualify ? (
                  <div
                    role="radiogroup"
                    aria-label="Qualification"
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    {qualificationOptions.map((option) => {
                      const active = form.qualificationStatus === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={loading}
                          onClick={() => set("qualificationStatus")(option.value)}
                          className={[
                            "lf-pressable rounded-xl border px-3 py-2.5 text-left text-[12px] font-medium transition-colors disabled:opacity-50",
                            active
                              ? "border-[rgba(232,104,18,0.35)] bg-[#fff7ef] text-[#9a3f00]"
                              : "border-[rgba(33,37,41,0.08)] bg-[#fbfbfc] text-[#495057] hover:border-[rgba(33,37,41,0.14)] hover:bg-white",
                          ].join(" ")}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-3 py-2.5 text-[13px] font-medium text-[#495057]">
                    {qualificationLabel(form.qualificationStatus) ||
                      form.qualificationStatus ||
                      "—"}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <FieldLabel htmlFor="lead-score" hint={`${form.leadScore} / 100`}>
                  Lead score
                </FieldLabel>
                <div className="rounded-2xl border border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] px-4 py-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <p className="text-[13px] text-[#6c757d]">
                      Drag to set quality from 0 to 100
                    </p>
                    <span className="text-[22px] font-medium tracking-[-0.04em] tabular-nums text-[#212529]">
                      {form.leadScore}
                    </span>
                  </div>
                  <input
                    id="lead-score"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={form.leadScore}
                    disabled={loading}
                    onChange={(e) => set("leadScore")(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgba(33,37,41,0.08)] accent-[#e86812] disabled:opacity-50"
                  />
                  <div className="mt-2 flex justify-between text-[11px] tabular-nums text-[#adb5bd]">
                    <span>Low</span>
                    <span>Mid</span>
                    <span>High</span>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <FieldLabel htmlFor="lead-notes">Notes</FieldLabel>
                <textarea
                  id="lead-notes"
                  rows={4}
                  disabled={loading}
                  className="min-h-[112px] w-full resize-y rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 py-3 text-[13px] leading-relaxed text-[#212529] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#adb5bd] hover:border-[rgba(33,37,41,0.16)] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)] disabled:opacity-50"
                  value={form.notes}
                  onChange={(e) => set("notes")(e.target.value)}
                  placeholder="Context, objections, next steps…"
                />
              </div>
            </Section>

            <Section
              title="First response"
              description="Record first client and first agent message times. Duration is calculated automatically. Attach screenshot proof."
            >
              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <FieldLabel htmlFor="lead-fr-client">
                    First client message
                  </FieldLabel>
                  <ScreenAwareDateTimePicker
                    id="lead-fr-client"
                    mode="datetime"
                    value={form.firstClientMessageAt}
                    onChange={(value) => set("firstClientMessageAt")(value)}
                    disabled={loading}
                    placeholder="Client message time"
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="lead-fr-agent">
                    First agent message
                  </FieldLabel>
                  <ScreenAwareDateTimePicker
                    id="lead-fr-agent"
                    mode="datetime"
                    value={form.firstAgentMessageAt}
                    onChange={(value) => set("firstAgentMessageAt")(value)}
                    disabled={loading}
                    placeholder="Agent reply time"
                  />
                </div>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] px-3.5 py-3">
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                  Calculated response time
                </p>
                {Number.isNaN(firstResponseMinutes) ? (
                  <p className="mt-1.5 text-[13px] text-[#c92a2a]">
                    {!form.firstClientMessageAt.trim() ||
                    !form.firstAgentMessageAt.trim()
                      ? "Enter both times to calculate duration"
                      : "Agent time must be on or after client time"}
                  </p>
                ) : firstResponseMinutes != null ? (
                  <p className="mt-1.5 text-[22px] font-medium tracking-[-0.04em] tabular-nums text-[#212529]">
                    {formatDurationLabel(firstResponseMinutes)}
                    <span className="ml-2 text-[12px] font-normal text-[#868e96]">
                      ({firstResponseMinutes.toLocaleString("en-US")} min)
                    </span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-[#adb5bd]">
                    Optional — leave both blank if not measured yet
                  </p>
                )}
              </div>
              <FirstResponseProofDrop
                value={form.firstResponseProofPath}
                disabled={loading}
                onChange={(path) => set("firstResponseProofPath")(path)}
              />
            </Section>
          </div>

          <div className="shrink-0 border-t border-[rgba(33,37,41,0.06)] bg-white/95 px-5 py-4 backdrop-blur-sm sm:px-6">
            {error ? (
              <p className="mb-3 text-[12px] text-[#c92a2a]">{error}</p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="lf-pressable inline-flex h-11 items-center rounded-xl border border-[rgba(33,37,41,0.1)] bg-white px-5 text-[13px] font-medium text-[#212529] hover:bg-[#f8f9fa] disabled:opacity-60"
              >
                Cancel
              </button>
              <ActionButton
                type="submit"
                phase={submitPhase}
                disabled={!canSubmit}
                idleLabel={isEdit ? "Save changes" : "Create lead"}
                pendingLabel="Saving…"
                successLabel={isEdit ? "Saved" : "Created"}
                className="h-11 rounded-xl px-5 text-[13px]"
              />
            </div>
          </div>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
