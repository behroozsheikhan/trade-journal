import React, { useEffect, useRef, useState } from "react";
import type { AppInfo, Settings } from "../../shared/types";
import { getApi, isElectron } from "../api";
import { downloadTextFile } from "../format";
import { Field, Section, Spinner, useToast } from "../components/ui";

export default function SettingsPage() {
  const toast = useToast();
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
    if (!window.confirm("همه معاملات حذف شوند؟ (ابتدا خروجی JSON بگیر)")) return;
    const api = getApi();
    const all = await api.listTrades();
    for (const t of all) await api.deleteTrade(t.id);
    toast("همه معاملات حذف شدند");
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
    </div>
  );
}
