import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileStack, Trash2, Download, Users } from 'lucide-react';
import { adminApi, resourceApi } from '../../api';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Badge, PageHeader, Pagination, SearchInput } from '../../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { FileIcon } from '../../components/resources/ResourceCard';
import { fmtBytes, timeAgo } from '../../utils/format';

export default function AdminResources() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounce(search);
  const list = useAsync(() => adminApi.resources({ search: q || undefined, sort, page, limit: 15 }), [q, sort, page]);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await resourceApi.remove(deleting._id);
      toast.success('Resource removed');
      setDeleting(null);
      list.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Uploaded resources" description="Monitor everything students upload and remove inappropriate content." />
      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center dark:border-ink-800">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Title, subject or file name…" className="sm:w-80" />
          <select className="select h-9 w-auto py-1 text-xs sm:ml-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="popular">Most downloaded</option>
            <option value="size">Largest files</option>
          </select>
        </div>
        {list.loading && !list.data && <SkeletonList rows={8} className="p-5" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data?.items.length === 0 && <EmptyState icon={FileStack} title="No uploads found" />}
        {list.data?.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-ink-100 text-[11px] uppercase tracking-wider text-ink-400 dark:border-ink-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">File</th>
                  <th className="px-3 py-3 font-semibold">Uploaded by</th>
                  <th className="px-3 py-3 font-semibold">Visibility</th>
                  <th className="px-3 py-3 font-semibold">Size</th>
                  <th className="px-3 py-3 font-semibold">Downloads</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {list.data.items.map((r) => (
                  <tr key={r._id} className="hover:bg-ink-50/60 dark:hover:bg-ink-850/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-800"><FileIcon name={r.file.originalName} className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{r.title}</p>
                          <p className="muted truncate text-xs">{r.subject} · Sem {r.semester} · {r.file.originalName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="font-medium">{r.uploadedBy?.name || 'Deleted user'}</p>
                      <p className="muted">{timeAgo(r.createdAt)}</p>
                    </td>
                    <td className="px-3 py-3">{r.group ? <Badge tone="violet"><Users className="h-3 w-3" /> {r.group.name}</Badge> : <Badge tone="green">Public</Badge>}</td>
                    <td className="px-3 py-3 font-mono text-xs">{fmtBytes(r.file.size)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{r.downloads}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn btn-ghost btn-icon" title="Download" onClick={() => resourceApi.download(r).catch((err) => toast.error(err.message))}><Download className="h-4 w-4" /></button>
                        <button type="button" className="btn btn-ghost btn-icon hover:text-rose-600" title="Remove" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 pb-4"><Pagination pagination={list.data?.pagination} onChange={setPage} /></div>
      </div>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={busy} title="Remove this resource?" message={`"${deleting?.title}" will be deleted from the platform and from every student's bookmarks.`} />
    </div>
  );
}
