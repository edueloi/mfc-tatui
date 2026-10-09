import { useRef, useEffect, useCallback, useState } from "react";
import { LinkDialog, ImageDialog, type ImageFloat } from "./EditorDialogs";

/* ─── tipos ──────────────────────────────────────────────────────────────── */
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}



/* ─── constantes ─────────────────────────────────────────────────────────── */
const FONT_SIZES = ["10","11","12","13","14","16","18","20","24","28","32","36","48","64"];
const FONT_FAMILIES = [
  { label: "Padrão", value: "inherit" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];
const TEXT_COLORS = [
  "#000000","#374151","#6b7280","#9ca3af","#ffffff",
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16",
  "#22c55e","#10b981","#06b6d4","#3b82f6","#6366f1",
  "#8b5cf6","#ec4899","#f43f5e",
];
const HIGHLIGHT_COLORS = [
  "transparent","#fef9c3","#fde68a","#fecaca","#bbf7d0",
  "#bfdbfe","#e9d5ff","#fce7f3","#ffedd5","#d1fae5",
];

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function ToolBtn({ title, active, onClick, children, style }: {
  title: string; active?: boolean; onClick: () => void;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      aria-label={title}
      className="ui-editor-tool"
      style={{
        width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "#2563eb" : "transparent",
        color: active ? "#fff" : "#374151",
        fontSize: 13, fontWeight: 500, flexShrink: 0,
        transition: "background 0.12s",
        ...style,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

function TDivider() {
  return <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0, margin: "0 2px" }} />;
}

/* ─── Color Picker Popup ─────────────────────────────────────────────────── */
function ColorPicker({ colors, onPick, onClose }: {
  colors: string[]; onPick: (c: string) => void; onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute", top: "100%", left: 0, zIndex: 200, marginTop: 4,
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        display: "flex", flexWrap: "wrap", gap: 4, width: 188,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {colors.map(c => (
        <button
          key={c} type="button"
          onMouseDown={e => { e.preventDefault(); onPick(c); onClose(); }}
          style={{
            width: 20, height: 20, borderRadius: 4, cursor: "pointer",
            background: c === "transparent" ? "#fff" : c,
            border: c === "transparent" ? "2px solid #e5e7eb" : "1px solid rgba(0,0,0,0.1)",
            position: "relative",
          }}
          title={c}
        >
          {c === "transparent" && (
            <span style={{ position: "absolute", inset: 1, background: "linear-gradient(to bottom right, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)" }} />
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Image Resize Overlay ───────────────────────────────────────────────── */
// Rendered as a portal-like overlay on top of the selected image
interface ResizeState {
  img: HTMLImageElement;
  x: number; y: number; w: number; h: number;
}

/* ─── Main Editor ────────────────────────────────────────────────────────── */
export function RichTextEditor({ value, onChange, placeholder = "Comece a escrever...", minHeight = 400 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const savedSelection = useRef<Range | null>(null);
  const saveSelection = () => {
    const selection = window.getSelection();
    savedSelection.current = selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)
      ? selection.getRangeAt(0).cloneRange() : null;
  };
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = savedSelection.current || document.createRange();
    if (!savedSelection.current) { range.selectNodeContents(editor); range.collapse(false); }
    selection?.removeAllRanges(); selection?.addRange(range);
  };

  const [showTextColors, setShowTextColors] = useState(false);
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);

  // ── Image resize state
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgRect, setImgRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const resizingRef = useRef<{ handle: string; startX: number; startY: number; startW: number; startH: number; img: HTMLImageElement } | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; origLeft: string; origTop: string; img: HTMLImageElement } | null>(null);

  // Sincroniza valor externo → editor
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalChange.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  // ── Update overlay position when selectedImg changes or window scrolls
  const updateOverlay = useCallback(() => {
    if (!selectedImg || !wrapRef.current) return;
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const imgRect = selectedImg.getBoundingClientRect();
    setImgRect({
      x: imgRect.left - wrapRect.left,
      y: imgRect.top - wrapRect.top,
      w: imgRect.width,
      h: imgRect.height,
    });
  }, [selectedImg]);

  useEffect(() => {
    if (!selectedImg) return;
    updateOverlay();
    const obs = new ResizeObserver(updateOverlay);
    obs.observe(selectedImg);
    window.addEventListener("scroll", updateOverlay, true);
    return () => { obs.disconnect(); window.removeEventListener("scroll", updateOverlay, true); };
  }, [selectedImg, updateOverlay]);

  // ── Click on image inside editor → select it
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        e.preventDefault();
        setSelectedImg(target as HTMLImageElement);
      } else {
        setSelectedImg(null);
        setImgRect(null);
      }
    };
    editor.addEventListener("click", onClick);
    return () => editor.removeEventListener("click", onClick);
  }, []);

  // ── Resize drag (handles)
  const startResize = useCallback((e: React.MouseEvent, handle: string) => {
    if (!selectedImg) return;
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: selectedImg.offsetWidth,
      startH: selectedImg.offsetHeight,
      img: selectedImg,
    };

    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const dx = ev.clientX - r.startX;
      const dy = ev.clientY - r.startY;
      let newW = r.startW;
      let newH = r.startH;
      const ratio = r.startH / r.startW;

      if (r.handle.includes("e"))  newW = Math.max(40, r.startW + dx);
      if (r.handle.includes("w"))  newW = Math.max(40, r.startW - dx);
      if (r.handle.includes("s"))  newH = Math.max(40, r.startH + dy);
      if (r.handle.includes("n"))  newH = Math.max(40, r.startH - dy);

      // If corner: maintain aspect ratio based on width
      if (r.handle.length === 2) newH = newW * ratio;

      r.img.style.width  = newW + "px";
      r.img.style.height = newH + "px";
      updateOverlay();
    };

    const onUp = () => {
      resizingRef.current = null;
      handleInput();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [selectedImg, updateOverlay, handleInput]);

  // ── Move drag (image drag within float containers)
  const startMove = useCallback((e: React.MouseEvent) => {
    if (!selectedImg) return;
    // Only allow move for floating images (left/right)
    const fl = selectedImg.style.float;
    if (fl !== "left" && fl !== "right") return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const origMarginLeft  = selectedImg.style.marginLeft  || "0px";
    const origMarginTop   = selectedImg.style.marginTop   || "0px";
    const startML = parseInt(origMarginLeft)  || 0;
    const startMT = parseInt(origMarginTop)   || 0;

    const onMove = (ev: MouseEvent) => {
      if (!selectedImg) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      selectedImg.style.marginLeft = (startML + dx) + "px";
      selectedImg.style.marginTop  = (startMT + dy) + "px";
      updateOverlay();
    };

    const onUp = () => {
      draggingRef.current = null;
      handleInput();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [selectedImg, updateOverlay, handleInput]);

  // ── Deselect on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // Don't deselect if clicking on overlay/handles
      if (t.closest?.("[data-img-overlay]")) return;
      if (t.tagName === "IMG" && editorRef.current?.contains(t)) return;
      setSelectedImg(null);
      setImgRect(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // ── Close color pickers on outside click
  useEffect(() => {
    const close = () => { setShowTextColors(false); setShowHighlightColors(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const insertShape = (shape: string) => {
    const shapes: Record<string, string> = {
      divider: `<hr style="border:none;border-top:2px solid #e5e7eb;margin:20px 0;" />`,
      callout: `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="margin:0;font-size:14px;color:#374151;">💡 <strong>Dica:</strong> Escreva sua observação aqui...</p></div>`,
      info: `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="margin:0;font-size:14px;color:#1e40af;">ℹ️ <strong>Informação:</strong> Texto informativo aqui...</p></div>`,
      warning: `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="margin:0;font-size:14px;color:#991b1b;">⚠️ <strong>Atenção:</strong> Mensagem de alerta aqui...</p></div>`,
      success: `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="margin:0;font-size:14px;color:#14532d;">✅ <strong>Sucesso:</strong> Mensagem positiva aqui...</p></div>`,
      quote: `<blockquote style="border-left:3px solid #f59e0b;padding:12px 20px;background:#fffbeb;margin:16px 0;border-radius:0 8px 8px 0;font-style:italic;color:#374151;">Insira sua citação aqui...</blockquote>`,
      code: `<pre style="background:#1e293b;color:#e2e8f0;padding:20px;border-radius:12px;font-family:monospace;font-size:13px;overflow-x:auto;margin:16px 0;"><code>// Seu código aqui</code></pre>`,
      table: `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr><th style="background:#f9fafb;padding:10px 14px;text-align:left;border:1px solid #e5e7eb;font-size:12px;font-weight:700;color:#374151;">Coluna 1</th><th style="background:#f9fafb;padding:10px 14px;text-align:left;border:1px solid #e5e7eb;font-size:12px;font-weight:700;color:#374151;">Coluna 2</th><th style="background:#f9fafb;padding:10px 14px;text-align:left;border:1px solid #e5e7eb;font-size:12px;font-weight:700;color:#374151;">Coluna 3</th></tr></thead><tbody><tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px;">Dado 1</td><td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px;">Dado 2</td><td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px;">Dado 3</td></tr></tbody></table>`,
    };
    const html = shapes[shape];
    if (html) { exec("insertHTML", html); handleInput(); }
  };

  const insertLink = (url: string, text: string) => {
    restoreSelection();
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text || url;
    link.style.cssText = 'color:#2563eb;font-weight:500;';
    exec('insertHTML', link.outerHTML);
    handleInput();
  };

  const insertImage = (url: string, alt: string, width: string, float: ImageFloat) => {
    restoreSelection();
    let style = "";
    if (float === "left") {
      style = `float:left;width:${width};margin:4px 20px 8px 0;border-radius:10px;cursor:pointer;`;
    } else if (float === "right") {
      style = `float:right;width:${width};margin:4px 0 8px 20px;border-radius:10px;cursor:pointer;`;
    } else if (float === "center") {
      style = `display:block;margin:12px auto;width:${width};border-radius:10px;cursor:pointer;`;
    } else {
      style = `display:block;width:${width};border-radius:10px;margin:12px 0;cursor:pointer;`;
    }
    const image = document.createElement('img');
    image.src = url; image.alt = alt; image.style.cssText = style;
    const html = (float === "left" || float === "right")
      ? `<p style="overflow:hidden;">${image.outerHTML}&nbsp;</p>` : image.outerHTML;
    exec("insertHTML", html);
    handleInput();
  };

  // ── Delete selected image
  const deleteSelectedImg = () => {
    if (!selectedImg) return;
    selectedImg.parentElement?.remove?.();
    if (selectedImg.parentElement) {
      selectedImg.remove();
    }
    setSelectedImg(null);
    setImgRect(null);
    handleInput();
  };

  // ── Change float of selected image
  const changeImgFloat = (f: ImageFloat) => {
    if (!selectedImg) return;
    if (f === "left") {
      selectedImg.style.float = "left";
      selectedImg.style.display = "";
      selectedImg.style.margin = "4px 20px 8px 0";
    } else if (f === "right") {
      selectedImg.style.float = "right";
      selectedImg.style.display = "";
      selectedImg.style.margin = "4px 0 8px 20px";
    } else if (f === "center") {
      selectedImg.style.float = "none";
      selectedImg.style.display = "block";
      selectedImg.style.margin = "12px auto";
    } else {
      selectedImg.style.float = "none";
      selectedImg.style.display = "block";
      selectedImg.style.margin = "12px 0";
    }
    updateOverlay();
    handleInput();
  };

  // ── Resize handles: positions (n/s/e/w/ne/nw/se/sw)
  const handles = [
    { id: "n",  top: -5,  left: "50%", transform: "translateX(-50%)", cursor: "n-resize" },
    { id: "s",  top: "calc(100% - 5px)", left: "50%", transform: "translateX(-50%)", cursor: "s-resize" },
    { id: "e",  top: "50%", left: "calc(100% - 5px)", transform: "translateY(-50%)", cursor: "e-resize" },
    { id: "w",  top: "50%", left: -5, transform: "translateY(-50%)", cursor: "w-resize" },
    { id: "nw", top: -5,  left: -5,  cursor: "nw-resize" },
    { id: "ne", top: -5,  left: "calc(100% - 5px)", cursor: "ne-resize" },
    { id: "sw", top: "calc(100% - 5px)", left: -5, cursor: "sw-resize" },
    { id: "se", top: "calc(100% - 5px)", left: "calc(100% - 5px)", cursor: "se-resize" },
  ];

  const imgFloat = selectedImg?.style.float as ImageFloat | undefined;

  return (
    <div ref={wrapRef} style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden", background: "#fff", fontFamily: "inherit", position: "relative" }}>
      {/* ── Toolbar ── */}
      <div style={{
        background: "#fafafa", borderBottom: "1px solid #e5e7eb",
        padding: "4px 6px", display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center",
      }}>

        {/* Headings */}
        <select
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { exec("formatBlock", e.target.value); e.target.value = "p"; }}
          defaultValue="p"
          style={{ height: 28, padding: "0 6px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 500, cursor: "pointer", background: "#fff", color: "#374151", flexShrink: 0 }}
        >
          <option value="p">Parágrafo</option>
          <option value="h1">H1 — Título</option>
          <option value="h2">H2 — Subtítulo</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
          <option value="blockquote">Citação</option>
          <option value="pre">Código</option>
        </select>

        <TDivider />

        {/* Font family */}
        <select
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { exec("fontName", e.target.value); }}
          defaultValue="inherit"
          style={{ height: 28, padding: "0 6px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 12, cursor: "pointer", background: "#fff", color: "#374151", flexShrink: 0, maxWidth: 120 }}
        >
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Font size */}
        <select
          onMouseDown={e => e.stopPropagation()}
          onChange={e => {
            const size = parseInt(e.target.value);
            exec("insertHTML", `<span style="font-size:${size}px;">\u200B</span>`);
          }}
          defaultValue=""
          style={{ height: 28, padding: "0 4px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 12, cursor: "pointer", background: "#fff", color: "#374151", flexShrink: 0, width: 56 }}
        >
          <option value="" disabled>Tam</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
        </select>

        <TDivider />

        <ToolBtn title="Negrito (Ctrl+B)" onClick={() => exec("bold")}><strong>B</strong></ToolBtn>
        <ToolBtn title="Itálico (Ctrl+I)" onClick={() => exec("italic")}><em style={{ fontStyle: "italic" }}>I</em></ToolBtn>
        <ToolBtn title="Sublinhado (Ctrl+U)" onClick={() => exec("underline")}><span style={{ textDecoration: "underline" }}>U</span></ToolBtn>
        <ToolBtn title="Tachado" onClick={() => exec("strikeThrough")}><span style={{ textDecoration: "line-through" }}>S</span></ToolBtn>

        <TDivider />

        {/* Text color */}
        <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
          <button type="button" title="Cor do texto"
            onMouseDown={e => { e.preventDefault(); setShowTextColors(v => !v); setShowHighlightColors(false); }}
            style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, flexShrink: 0 }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: "#374151", lineHeight: 1 }}>A</span>
            <span style={{ width: 14, height: 3, background: "#f59e0b", borderRadius: 2 }} />
          </button>
          {showTextColors && (
            <ColorPicker colors={TEXT_COLORS} onPick={c => { exec("foreColor", c); handleInput(); }} onClose={() => setShowTextColors(false)} />
          )}
        </div>

        {/* Highlight color */}
        <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
          <button type="button" title="Cor de destaque (grifo)"
            onMouseDown={e => { e.preventDefault(); setShowHighlightColors(v => !v); setShowTextColors(false); }}
            style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, flexShrink: 0 }}
          >
            <span style={{ fontSize: 11, lineHeight: 1 }}>🖊</span>
            <span style={{ width: 14, height: 3, background: "#fef08a", borderRadius: 2 }} />
          </button>
          {showHighlightColors && (
            <ColorPicker colors={HIGHLIGHT_COLORS}
              onPick={c => { if (c === "transparent") exec("removeFormat"); else exec("hiliteColor", c); handleInput(); }}
              onClose={() => setShowHighlightColors(false)}
            />
          )}
        </div>

        <TDivider />

        {/* Alignment */}
        <ToolBtn title="Alinhar à esquerda" onClick={() => exec("justifyLeft")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="5.5" width="8" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="12.5" width="6" height="1.5" rx="0.75" fill="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Centralizar" onClick={() => exec("justifyCenter")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="5.5" width="8" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="4" y="12.5" width="6" height="1.5" rx="0.75" fill="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Alinhar à direita" onClick={() => exec("justifyRight")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="5" y="5.5" width="8" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="7" y="12.5" width="6" height="1.5" rx="0.75" fill="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Justificar" onClick={() => exec("justifyFull")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="5.5" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="12.5" width="12" height="1.5" rx="0.75" fill="currentColor"/></svg>
        </ToolBtn>

        <TDivider />

        {/* Lists */}
        <ToolBtn title="Lista com marcadores" onClick={() => exec("insertUnorderedList")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="2" cy="3.5" r="1.2" fill="currentColor"/><rect x="5" y="2.5" width="8" height="2" rx="1" fill="currentColor"/><circle cx="2" cy="7" r="1.2" fill="currentColor"/><rect x="5" y="6" width="8" height="2" rx="1" fill="currentColor"/><circle cx="2" cy="10.5" r="1.2" fill="currentColor"/><rect x="5" y="9.5" width="8" height="2" rx="1" fill="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Lista numerada" onClick={() => exec("insertOrderedList")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><text x="1" y="4.5" fontSize="4" fontWeight="bold" fill="currentColor">1.</text><rect x="5" y="2.5" width="8" height="2" rx="1" fill="currentColor"/><text x="1" y="8.5" fontSize="4" fontWeight="bold" fill="currentColor">2.</text><rect x="5" y="6.5" width="8" height="2" rx="1" fill="currentColor"/><text x="1" y="12.5" fontSize="4" fontWeight="bold" fill="currentColor">3.</text><rect x="5" y="10.5" width="8" height="2" rx="1" fill="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Aumentar recuo" onClick={() => exec("indent")}>→</ToolBtn>
        <ToolBtn title="Diminuir recuo" onClick={() => exec("outdent")}>←</ToolBtn>

        <TDivider />

        {/* Link */}
        <ToolBtn title="Inserir hiperlink" onClick={() => { saveSelection(); setShowLinkDialog(true); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </ToolBtn>
        <ToolBtn title="Remover link" onClick={() => exec("unlink")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444"/></svg>
        </ToolBtn>
        <ToolBtn title="Inserir imagem" onClick={() => { saveSelection(); setShowImageDialog(true); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </ToolBtn>

        <TDivider />

        {/* Shapes / Blocks */}
        <select
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { const v = e.target.value; if (v) { insertShape(v); e.target.value = ""; } }}
          defaultValue=""
          style={{ height: 28, padding: "0 6px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 11, cursor: "pointer", background: "#fff", color: "#374151", flexShrink: 0, maxWidth: 110 }}
        >
          <option value="" disabled>+ Bloco</option>
          <option value="divider">— Divisor</option>
          <option value="callout">💡 Dica</option>
          <option value="info">ℹ️ Info</option>
          <option value="warning">⚠️ Alerta</option>
          <option value="success">✅ Sucesso</option>
          <option value="quote">❝ Citação</option>
          <option value="code">{ } Código</option>
          <option value="table">⊞ Tabela</option>
        </select>

        <TDivider />

        <ToolBtn title="Remover formatação" onClick={() => exec("removeFormat")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/><line x1="20" y1="20" x2="4" y2="4" stroke="#ef4444"/></svg>
        </ToolBtn>
        <TDivider />
        <ToolBtn title="Desfazer (Ctrl+Z)" onClick={() => exec("undo")}>↩</ToolBtn>
        <ToolBtn title="Refazer (Ctrl+Y)" onClick={() => exec("redo")}>↪</ToolBtn>
      </div>

      {/* ── Content area ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={e => {
          if (e.key === "Tab") { e.preventDefault(); exec("insertHTML", "&nbsp;&nbsp;&nbsp;&nbsp;"); handleInput(); }
          if (e.key === "Delete" || e.key === "Backspace") {
            if (selectedImg) { e.preventDefault(); deleteSelectedImg(); }
          }
        }}
        data-placeholder={placeholder}
        style={{
          minHeight, padding: "20px 24px", outline: "none",
          fontSize: 14, lineHeight: 1.75, color: "#374151",
          fontFamily: "inherit",
        }}
        className="rich-editor-content"
      />

      {/* ── Image resize/move overlay ── */}
      {selectedImg && imgRect && (
        <div
          data-img-overlay="true"
          style={{
            position: "absolute",
            left: imgRect.x,
            top: imgRect.y,
            width: imgRect.w,
            height: imgRect.h,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {/* Selection border */}
          <div style={{
            position: "absolute", inset: 0,
            border: "2px solid #2563eb",
            borderRadius: 4,
            pointerEvents: "none",
          }} />

          {/* Move cursor area (center) — only for floated images */}
          {(imgFloat === "left" || imgFloat === "right") && (
            <div
              data-img-overlay="true"
              style={{
                position: "absolute", inset: 8,
                cursor: "move",
                pointerEvents: "all",
              }}
              onMouseDown={startMove}
            />
          )}

          {/* Resize handles */}
          {handles.map(h => (
            <div
              key={h.id}
              data-img-overlay="true"
              onMouseDown={e => startResize(e, h.id)}
              style={{
                position: "absolute",
                top: h.top,
                left: h.left,
                transform: h.transform,
                width: 10, height: 10,
                borderRadius: 2,
                background: "#fff",
                border: "2px solid #2563eb",
                cursor: h.cursor,
                pointerEvents: "all",
                zIndex: 11,
              }}
            />
          ))}

          {/* Floating toolbar */}
          <div
            data-img-overlay="true"
            style={{
              position: "absolute",
              top: imgRect.h + 6,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1e293b",
              borderRadius: 8,
              padding: "4px 6px",
              display: "flex",
              gap: 2,
              pointerEvents: "all",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              zIndex: 12,
            }}
          >
            {/* Float options */}
            {([
              { f: "none" as ImageFloat,   icon: "⬜", title: "Bloco" },
              { f: "center" as ImageFloat, icon: "⬛", title: "Centralizar" },
              { f: "left" as ImageFloat,   icon: "◧",  title: "Flutuar esquerda" },
              { f: "right" as ImageFloat,  icon: "◨",  title: "Flutuar direita" },
            ]).map(opt => (
              <button
                key={opt.f} type="button" title={opt.title}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); changeImgFloat(opt.f); }}
                style={{
                  width: 26, height: 26, borderRadius: 5, border: "none", cursor: "pointer", fontSize: 13,
                  background: imgFloat === opt.f ? "#2563eb" : "transparent",
                  color: "#fff",
                }}
              >{opt.icon}</button>
            ))}
            <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "3px 2px" }} />
            {/* Size display */}
            <span style={{ fontSize: 10, color: "#94a3b8", padding: "0 4px", lineHeight: "26px" }}>
              {Math.round(imgRect.w)}×{Math.round(imgRect.h)}
            </span>
            <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "3px 2px" }} />
            {/* Delete */}
            <button
              type="button" title="Remover imagem"
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); deleteSelectedImg(); }}
              style={{ width: 26, height: 26, borderRadius: 5, border: "none", cursor: "pointer", background: "transparent", color: "#f87171", fontSize: 14 }}
            >✕</button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {showLinkDialog && <LinkDialog onConfirm={insertLink} onClose={() => setShowLinkDialog(false)} />}
      {showImageDialog && <ImageDialog onConfirm={(url, alt, width, float) => insertImage(url, alt, width, float)} onClose={() => setShowImageDialog(false)} />}

      <style>{`
        .rich-editor-content:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .rich-editor-content h1 { font-size: 2em; font-weight: 900; margin: 0.8em 0 0.4em; color: #111; }
        .rich-editor-content h2 { font-size: 1.5em; font-weight: 800; margin: 0.8em 0 0.4em; color: #111; }
        .rich-editor-content h3 { font-size: 1.25em; font-weight: 700; margin: 0.7em 0 0.3em; color: #111; }
        .rich-editor-content h4 { font-size: 1.1em; font-weight: 700; margin: 0.6em 0 0.3em; color: #111; }
        .rich-editor-content p { margin: 0 0 0.8em; }
        .rich-editor-content ul, .rich-editor-content ol { padding-left: 1.5em; margin: 0 0 0.8em; }
        .rich-editor-content li { margin-bottom: 0.2em; }
        .rich-editor-content blockquote {
          border-left: 3px solid #f59e0b; padding: 10px 16px;
          background: #fffbeb; margin: 1em 0; border-radius: 0 8px 8px 0;
          font-style: italic; color: #374151;
        }
        .rich-editor-content pre {
          background: #1e293b; color: #e2e8f0; padding: 16px 20px;
          border-radius: 10px; font-family: monospace; font-size: 13px;
          overflow-x: auto; margin: 1em 0;
        }
        .rich-editor-content img {
          max-width: 100%; border-radius: 10px; cursor: pointer;
        }
        .rich-editor-content img:hover { outline: 2px solid #2563eb; outline-offset: 2px; }
        .rich-editor-content a { color: #2563eb; font-weight: 500; text-decoration: none; }
        .rich-editor-content a:hover { text-decoration: underline; }
        .rich-editor-content table { width: 100%; border-collapse: collapse; }
        .rich-editor-content td, .rich-editor-content th {
          border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 13px;
        }
        .rich-editor-content th { background: #f9fafb; font-weight: 700; }
        .rich-editor-content hr { border: none; border-top: 2px solid #e5e7eb; margin: 20px 0; }
      `}</style>
    </div>
  );
}
