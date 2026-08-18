"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  size = "md",
  locked = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  size?: "sm" | "md" | "lg";
  locked?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="tl-dialog"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClose={onClose}
      onCancel={(event) => {
        if (locked) event.preventDefault();
      }}
      onClick={(event) => {
        if (!locked && event.target === dialogRef.current) onClose();
      }}
    >
      <div className="tl-dialog-panel" data-size={size} role="document">
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
