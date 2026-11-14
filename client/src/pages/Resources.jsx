import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FolderOpen, UploadCloud, X } from 'lucide-react';
import { resourceApi } from '../api';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import Button from '../components/ui/Button';
import { PageHeader, Pagination, SearchInput, Tabs } from '../components/ui/Display';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import ResourceCard from '../components/resources/ResourceCard';
import UploadModal from '../components/resources/UploadModal';
import { RESOURCE_TYPES } from '../utils/constants';

const SCOPES = [
  { value: 'all', label: 'All resources' },
  { value: 'bookmarked', label: 'Bookmarked' },
  { value: 'mine', label: 'My uploads' },
];

export default function Resources() {
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ subject: '', semester: '', type: '' });
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(params.get('upload') === '1');
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounce(search);
  const highlight = params.get('open');

  const query = {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    search: q || undefined,
    mine: scope === 'mine' ? 'true' : undefined,
    bookmarked: scope === 'bookmarked' ? 'true' : undefined,
    sort,
    page,
    limit: 12,
  };
  const list = useAsync(() => resourceApi.list(query), [scope, q, filters.subject, filters.semester, filters.type, sort, page]);
  const meta = useAsync(() => resourceApi.filters(), []);

  // Arriving from global search (?open=<id>): load that single resource on top.
  const focused = useAsync(() => (highlight ? resourceApi.get(highlight) : Promise.resolve(null)), [highlight]);

  useEffect(() => {
    if (params.get('upload')) {
      params.delete('upload');
      setParams(params, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const replaceItem = (r) => list.setData((d) => ({ ...d, items: d.items.map((x) => (x._id === r._id ? r : x)) }));

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await resourceApi.remove(deleting._id);
      toast.success('Resource deleted');
      setDeleting(null);
      list.reload({ silent: true });
      meta.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = q || Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        eyebrow="Campus"
        title="Notes & resources"
        description="Study material shared by students, organised by subject and semester."
        actions={<Button icon={UploadCloud} onClick={() => setUploadOpen(true)}>Upload</Button>}
      />

      {focused.data && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">From your search</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { params.delete('open'); setParams(params); }}>
              <X className="h-3.5 w-3.5" /> Dismiss
            </button>
          </div>
          <div className="max-w-sm">
            <ResourceCard resource={focused.data} highlighted onChange={(r) => focused.setData(r)} />
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={SCOPES} value={scope} onChange={(v) => { setScope(v); setPage(1); }} />
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title, subject, tags…" className="lg:w-80" />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <select className="select h-9 w-auto py-1 text-xs" value={filters.subject} onChange={(e) => setFilter('subject', e.target.value)} aria-label="Subject">
          <option value="">All subjects</option>
          {(meta.data?.subjects || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select h-9 w-auto py-1 text-xs" value={filters.semester} onChange={(e) => setFilter('semester', e.target.value)} aria-label="Semester">
          <option value="">All semesters</option>
          {(meta.data?.semesters || []).map((s) => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        <select className="select h-9 w-auto py-1 text-xs" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilters({ subject: '', semester: '', type: '' }); setSearch(''); }}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
        <select className="select ml-auto h-9 w-auto py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="popular">Most downloaded</option>
          <option value="bookmarked">Most bookmarked</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {list.loading && !list.data && <SkeletonGrid count={6} />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data?.items.length === 0 && (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title={scope === 'bookmarked' ? 'No bookmarks yet' : hasFilters ? 'No resources match' : 'No resources yet'}
            description={scope === 'bookmarked' ? 'Tap the bookmark icon on any resource to save it here.' : 'Be the first to share study material for your subject.'}
            action={<Button icon={UploadCloud} onClick={() => setUploadOpen(true)}>Upload a file</Button>}
          />
        </div>
      )}
      {list.data?.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.data.items.map((r) => (
            <ResourceCard key={r._id} resource={r} onChange={replaceItem} onDelete={setDeleting} />
          ))}
        </div>
      )}
      <Pagination pagination={list.data?.pagination} onChange={setPage} />

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        subjects={meta.data?.subjects || []}
        onUploaded={() => { list.reload({ silent: true }); meta.reload({ silent: true }); }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete resource?"
        message={`"${deleting?.title}" and its file will be permanently removed.`}
      />
    </div>
  );
}
