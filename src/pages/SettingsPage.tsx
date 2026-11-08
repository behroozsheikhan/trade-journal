import React, { useEffect, useRef, useState } from "react";
import type { AppInfo, ManagedItem, Settings } from "../../shared/types";
import { setupLabel } from "../../shared/labels";
import { getApi, isElectron } from "../api";
import { useJournal } from "../journal";
import { downloadTextFile } from "../format";
import { Field, Section, Spinner, useToast } from "../components/ui";

/** Add / remove / enable-disable manager for a settings list (setups, exchanges). */
function ListManager({
  title,
  hint,
  items,
  onChange,
  prefix,
  labelFn,
  testId,
}: {
  title: string;
  hint?: string;
  items: ManagedItem[];
  onChange: (items: ManagedItem[]) => void;
  prefix: string;
  labelFn?: (label: string) => string;
  testId: string;
}) {
  const [val, setVal] = useState("");
  const add = () => {
    const label = val.trim();
    if (!label) return;
    if (items.some((i) => i.label.toLowerCase() === label.toLowerCase())) return;
    onChange([...items, { id: `${Date.now()}-${label}`, label, enabled: true }]);
    setVal("");
  };
  return (
    <div className="list-manager" data-testid={testId}>
      <div className="muted small" style={{ marginBottom: 6 }}>
        {title} {hint ? `— ${hint}` : ""}
      </div>
      {items.map((it, i) => (
        <div className="list-row" key={it.id} data-testid={`${prefix}-row-${i}`}>
          <label className="list-row-label">
            <input
              type="checkbox"
              checked={it.enabled}
              onChange={() => onChange(items.map((x) => (x.id === it.id ? { ...x, enabled: !x.enabled } : x)))}
              data-testid={`${prefix}-toggle-${i}`}
            />
            <span className={it.enabled ? "" : "muted"}>{labelFn ? labelFn(it.label) : it.label}</span>
          </label>
          <button
            className="btn ghost small danger"
            onClick={() => onChange(items.filter((x) => x.id !== it.id))}
            data-testid={`${prefix}-delete-${i}`}
            title="حذف"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="list-row list-row-add">
        <input
          className="input"
          placeholder="افزودن مورد جدید…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          data-testid={`${prefix}-new-input`}
        />
        <button className="btn small" onClick={add} data-testid={`btn-add-${prefix}`}>
          افزودن
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { activeId } = useJournal();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const api = getApi();
    void api.getSettings().then(setSettings);
    void api.appInfo().then(setInfo);
  }, []);

  const save = async () => {
    if (!settings) return;
    await getApi().setSettings(settings);
    toast("تنظیمات ذخیره شد");
  };

  const exportData = async (format: "json" | "csv") => {
    const res = await getApi().exportData(format);
    if (!res.ok) return;
    if (res.content && !isElectron()) {
      downloadTextFile(`trade-journal-${new Date().toISOString().slice(0, 10)}.${format}`, res.content, format === "csv" ? "text/csv" : "application/json");
      toast("فایل خروجی دانلود شد");
    } else if (res.path) {
      toast(`ذخیره شد: ${res.path}`);
    }
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const res = await getApi().importDataString(text);
    toast(`${res.imported} معامله وارد شد`);
    window.location.reload();
  };

  const doBackup = async () => {
    const res = await getApi().backup();
    toast(res.ok ? `بکاپ گرفته شد: ${res.path}` : "بکاپ ناموفق بود", res.ok ? "ok" : "err");
  };

  const wipeAll = async () => {
    if (!window.confirm("همه معاملات ژورنال فعلی حذف شوند؟ (ابتدا خروجی JSON بگیر)")) return;
    const api = getApi();
    const all = await api.listTrades(activeId ? { journalId: activeId } : undefined);
    for (const t of all) await api.deleteTrade(t.id);
    toast("معاملات این ژورنال حذف شدند");
    window.location.reload();
  };

  if (!settings) return <Spinner />;

  return (
    <div className="page" data-testid="settings-page">
      <div className="page-head">
        <h1>تنظیمات</h1>
        <button className="btn primary" onClick={() => void save()} data-testid="btn-save-settings">
          ذخیره تنظیمات
        </button>
      </div>

      <div className="two-col">
        <Section title="حساب و ریسک" subtitle="برای محاسبه درصد ریسک و پیشنهاد حجم استفاده می‌شود" testId="sec-account">
          <div className="form-grid">
            <Field label="موجودی حساب (Account balance)">
              <input type="number" step="any" className="input mono" value={settings.accountBalance} onChange={(e) => setSettings({ ...settings, accountBalance: Number(e.target.value) || 0 })} data-testid="set-balance" />
            </Field>
            <Field label="ارز مبنا (Base currency)">
              <input className="input mono" value={settings.baseCurrency} onChange={(e) => setSettings({ ...settings, baseCurrency: e.target.value.toUpperCase() })} data-testid="set-currency" />
            </Field>
            <Field label="ریسک پیش‌فرض هر معامله (%)">
              <input type="number" step="any" min={0} className="input mono" value={settings.defaultRiskPercent} onChange={(e) => setSettings({ ...settings, defaultRiskPercent: Number(e.target.value) || 0 })} data-testid="set-risk" />
            </Field>
            <Field label="نرخ مارجین نگهداری (maintenance margin)" hint="برای محاسبه قیمت approx. liquidation — معمولاً 0.005">
              <input type="number" step="any" className="input mono" value={settings.maintenanceMarginRate} onChange={(e) => setSettings({ ...settings, maintenanceMarginRate: Number(e.target.value) || 0 })} data-testid="set-mmr" />
            </Field>
            <Field label="کارمزد taker">
              <input type="number" step="any" className="input mono" value={settings.takerFeeRate} onChange={(e) => setSettings({ ...settings, takerFeeRate: Number(e.target.value) || 0 })} data-testid="set-taker" />
            </Field>
            <Field label="کارمزد maker">
              <input type="number" step="any" className="input mono" value={settings.makerFeeRate} onChange={(e) => setSettings({ ...settings, makerFeeRate: Number(e.target.value) || 0 })} data-testid="set-maker" />
            </Field>
            <Field label="پوسته (Theme)">
              <select className="input" value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value as Settings["theme"] })} data-testid="set-theme">
                <option value="dark">تیره (Dark)</option>
                <option value="light">روشن (Light)</option>
              </select>
            </Field>
            <Field label="فرمت ذخیره اسکرین‌شات‌ها" hint="webp حجم بسیار کمتری دارد (معمولاً ۵ تا ۱۰ برابر کوچک‌تر از PNG)">
              <select className="input" value={settings.imageFormat} onChange={(e) => setSettings({ ...settings, imageFormat: e.target.value as Settings["imageFormat"] })} data-testid="set-image-format">
                <option value="original">فرمت اصلی فایل (PNG/JPG…)</option>
                <option value="webp">WebP (کم‌حجم)</option>
              </select>
            </Field>
            <Field label="کیفیت WebP (0 تا 1)" hint="0.8 یعنی ۸۰٪ — تعادل خوب بین کیفیت و حجم">
              <input type="number" step="0.05" min={0.1} max={1} className="input mono" value={settings.webpQuality} onChange={(e) => setSettings({ ...settings, webpQuality: Number(e.target.value) || 0.8 })} data-testid="set-webp-quality" />
            </Field>
          </div>
        </Section>

        <Section title="داده‌ها" subtitle="همه داده‌ها فقط روی دستگاه تو ذخیره می‌شوند (SQLite در userData)" testId="sec-data">
          <div className="btn-col">
            <button className="btn" onClick={() => void exportData("json")} data-testid="btn-export-json">خروجی JSON کامل (با تصاویر)</button>
            <button className="btn" onClick={() => void exportData("csv")} data-testid="btn-export-csv">خروجی CSV (برای Excel)</button>
            {isElectron() ? (
              <button className="btn" onClick={() => void getApi().importData().then((r) => r.ok && toast(`${r.imported} معامله وارد شد`))} data-testid="btn-import">
                Import از فایل JSON…
              </button>
            ) : (
              <>
                <input ref={fileRef} type="file" accept=".json,application/json" hidden data-testid="import-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
                <button className="btn" onClick={() => fileRef.current?.click()} data-testid="btn-import">Import از فایل JSON…</button>
              </>
            )}
            <button className="btn" onClick={() => void doBackup()} data-testid="btn-backup">بكاپ دیتابیس</button>
            <button className="btn danger" onClick={() => void wipeAll()} data-testid="btn-wipe">حذف همه معاملات</button>
          </div>
          {info && (
            <div className="kv" style={{ marginTop: 16 }} data-testid="app-info">
              <span className="kv-label">نسخه</span>
              <span className="kv-value mono">{info.version}</span>
              <span className="kv-label">مسیر دیتابیس</span>
              <span className="kv-value mono small">{info.dbPath}</span>
              <span className="kv-label">پلتفرم</span>
              <span className="kv-value mono">{info.platform}</span>
            </div>
          )}
        </Section>
      </div>

      <Section title="لیست‌های قابل مدیریت (ستاپ و صرافی)" subtitle="موارد این لیست‌ها در فرم معامله به‌صورت دراپ‌داون نمایش داده می‌شوند؛ می‌توانید اضافه، حذف یا غیرفعال کنید" testId="sec-lists">
        <div className="two-col">
          <ListManager
            title="ستاپ‌ها (Setup)"
            hint="مثلاً breakout"
            items={settings.setups}
            onChange={(setups) => setSettings({ ...settings, setups })}
            prefix="setup"
            labelFn={setupLabel}
            testId="manager-setups"
          />
          <ListManager
            title="صرافی‌ها (Exchange)"
            hint="مثلاً Binance"
            items={settings.exchanges}
            onChange={(exchanges) => setSettings({ ...settings, exchanges })}
            prefix="exchange"
            testId="manager-exchanges"
          />
        </div>
      </Section>
    </div>
  );
}
