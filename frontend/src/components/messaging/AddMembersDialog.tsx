import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Avatar from '@/components/common/Avatar';
import Spinner from '@/components/common/Spinner';
import { useGroupable } from '@/features/messaging/hooks/useGroupable';
import { useAddMembers } from '@/features/messaging/hooks/useAddMembers';
import type { GroupableUser } from '@/types/api';

interface AddMembersDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  existingMemberIds: string[];
}

// Open permission: any member adds anyone. Up to 20 per call (server cap).
const MAX_ADD = 20;

// Group management — add members to an existing group. Mirrors GroupCreateModal (search recent +
// mutual → multi-select → submit) minus the name field, and filters out people already in the group.
export default function AddMembersDialog({
  open,
  onClose,
  conversationId,
  existingMemberIds,
}: AddMembersDialogProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<GroupableUser[]>([]);
  const add = useAddMembers(conversationId);

  // Debounce the search term (300ms) before it drives the query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useGroupable(debounced, open);
  const existing = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);
  // Hide people already in the group.
  const users = useMemo(() => (data ?? []).filter((u) => !existing.has(u.id)), [data, existing]);
  const recent = users.filter((u) => u.source === 'recent');
  const mutual = users.filter((u) => u.source === 'mutual');

  const selectedIds = new Set(selected.map((u) => u.id));
  const atMax = selected.length >= MAX_ADD;
  const canAdd = selected.length >= 1 && !add.isPending;

  const reset = () => {
    setSearch('');
    setDebounced('');
    setSelected([]);
  };

  const toggle = (user: GroupableUser) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : prev.length >= MAX_ADD
          ? prev // at cap — ignore
          : [...prev, user],
    );
  };

  const handleAdd = () => {
    if (!canAdd) return;
    add.mutate(
      { userIds: selected.map((u) => u.id) },
      {
        onSuccess: () => {
          onClose();
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogTitle className="border-b px-4 py-3">Add members</DialogTitle>

        {/* Selected pills (removable). */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b p-3">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-full bg-muted py-1 pl-1 pr-2 text-xs"
              >
                <Avatar user={u} size="xs" />
                <span className="max-w-[8rem] truncate font-medium">{u.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${u.name}`}
                  onClick={() => toggle(u)}
                  className="grid size-4 place-items-center rounded-full hover:bg-background"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search. */}
        <div className="border-b p-3">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Suggestion list. */}
        <div className="max-h-[40vh] min-h-[8rem] overflow-y-auto">
          {isLoading ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <EmptyState searching={debounced.length > 0} />
          ) : (
            <>
              <Section title="Recent" users={recent} selectedIds={selectedIds} atMax={atMax} onToggle={toggle} />
              <Section title="Mutual followers" users={mutual} selectedIds={selectedIds} atMax={atMax} onToggle={toggle} />
            </>
          )}
        </div>

        {/* Footer. */}
        <div className="border-t p-3">
          <button
            type="button"
            disabled={!canAdd}
            onClick={handleAdd}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {add.isPending
              ? 'Adding…'
              : selected.length < 1
                ? 'Select people to add'
                : `Add ${selected.length}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center">
      <Users className="size-7 text-muted-foreground" />
      <p className="px-6 text-sm text-muted-foreground">
        {searching
          ? 'No matches among your recent chats or mutual follows.'
          : 'No one to add — everyone you know is already in this group.'}
      </p>
    </div>
  );
}

interface SectionProps {
  title: string;
  users: GroupableUser[];
  selectedIds: Set<string>;
  atMax: boolean;
  onToggle: (user: GroupableUser) => void;
}

function Section({ title, users, selectedIds, atMax, onToggle }: SectionProps) {
  if (users.length === 0) return null;
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul>
        {users.map((u) => {
          const checked = selectedIds.has(u.id);
          const disabled = atMax && !checked;
          return (
            <li key={u.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(u)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-40"
              >
                <Avatar user={u} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                </span>
                <span
                  className={
                    checked
                      ? 'grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground'
                      : 'size-5 shrink-0 rounded-full border'
                  }
                >
                  {checked && <Check className="size-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
