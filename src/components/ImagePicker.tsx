import React, { useEffect, useRef, useState } from "react";
import type { ImageRef } from "../../shared/types";
import { getApi } from "../api";
import { bytesToDataUrl } from "../format";
import { useToast } from "./ui";

/** Loads data: URLs for a list of image refs (Electron: IPC bytes, browser: base64). */
export function useImageUrls(refs: ImageRef[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = getApi();
      const out: Record<string, string> = {};
      for (const r of refs) {
        if (urls[r.id]) {
          out[r.id] = urls[r.id];
          continue;
        }
        const img = await api.getImage(r.id).catch(() => null);
        if (img && !cancelled) out[r.id] = bytesToDataUrl(img.data, img.name);
      }
      if (!cancelled) setUrls((prev) => ({ ...prev, ...out }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(refs)]);
  return urls;
}

export function ImageGallery({ refs, testId }: { refs: ImageRef[]; testId?: string }) {
  const urls = useImageUrls(refs);
  if (refs.length === 0) return <div className="muted small">بدون تصویر</div>;
  return (
    <div className="img-gallery" data-testid={testId}>
      {refs.map((r) => (
        <figure key={r.id} className="img-thumb" data-testid="image-thumb">
          {urls[r.id] ? <img src={urls[r.id]} alt={r.name} /> : <div className="img-loading" />}
          <figcaption>{r.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ImagePicker({
  tradeId,
  value,
  onChange,
  label,
}: {
  tradeId: string;
  value: ImageRef[];
  onChange: (v: ImageRef[]) => void;
  label: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const urls = useImageUrls(value);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const api = getApi();
      const added: ImageRef[] = [];
      for (const f of Array.from(files)) {
        const buf = await f.arrayBuffer();
        const ref = await api.saveImage(tradeId, f.name, new Uint8Array(buf));
        added.push(ref);
      }
      onChange([...value, ...added]);
      toast(`${added.length} تصویر اضافه شد`);
    } catch (e) {
      toast(`خطا در ذخیره تصویر: ${(e as Error).message}`, "err");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    try {
      await getApi().deleteImage(id);
      onChange(value.filter((v) => v.id !== id));
    } catch (e) {
      toast(`خطا در حذف تصویر: ${(e as Error).message}`, "err");
    }
  };

  return (
    <div className="image-picker" data-testid="image-picker">
      <div className="field-label">{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="image-input"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <button type="button" className="btn ghost" onClick={() => inputRef.current?.click()} disabled={busy} data-testid="image-add">
        {busy ? "در حال ذخیره…" : "+ افزودن اسکرین‌شات"}
      </button>
      <div className="img-gallery">
        {value.map((r) => (
          <figure key={r.id} className="img-thumb editable" data-testid="image-thumb">
            {urls[r.id] ? <img src={urls[r.id]} alt={r.name} /> : <div className="img-loading" />}
            <figcaption>{r.name}</figcaption>
            <button type="button" className="img-remove" onClick={() => void remove(r.id)} data-testid={`image-remove-${r.id}`} title="حذف">
              ×
            </button>
          </figure>
        ))}
      </div>
    </div>
  );
}
