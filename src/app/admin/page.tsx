// ...imports
import EditUserDialog from "./EditUserDialog";
import { useCallback, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  isActive: boolean;
  // ... many other fields you don't want to pass
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // derive a compact view model for the list (stable identities via useMemo)
  const listItems = useMemo(
    () =>
      users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
      })),
    [users]
  );

  const handleOpenEdit = useCallback((id: string) => setEditingUserId(id), []);
  const handleCloseEdit = useCallback(() => setEditingUserId(null), []);

  // find the *small* payload to pass to the dialog
  const editingUser = useMemo(
    () => listItems.find(u => u.id === editingUserId) ?? null,
    [listItems, editingUserId]
  );

  const handleSave = useCallback(async (input: {
    id: string;
    name: string;
    email: string;
    role: User["role"];
    isActive: boolean;
  }) => {
    // ...perform update (db), then setUsers(prev => ...)
    handleCloseEdit();
  }, [handleCloseEdit]);

  return (
    <>
      {/* ...your table/list */}
      {listItems.map(u => (
        <div key={u.id} className="flex items-center gap-2">
          <div className="flex-1">
            <div className="font-medium">{u.name}</div>
            <div className="text-sm text-muted-foreground">{u.email}</div>
          </div>
          <button onClick={() => handleOpenEdit(u.id)} className="btn">
            Edit
          </button>
        </div>
      ))}

      <EditUserDialog
        // ⬇️ pass only what the dialog needs
        open={!!editingUser}
        onOpenChange={(open) => (open ? null : handleCloseEdit())}
        id={editingUser?.id ?? ""}
        name={editingUser?.name ?? ""}
        email={editingUser?.email ?? ""}
        role={editingUser?.role ?? "viewer"}
        isActive={editingUser?.isActive ?? false}
        onSave={handleSave}
      />
    </>
  );
}
