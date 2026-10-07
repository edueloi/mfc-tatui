import React from 'react';
import { Modal } from './ui/Modal';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
}

const ModalShell: React.FC<ModalShellProps> = ({
  title,
  subtitle,
  onClose,
  children,
  maxWidthClassName = 'max-w-3xl'
}) => {
  return (
    <Modal isOpen onClose={onClose} title={title} size="xl" className={maxWidthClassName}>
      {subtitle && <p className="text-xs text-slate-500 mb-3">{subtitle}</p>}
      {children}
    </Modal>
  );
};

export default ModalShell;
