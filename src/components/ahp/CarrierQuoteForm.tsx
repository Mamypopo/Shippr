"use client";

import { computeCost, type QuoteInput } from "@/lib/cost";
import { formatUsd } from "@/lib/format";

export interface QuoteDraft extends QuoteInput {
  containerType: string;
}

export function emptyQuote(index: number): QuoteDraft {
  return {
    id: `quote-${index}-${Math.random().toString(36).slice(2, 8)}`,
    carrierName: "",
    serviceName: "",
    oceanFreightUsd: 0,
    localChargesUsd: 0,
    freeTimeDays: 7,
    freeTimeValuePerDayUsd: 25,
    transitDays: 30,
    isDirect: true,
    transshipmentCount: 0,
    onTimePct: 75,
    blankSailingsPerQuarter: 0,
    equipmentAvailabilityScore: 5,
    bookingSlaHours: 24,
    docTurnaroundHours: 24,
    serviceScore: 5,
    containerType: "40HC",
  };
}

/**
 * Quotation entry, one column per carrier.
 *
 * Laid out as a column rather than a stacked form so a coordinator reads it
 * the way they read the quotes themselves: side by side, one field at a time
 * across all carriers.
 */
export function CarrierQuoteForm({
  quotes,
  onChange,
  onRemove,
  onAdd,
}: {
  quotes: QuoteDraft[];
  onChange: (id: string, patch: Partial<QuoteDraft>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="plan" aria-label="ใบเสนอราคาสายเรือ">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2">
        <h3 className="text-small font-medium">ใบเสนอราคา</h3>
        <span className="slot-address">{quotes.length}/5 สายเรือ</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {quotes.map((quote, index) => (
          <QuoteColumn
            key={quote.id}
            quote={quote}
            index={index}
            canRemove={quotes.length > 2}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>

      {quotes.length < 5 && (
        <div className="border-t border-rule px-4 py-3">
          <button
            type="button"
            onClick={onAdd}
            className="border border-rule-heavy bg-plan px-3 py-1.5 text-small hover:bg-plan-sunk"
          >
            เพิ่มสายเรือ
          </button>
        </div>
      )}
    </section>
  );
}

function QuoteColumn({
  quote,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  quote: QuoteDraft;
  index: number;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<QuoteDraft>) => void;
  onRemove: (id: string) => void;
}) {
  const cost = computeCost(quote);

  return (
    <article className="border-t border-rule p-4 first:border-t-0 md:border-l md:[&:nth-child(2n+1)]:border-l-0 xl:[&:nth-child(2n+1)]:border-l xl:[&:nth-child(3n+1)]:border-l-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="slot-address">สายที่ {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(quote.id)}
            className="text-micro text-hull-faint underline underline-offset-2 hover:text-hazard"
          >
            ลบ
          </button>
        )}
      </div>

      <Field label="สายเรือ">
        <input
          type="text"
          value={quote.carrierName}
          onChange={(e) => onChange(quote.id, { carrierName: e.target.value })}
          placeholder="เช่น Maersk"
          className="w-full px-2 py-1 text-small"
        />
      </Field>

      <Field label="ชื่อ service">
        <input
          type="text"
          value={quote.serviceName ?? ""}
          onChange={(e) => onChange(quote.id, { serviceName: e.target.value })}
          placeholder="เช่น AE7"
          className="w-full px-2 py-1 text-small"
        />
      </Field>

      <FieldGroup title="ต้นทุน">
        <NumberField
          label="Ocean freight"
          suffix="USD"
          value={quote.oceanFreightUsd}
          onChange={(v) => onChange(quote.id, { oceanFreightUsd: v })}
        />
        <NumberField
          label="Local charges"
          suffix="USD"
          value={quote.localChargesUsd}
          onChange={(v) => onChange(quote.id, { localChargesUsd: v })}
        />
        <NumberField
          label="Free time"
          suffix="วัน"
          value={quote.freeTimeDays}
          onChange={(v) => onChange(quote.id, { freeTimeDays: v })}
        />
        <NumberField
          label="มูลค่า free time ต่อวัน"
          suffix="USD"
          value={quote.freeTimeValuePerDayUsd}
          onChange={(v) => onChange(quote.id, { freeTimeValuePerDayUsd: v })}
        />
      </FieldGroup>

      {/* Making the credit visible is the point: it is why a dearer headline
          rate can still be the cheaper booking. */}
      <p className="mt-1 border-t border-rule pt-2 text-micro text-hull-soft">
        ต้นทุนรวม <span className="tnum">{formatUsd(cost.grossCostUsd)}</span>
        {cost.freeTimeCreditUsd > 0 && (
          <>
            {" "}
            − free time <span className="tnum">{formatUsd(cost.freeTimeCreditUsd)}</span> ={" "}
            <span className="tnum font-medium text-hull">
              {formatUsd(cost.effectiveCostUsd)}
            </span>
          </>
        )}
      </p>

      <FieldGroup title="ระยะเวลา">
        <NumberField
          label="Transit time"
          suffix="วัน"
          value={quote.transitDays}
          onChange={(v) => onChange(quote.id, { transitDays: v })}
        />
        <label className="flex items-center gap-2 text-small">
          <input
            type="checkbox"
            checked={quote.isDirect}
            onChange={(e) =>
              onChange(quote.id, {
                isDirect: e.target.checked,
                transshipmentCount: e.target.checked ? 0 : Math.max(1, quote.transshipmentCount),
              })
            }
          />
          เรือตรง ไม่ถ่ายลำ
        </label>
        {!quote.isDirect && (
          <NumberField
            label="จำนวนครั้งที่ถ่ายลำ"
            value={quote.transshipmentCount}
            onChange={(v) => onChange(quote.id, { transshipmentCount: v })}
          />
        )}
      </FieldGroup>

      <FieldGroup title="ความตรงต่อเวลา">
        <NumberField
          label="On-time"
          suffix="%"
          value={quote.onTimePct}
          onChange={(v) => onChange(quote.id, { onTimePct: v })}
        />
        <NumberField
          label="Blank sailing ต่อไตรมาส"
          value={quote.blankSailingsPerQuarter}
          onChange={(v) => onChange(quote.id, { blankSailingsPerQuarter: v })}
        />
      </FieldGroup>

      <FieldGroup title="ระวางและตู้">
        <ScoreField
          label="ความพร้อมตู้เปล่า"
          value={quote.equipmentAvailabilityScore}
          onChange={(v) => onChange(quote.id, { equipmentAvailabilityScore: v })}
        />
        <NumberField
          label="ตอบยืนยัน booking ภายใน"
          suffix="ชม."
          value={quote.bookingSlaHours}
          onChange={(v) => onChange(quote.id, { bookingSlaHours: v })}
        />
      </FieldGroup>

      <FieldGroup title="บริการและเอกสาร">
        <NumberField
          label="ออก draft B/L ภายใน"
          suffix="ชม."
          value={quote.docTurnaroundHours}
          onChange={(v) => onChange(quote.id, { docTurnaroundHours: v })}
        />
        <ScoreField
          label="คุณภาพการบริการ"
          value={quote.serviceScore}
          onChange={(v) => onChange(quote.id, { serviceScore: v })}
        />
      </FieldGroup>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="block text-micro text-hull-faint">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-4 border-t border-rule pt-2">
      <legend className="sr-only">{title}</legend>
      <p className="text-micro font-medium text-hull-soft">{title}</p>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </fieldset>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-baseline justify-between gap-2 text-small">
      <span className="text-hull-soft">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tnum w-24 px-2 py-1 text-right text-small"
        />
        {suffix && <span className="w-8 text-micro text-hull-faint">{suffix}</span>}
      </span>
    </label>
  );
}

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-baseline justify-between gap-2 text-small">
      <span className="text-hull-soft">{label}</span>
      <span className="flex items-baseline gap-2">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 accent-[var(--color-hull)]"
        />
        <span className="tnum w-6 text-right">{value}</span>
      </span>
    </label>
  );
}
