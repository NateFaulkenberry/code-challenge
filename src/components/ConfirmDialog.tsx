import { useId, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const descriptionId = useId();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      describedBy={descriptionId}
      footer={
        <>
          <Button onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div id={descriptionId}>{children}</div>
    </Dialog>
  );
}
