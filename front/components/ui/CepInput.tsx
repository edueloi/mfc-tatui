import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from './Input';
import { api } from '../../api';
import { maskCEP, unmask } from '../../utils/masks';

export interface CepAddress { cep: string; logradouro: string; bairro: string; localidade: string; uf: string; complemento?: string; }
interface CepInputProps { value: string; onChange: (value: string) => void; onAddress: (address: CepAddress) => void; }

export function CepInput({ value, onChange, onAddress }: CepInputProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const previous = useRef(unmask(value || ''));
  const addressCallback = useRef(onAddress);
  addressCallback.current = onAddress;
  useEffect(() => {
    const cep = unmask(value || '');
    if (cep === previous.current) return;
    previous.current = cep;
    let cancelled = false;
    setState('idle');
    setMessage('');
    if (cep.length !== 8) return;
    const timer = setTimeout(async () => {
      setState('loading');
      try {
        const result = await api.buscarCEP(cep);
        if (cancelled) return;
        addressCallback.current(result);
        setState('success');
        setMessage(result.logradouro ? 'Endereço preenchido. Informe o número e confira o complemento.' : 'Cidade e estado preenchidos. Informe a rua, o bairro e o número.');
      } catch (error) {
        if (cancelled) return;
        setState('error');
        setMessage((error instanceof Error ? error.message : 'Não foi possível consultar o CEP.') + ' Você pode preencher o endereço manualmente.');
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value]);
  return <div aria-live="polite"><Input label="CEP" value={value} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} showCount={false}
    onChange={event => onChange(maskCEP(event.target.value))}
    iconRight={state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
    error={state === 'error' ? message : undefined}
    hint={state === 'loading' ? 'Buscando endereço…' : message || 'Digite os 8 números para preencher o endereço.'} /></div>;
}
