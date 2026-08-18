import Link from "next/link";

export default function SheetPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
}) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        {totalCount === 0
          ? "No matching rows"
          : `Showing ${start}–${end} of ${totalCount}`}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={hrefForPage(Math.max(page - 1, 1))}
          aria-disabled={page <= 1}
          className={`inline-flex min-h-11 items-center rounded-md border px-3 ${
            page <= 1
              ? "pointer-events-none border-border text-muted-foreground/60"
              : "border-border text-foreground hover:bg-muted"
          }`}
        >
          Previous
        </Link>
        <span className="tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Link
          href={hrefForPage(Math.min(page + 1, totalPages))}
          aria-disabled={page >= totalPages}
          className={`inline-flex min-h-11 items-center rounded-md border px-3 ${
            page >= totalPages
              ? "pointer-events-none border-border text-muted-foreground/60"
              : "border-border text-foreground hover:bg-muted"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
