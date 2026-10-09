import { useRef, useState } from 'react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Tabs } from './Tabs';
import { Alert } from './Alert';

export type ImageFloat = 'none' | 'left' | 'right' | 'center';

export function LinkDialog({ onConfirm, onClose }: {
  onConfirm: (url: string, text: string) => void; onClose: () => void;
}) {
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState('');
  const valid = /^(https?:\/\/\S+|mailto:\S+|tel:[+\d\s()-]+|\/(?!\/)\S*|#\S+)$/i.test(url.trim());
  return <Modal isOpen onClose={onClose} title="Inserir hiperlink" size="sm" footer={
    <ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button>
      <Button disabled={!valid} onClick={() => { onConfirm(url.trim(), text); onClose(); }}>Inserir link</Button>
    </ModalFooter>}>
    <div className="space-y-3">
      <Input label="Texto do link" value={text} onChange={event => setText(event.target.value)} placeholder="Texto opcional" />
      <Input label="Endereço do link" type="text" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." hint="Informe um endereço, e-mail (mailto:) ou telefone (tel:)." />
    </div>
  </Modal>;
}

const positions: { value: ImageFloat; label: string }[] = [
  { value: 'none', label: 'Bloco' }, { value: 'center', label: 'Centro' },
  { value: 'left', label: 'Esquerda' }, { value: 'right', label: 'Direita' },
];
const widths = ['25%', '33%', '50%', '66%', '75%', '100%', '200px', '300px', '400px', '500px'];

export function ImageDialog({ onConfirm, onClose }: {
  onConfirm: (url: string, alt: string, width: string, float: ImageFloat) => void; onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [width, setWidth] = useState('100%');
  const [float, setFloat] = useState<ImageFloat>('none');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'url' | 'file'>('url');
  const validWidth = /^(?:\d+(?:\.\d+)?)(?:%|px)$/.test(width.trim()) && parseFloat(width) > 0;
  const validUrl = /^(https?:\/\/\S+|data:image\/|\/(?!\/)\S+)/i.test(url.trim());
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Selecione um arquivo de imagem.'); return; }
    setUploading(true); setError('');
    const reader = new FileReader();
    reader.onload = () => { setUrl(String(reader.result)); setUploading(false); };
    reader.onerror = () => { setError('Não foi possível ler a imagem. Tente novamente.'); setUploading(false); };
    reader.readAsDataURL(file);
  };
  return <Modal isOpen onClose={onClose} title="Inserir imagem" size="md" footer={
    <ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button>
      <Button disabled={!validUrl || !validWidth || uploading} onClick={() => { onConfirm(url.trim(), alt, width.trim(), float); onClose(); }}>Inserir imagem</Button>
    </ModalFooter>}>
    <div className="space-y-4">
      <Tabs<'url' | 'file'> items={[{ id: 'url', label: 'Endereço da imagem' }, { id: 'file', label: 'Do dispositivo' }]} value={tab} onChange={setTab} label="Origem da imagem">
        {tab === 'url' ? <Input label="Endereço da imagem" value={url} onChange={event => { setUrl(event.target.value); setError(''); }} placeholder="https://exemplo.com/imagem.jpg" /> : <>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) handleFile(file); }} />
          <Button variant="outline" fullWidth loading={uploading} onClick={() => fileInputRef.current?.click()}>Escolher imagem</Button>
        </>}
      </Tabs>
      {error && <Alert variant="error">{error}</Alert>}
      <Input label="Descrição da imagem" value={alt} onChange={event => setAlt(event.target.value)} placeholder="Descreva a foto para quem não pode vê-la" />
      <div className="space-y-2">
        <Input label="Largura inicial" value={width} onChange={event => setWidth(event.target.value)} placeholder="50% ou 300px" error={!validWidth ? 'Use uma largura positiva em % ou px.' : undefined} />
        <div className="flex flex-wrap gap-1.5">{widths.map(value => <Button key={value} size="xs" variant={width === value ? 'primary' : 'outline'} aria-pressed={width === value} onClick={() => setWidth(value)}>{value}</Button>)}</div>
      </div>
      <fieldset className="min-w-0"><legend className="ds-label mb-2">Posição no texto</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{positions.map(position => <Button key={position.value} variant={float === position.value ? 'primary' : 'outline'} aria-pressed={float === position.value} onClick={() => setFloat(position.value)}>{position.label}</Button>)}</div>
      </fieldset>
      {validUrl && <div className="rounded-lg border border-slate-200 bg-slate-50 p-2"><img key={url} src={url} alt={alt || 'Prévia da imagem'} className="mx-auto max-h-36 max-w-full object-contain" /></div>}
    </div>
  </Modal>;
}
