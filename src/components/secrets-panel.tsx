import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import type { ProjectSecret } from "@/lib/types";

type SecretsPanelProps = {
  projectId: string;
};

export function SecretsPanel({ projectId }: SecretsPanelProps) {
  const [secrets, setSecrets] = useState<ProjectSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSecrets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/secrets`);
      if (!res.ok) throw new Error("Failed to load secrets");
      const data = await res.json();
      setSecrets(data.secrets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSecrets();
  }, [fetchSecrets]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newValue) return;
    
    try {
      setSaving(true);
      const res = await fetch(`/api/projects/${projectId}/secrets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, value: newValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save secret");
      }
      setNewName("");
      setNewValue("");
      await fetchSecrets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save secret");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the secret ${name}?`)) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/projects/${projectId}/secrets?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete secret");
      await fetchSecrets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete secret");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-white/40">Loading secrets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
        <p className="text-[13px] text-red-400">{error}</p>
        <button type="button" onClick={fetchSecrets} className="cognix-button-secondary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0a0a0a]">
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-white">Secrets & Environment</h2>
          <p className="text-[13px] text-white/60">
            Add API keys and other secrets. They will be encrypted at rest and synced to your development sandbox as `.env.local`.
          </p>
        </div>

        <form onSubmit={handleSave} className="mb-10 rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <h3 className="mb-4 text-[14px] font-medium text-white">Add or replace a secret</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="secret-name" className="mb-1.5 block text-[12px] font-medium text-white/80">Name</label>
              <input
                id="secret-name"
                type="text"
                required
                pattern="^[A-Z][A-Z0-9_]{0,63}$"
                title="Uppercase letters, numbers, and underscores only"
                placeholder="OPENAI_API_KEY"
                value={newName}
                onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                className="cognix-text-input w-full font-mono text-[13px]"
              />
            </div>
            <div>
              <label htmlFor="secret-value" className="mb-1.5 block text-[12px] font-medium text-white/80">Value</label>
              <input
                id="secret-value"
                type="password"
                required
                placeholder="sk-..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="cognix-text-input w-full font-mono text-[13px]"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving || !newName || !newValue}
              className="cognix-button-primary inline-flex items-center gap-1.5"
            >
              {saving ? "Saving..." : <><Plus className="size-3.5" /> Save secret</>}
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-white/10 bg-[#0f0f0f]">
          {secrets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-white/[0.05]">
                <KeyRound className="size-5 text-white/40" />
              </div>
              <p className="text-[13px] font-medium text-white">No secrets yet</p>
              <p className="mt-1 max-w-[250px] text-[13px] text-white/50">
                Secrets you add will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-white/60">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {secrets.map((secret) => (
                    <tr key={secret.name} className="group transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="font-mono text-white/90">{secret.name}</span>
                        {secret.managedBy === "cloud" && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                            Managed by Cloud
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-white/40">••••••••••••••••</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {secret.managedBy === "user" ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(secret.name)}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-white/40 transition hover:bg-white/10 hover:text-white"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        ) : (
                          <span className="text-[12px] text-white/30">Managed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
