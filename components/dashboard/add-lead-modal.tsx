"use client";

import { ActionButton } from "@/components/dashboard/action-button";
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
  isMeaningfulPhone,
  matchCountryFromPhone,
  normalizePhoneInput,
  normalizeStoredPhone,
  phoneDigits,
} from "@/lib/country-dial-codes";
import { canChangeQualification } from "@/lib/roles";
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
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  };
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
    createdAt: detail.createdAt || todayLocalDateValue(),
    notes: detail.notes ?? "",
  };
}

const portalOptions = [
  ...PORTAL_WEBSITES.map((portal) => ({ value: portal, label: portal })),
  { value: PORTAL_OTHER, label: PORTAL_OTHER },
];

export function AddLeadModal({ open, leadId, onClose, onSaved }: Props) {
  const titleId = useId();
  const isEdit = Boolean(leadId);
  const role = useAuthStore((s) => s.user?.role);
  const allowQualify = canChangeQualification(role);
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
  const [duplicateTeam, setDuplicateTeam] = useState<string | null>(null);
  const [duplicateChecking, setDuplicateChecking] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setPresent(true);
      setError(null);
      setDuplicateTeam(null);
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
      setDuplicateTeam(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDuplicateTeam(null);
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

  const sourceOptions = useMemo(() => {
    const base = LEAD_SOURCES.map((source) => ({
      value: source,
      label: source,
    }));
    if (
      form.source &&
      !LEAD_SOURCES.includes(form.source as (typeof LEAD_SOURCES)[number])
    ) {
      return [{ value: form.source, label: form.source }, ...base];
    }
    return base;
  }, [form.source]);

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

  // Live duplicate check by phone and/or email.
  useEffect(() => {
    if (!open || loading) return;

    const email = form.email.trim();
    const phoneReady = isMeaningfulPhone(form.phone);
    if (!email && !phoneReady) {
      setDuplicateTeam(null);
      setDuplicateChecking(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDuplicateChecking(true);
      const phone = phoneReady
        ? normalizeStoredPhone(form.phone, form.country).replace(/\s+/g, " ")
        : undefined;
      void lookupLeadContact(
        {
          phone,
          email: email || undefined,
          excludeId: leadId || undefined,
        },
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.exists) {
            setDuplicateTeam(result.teamName?.trim() || "Unassigned");
          } else {
            setDuplicateTeam(null);
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setDuplicateTeam(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setDuplicateChecking(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, loading, form.email, form.phone, form.country, leadId]);

  const setPhone = (raw: string, mode: "type" | "legacy" = "type") => {
    setForm((prev) => {
      const phone =
        mode === "legacy"
          ? normalizeStoredPhone(raw, prev.country)
          : normalizePhoneInput(raw);
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

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (duplicateTeam) return false;
    if (duplicateChecking) return false;
    if (!form.fullName.trim()) return false;
    if (!form.source) return false;
    if (!form.qualificationStatus) return false;
    if (portalIsOther && !form.portalOther.trim()) return false;
    return true;
  }, [form, portalIsOther, loading, duplicateTeam, duplicateChecking]);

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
      fullName: form.fullName.trim(),
      source: form.source,
      qualificationStatus: form.qualificationStatus,
      leadScore: form.leadScore,
    };
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
          "absolute inset-0 bg-[rgba(15,17,20,0.38)] backdrop-blur-md transition-opacity duration-300 ease-out",
          entered ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          "relative flex h-dvh w-full max-w-[560px] flex-col overflow-hidden border-l border-[rgba(33,37,41,0.08)] bg-white shadow-[-24px_0_80px_rgba(15,17,20,0.16)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[640px] lg:max-w-[720px]",
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
                <FieldLabel htmlFor="lead-fullName" required>
                  Full name
                </FieldLabel>
                <input
                  id="lead-fullName"
                  className={inputClass}
                  value={form.fullName}
                  onChange={(e) => set("fullName")(e.target.value)}
                  placeholder="Client full name"
                  autoFocus={!isEdit}
                  required
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
                    duplicateTeam
                      ? "border-[rgba(201,42,42,0.45)] focus-within:border-[rgba(201,42,42,0.55)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(201,42,42,0.1)]"
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
                  {duplicateTeam ? (
                    <span className="text-[#c92a2a]">
                      Already in{" "}
                      <span className="font-medium">{duplicateTeam}</span>
                    </span>
                  ) : duplicateChecking ? (
                    <span className="text-[#adb5bd]">Checking contact…</span>
                  ) : matchedDial ? (
                    <span className="text-[#868e96]">
                      Matched{" "}
                      <span className="font-medium text-[#495057]">
                        {matchedDial.name}
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
                  onChange={(value) => set("portalSelect")(value)}
                />
              </div>

              {portalIsOther ? (
                <div>
                  <FieldLabel htmlFor="lead-portal-other" required>
                    Other portal name
                  </FieldLabel>
                  <input
                    id="lead-portal-other"
                    className={inputClass}
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
                  onChange={(value) => set("source")(value)}
                />
              </div>

              <div>
                <FieldLabel htmlFor="lead-date">Date</FieldLabel>
                <input
                  id="lead-date"
                  type="date"
                  className={inputClass}
                  value={form.createdAt}
                  onChange={(e) => set("createdAt")(e.target.value)}
                  disabled={loading}
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
