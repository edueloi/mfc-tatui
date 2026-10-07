// ── Interação ──────────────────────────────────────────────────────────────
export { Button, IconButton } from './Button';
export { Modal, ModalFooter, ConfirmModal } from './Modal';
export type { ModalProps } from './Modal';

// ── Formulários ────────────────────────────────────────────────────────────
export { Input, Textarea, Select } from './Input';
export { CepInput } from './CepInput';
export type { CepAddress } from './CepInput';
export { Switch } from './Switch';
export { DatePicker } from './DatePicker';
export { Calendar } from './Calendar';
export { Combobox } from './Combobox';
export { RichTextEditor } from './RichTextEditor';
export { FileUpload } from './FileUpload';
export type { UploadedFileItem } from './FileUpload';

// ── Feedback ───────────────────────────────────────────────────────────────
export { Toast, ToastProvider, useToast } from './Toast';
export type { ToastType } from './Toast';
export { Badge, StatusBadge, PaymentBadge } from './Badge';

// ── Layout / Estrutura ─────────────────────────────────────────────────────
export { PageWrapper, SectionTitle, StatGrid, ContentCard, FormRow, Divider } from './PageWrapper';
export { PanelCard } from './PanelCard';
export { DetailField } from './DetailField';
export { Tabs } from './Tabs';
export { EmptyState } from './EmptyState';

// ── Dados ──────────────────────────────────────────────────────────────────
export { StatCard } from './StatCard';
export { GridTable } from './GridTable';
export type { Column, GridTableProps } from './GridTable';
export { Pagination, usePagination } from './Pagination';
export type { PaginationProps, UsePaginationReturn } from './Pagination';

// ── Filtros / Toolbar ──────────────────────────────────────────────────────
export {
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineGroup,
  FilterLineSegmented,
  FilterLineViewToggle,
  FilterLineSearch,
  FilterLineDateRange,
} from './FilterLine';

// ── Pagamentos ─────────────────────────────────────────────────────────────
export { PaymentModal } from './PaymentModal';

// ── Utilitários de edição ──────────────────────────────────────────────────
export { TokenTextarea } from './TokenTextarea';
