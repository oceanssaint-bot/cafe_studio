import { useCallback, useEffect, useState } from 'react'
import PeriodSelector from '../components/PeriodSelector'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import { useActivity } from '../context/ActivityContext'
import type { Payslip, Emp201 } from '../../../shared/types'

type Row = Record<number, string>
const num = (v: string | undefined): number => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) ? n : 0
}

export default function PayRunPanel(): JSX.Element {
  const { oceansId } = useStoreScope()
  const { run } = useActivity()
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [staff, setStaff] = useState<Array<{ id: number; name: string; monthly_pay: number; dob: string }>>([])
  const [gross, setGross] = useState<Row>({})
  const [paye, setPaye] = useState<Row>({})
  const [uif, setUif] = useState<Row>({})
  const [other, setOther] = useState<Row>({})
  const [slips, setSlips] = useState<Payslip[]>([])
  const [emp, setEmp] = useState<Emp201 | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (oceansId == null) return
    const [st, sl, e] = await Promise.all([
      window.gloria.payrun.staff(oceansId),
      window.gloria.payrun.slips(oceansId, period),
      window.gloria.payrun.emp201(oceansId, period)
    ])
    setStaff(st)
    setSlips(sl)
    setEmp(e)
    const g: Row = {}, p: Row = {}, u: Row = {}, o: Row = {}
    for (const s of st) {
      const ex = sl.find((x) => x.staff_id === s.id)
      g[s.id] = String(ex ? ex.gross : s.monthly_pay || '')
      p[s.id] = ex ? String(ex.paye) : ''
      u[s.id] = ex ? String(ex.uif) : ''
      o[s.id] = ex && ex.other_deductions ? String(ex.other_deductions) : ''
    }
    setGross(g)
    setPaye(p)
    setUif(u)
    setOther(o)
  }, [oceansId, period])

  useEffect(() => {
    load()
  }, [load])

  if (oceansId == null) return <div />

  const lines = (): { staff_id: number; gross: number }[] =>
    staff.map((s) => ({ staff_id: s.id, gross: num(gross[s.id]) })).filter((l) => l.gross > 0)

  async function autoCalc(): Promise<void> {
    const rows = await window.gloria.payrun.preview(lines())
    const p: Row = { ...paye }, u: Row = { ...uif }
    for (const r of rows) {
      p[r.staff_id] = String(r.paye)
      u[r.staff_id] = String(r.uif)
    }
    setPaye(p)
    setUif(u)
    setMsg('PAYE & UIF auto-filled (SARS) — you can still edit any figure before saving.')
  }

  async function save(): Promise<void> {
    setBusy(true)
    setMsg(null)
    const payload = staff
      .filter((s) => num(gross[s.id]) > 0)
      .map((s) => ({
        staff_id: s.id,
        gross: num(gross[s.id]),
        paye: paye[s.id] !== '' ? num(paye[s.id]) : undefined,
        uif: uif[s.id] !== '' ? num(uif[s.id]) : undefined,
        other_deductions: num(other[s.id])
      }))
    const r = await run('Saving pay run', () => window.gloria.payrun.run(oceansId!, period, payload))
    setBusy(false)
    if (r) setMsg(`Saved ${r.count} payslip(s) — net pay ${formatZar(r.totals.net)}.`)
    load()
  }

  const liveNet = (id: number): number => num(gross[id]) - num(paye[id]) - num(uif[id]) - num(other[id])
  const slipFor = (id: number): Payslip | undefined => slips.find((s) => s.staff_id === id)

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gloria-brown dark:text-gloria-cream">Pay Run &amp; Payslips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter gross, then <strong>Auto-calc</strong> PAYE/UIF (SARS) — or type every figure by hand. Save to make payslips + EMP201.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector period={period} onChange={setPeriod} />
          <button type="button" onClick={autoCalc} className="rounded-md border border-gloria-accent px-3 py-2 text-sm font-medium text-gloria-accent hover:bg-gloria-accent hover:text-white">
            Auto-calc PAYE/UIF
          </button>
          <button type="button" disabled={busy} onClick={save} className="rounded-md bg-gloria-accent px-3 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50">
            {busy ? 'Saving…' : 'Save pay run'}
          </button>
        </div>
      </div>

      {msg && (
        <p className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {emp && slips.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="PAYE to SARS" value={formatZar(emp.paye)} />
          <Card label="UIF (emp+employer)" value={formatZar(emp.uifTotal)} />
          <Card label="SDL" value={formatZar(emp.sdl)} />
          <Card label="EMP201 total" value={formatZar(emp.total)} accent />
        </div>
      )}

      {staff.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
          No active staff. Add staff (with their monthly pay) on the Staff page first.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gloria-brown text-gloria-cream">
                <th className="px-3 py-2 text-left font-semibold">Employee</th>
                <th className="px-2 py-2 text-right font-semibold">Gross</th>
                <th className="px-2 py-2 text-right font-semibold">PAYE</th>
                <th className="px-2 py-2 text-right font-semibold">UIF</th>
                <th className="px-2 py-2 text-right font-semibold">Other</th>
                <th className="px-2 py-2 text-right font-semibold">Net</th>
                <th className="px-2 py-2 text-center font-semibold">Payslip</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {staff.map((s) => {
                const slip = slipFor(s.id)
                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{s.name}</td>
                    <NumCell value={gross[s.id]} onChange={(v) => setGross((x) => ({ ...x, [s.id]: v }))} />
                    <NumCell value={paye[s.id]} onChange={(v) => setPaye((x) => ({ ...x, [s.id]: v }))} placeholder="auto" />
                    <NumCell value={uif[s.id]} onChange={(v) => setUif((x) => ({ ...x, [s.id]: v }))} placeholder="auto" />
                    <NumCell value={other[s.id]} onChange={(v) => setOther((x) => ({ ...x, [s.id]: v }))} placeholder="0" />
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{formatZar(liveNet(s.id))}</td>
                    <td className="px-2 py-2 text-center">
                      {slip ? (
                        <span className="inline-flex gap-2">
                          <button type="button" onClick={() => window.gloria.payrun.printPayslip(slip.id)} className="text-xs text-gloria-accent hover:underline">View</button>
                          <button type="button" onClick={() => window.gloria.payrun.exportPayslip(slip.id)} className="text-xs text-gloria-accent hover:underline">PDF</button>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {slips.length > 0 && (
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => run('Exporting payslips', () => window.gloria.payrun.exportBatch(oceansId!, period))}
            className="rounded-md border border-gloria-accent px-3 py-1.5 text-xs font-medium text-gloria-accent hover:bg-gloria-accent hover:text-white"
          >
            Export all payslips (PDF)
          </button>
        </div>
      )}
    </section>
  )
}

function NumCell({ value, onChange, placeholder }: { value: string | undefined; onChange: (v: string) => void; placeholder?: string }): JSX.Element {
  return (
    <td className="px-2 py-1.5 text-right">
      <input
        inputMode="decimal"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
      />
    </td>
  )
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <div className={['rounded-lg border p-3', accent ? 'border-gloria-brown bg-gloria-brown text-gloria-cream' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'].join(' ')}>
      <p className={['text-[10px] uppercase tracking-wide', accent ? 'text-gloria-cream/70' : 'text-slate-400'].join(' ')}>{label}</p>
      <p className={['mt-0.5 text-base font-bold tabular-nums', accent ? 'text-white' : 'text-gloria-brown dark:text-gloria-cream'].join(' ')}>{value}</p>
    </div>
  )
}
