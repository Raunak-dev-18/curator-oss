"use client";

import { CircleAlert, CircleCheck, Copy, Globe2, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { DomainDnsRecord, ProjectDomainView } from "@/lib/types";
import { cn } from "@/lib/utils";

type CustomDomainsPanelProps = {
  projectId: string;
  published: boolean;
  disabled: boolean;
  /** Changing this value reloads the list, for example after a deployment finishes. */
  refreshKey?: number;
};

type LoadState = "loading" | "ready" | "error";

function statusLabel(domain: ProjectDomainView) {
  if (domain.status === "active") return "Live";
  if (domain.status === "error") return "Needs attention";
  return "Waiting for DNS";
}

function RecordRow({ record }: { record: DomainDnsRecord }) {
  return (
    <div className="domain-record">
      <span className="domain-record-type">{record.type}</span>
      <div className="domain-record-values">
        <button
          type="button"
          title={`Copy record name ${record.name}`}
          onClick={() => {
            void navigator.clipboard.writeText(record.name);
            toast.success("Record name copied.");
          }}
        >
          <span>{record.name}</span>
          <Copy className="size-3" aria-hidden="true" />
          <span className="sr-only">Copy record name</span>
        </button>
        <button
          type="button"
          title={`Copy record value ${record.value}`}
          onClick={() => {
            void navigator.clipboard.writeText(record.value);
            toast.success("Record value copied.");
          }}
        >
          <span>{record.value}</span>
          <Copy className="size-3" aria-hidden="true" />
          <span className="sr-only">Copy record value</span>
        </button>
      </div>
      <span className="domain-record-ttl">TTL {record.ttl}</span>
    </div>
  );
}

export function CustomDomainsPanel({ projectId, published, disabled, refreshKey = 0 }: CustomDomainsPanelProps) {
  const [domains, setDomains] = useState<ProjectDomainView[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/domains`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load custom domains.");
    return payload.domains as ProjectDomainView[];
  }, [projectId]);

  useEffect(() => {
    let active = true;
    fetchDomains()
      .then((next) => {
        if (!active) return;
        setDomains(next);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadState("error");
        toast.error(error instanceof Error ? error.message : "Could not load custom domains.");
      });
    return () => {
      active = false;
    };
  }, [fetchDomains, refreshKey]);

  async function reloadDomains() {
    setLoadState("loading");
    try {
      setDomains(await fetchDomains());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      toast.error(error instanceof Error ? error.message : "Could not load custom domains.");
    }
  }

  async function addDomain() {
    const value = hostname.trim();
    if (!value || adding) return;
    setAdding(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not attach that domain.");
      const domain = payload.domain as ProjectDomainView;
      setDomains((current) => [...current.filter((item) => item.id !== domain.id), domain]);
      setHostname("");
      toast.success(
        payload.managed === true
          ? `${domain.hostname} attached. Cognix created its DNS records.`
          : `${domain.hostname} attached. Add the DNS records below, then check DNS.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not attach that domain.");
    } finally {
      setAdding(false);
    }
  }

  async function verifyDomain(domain: ProjectDomainView) {
    if (busyDomainId) return;
    setBusyDomainId(domain.id);
    try {
      const response = await fetch(`/api/projects/${projectId}/domains/${domain.id}/verify`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not check DNS for that domain.");
      const updated = payload.domain as ProjectDomainView;
      setDomains((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.status === "active") {
        toast.success(
          typeof payload.warning === "string" ? payload.warning : `${updated.hostname} is live for this project.`,
        );
      } else {
        toast.message(updated.lastError ?? "DNS is not ready yet. Check again in a few minutes.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check DNS for that domain.");
    } finally {
      setBusyDomainId(null);
    }
  }

  async function removeDomain(domain: ProjectDomainView) {
    if (busyDomainId) return;
    if (!window.confirm(`Detach ${domain.hostname}? Visitors will see a "not published" page.`)) return;
    setBusyDomainId(domain.id);
    try {
      const response = await fetch(`/api/projects/${projectId}/domains/${domain.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not detach that domain.");
      setDomains((current) => current.filter((item) => item.id !== domain.id));
      toast.success(`${domain.hostname} detached.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not detach that domain.");
    } finally {
      setBusyDomainId(null);
    }
  }

  return (
    <section className="domain-panel" aria-labelledby="custom-domains-heading">
      <header>
        <div>
          <strong id="custom-domains-heading">Custom domains</strong>
          <p>Serve this published app on a domain you own.</p>
        </div>
        <button
          type="button"
          onClick={() => void reloadDomains()}
          disabled={loadState === "loading"}
          aria-label="Reload custom domains"
          title="Reload custom domains"
        >
          <RefreshCw className={cn("size-3.5", loadState === "loading" && "animate-spin")} aria-hidden="true" />
        </button>
      </header>

      <div className="domain-add-row">
        <label className="sr-only" htmlFor="custom-domain-input">
          Domain to attach
        </label>
        <input
          id="custom-domain-input"
          value={hostname}
          onChange={(event) => setHostname(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void addDomain();
          }}
          placeholder="app.example.com"
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
          disabled={disabled || adding}
        />
        <button type="button" onClick={() => void addDomain()} disabled={disabled || adding || !hostname.trim()}>
          {adding ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-3.5" aria-hidden="true" />
          )}
          Attach
        </button>
      </div>

      {loadState === "loading" && !domains.length ? (
        <p className="domain-empty">Loading attached domains…</p>
      ) : null}

      {loadState === "error" && !domains.length ? (
        <p className="domain-empty">
          Custom domains could not be loaded.{" "}
          <button type="button" className="domain-inline-button" onClick={() => void reloadDomains()}>
            Try again
          </button>
        </p>
      ) : null}

      {loadState === "ready" && !domains.length ? (
        <p className="domain-empty">
          No custom domain yet. Attach one to publish on your own address instead of a Cognix subpath.
        </p>
      ) : null}

      <ul className="domain-list">
        {domains.map((domain) => {
          const busy = busyDomainId === domain.id;
          return (
            <li key={domain.id} className={cn("domain-item", `is-${domain.status}`)}>
              <div className="domain-item-head">
                <span className="domain-item-name">
                  <Globe2 className="size-3.5" aria-hidden="true" />
                  {domain.status === "active" ? (
                    <a href={domain.url} target="_blank" rel="noreferrer">
                      {domain.hostname}
                    </a>
                  ) : (
                    <span>{domain.hostname}</span>
                  )}
                </span>
                <span className={cn("domain-status", `is-${domain.status}`)}>
                  {domain.status === "active" ? (
                    <CircleCheck className="size-3" aria-hidden="true" />
                  ) : (
                    <CircleAlert className="size-3" aria-hidden="true" />
                  )}
                  {statusLabel(domain)}
                </span>
                <div className="domain-item-actions">
                  <button type="button" onClick={() => void verifyDomain(domain)} disabled={busy}>
                    {busy ? (
                      <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="size-3" aria-hidden="true" />
                    )}
                    Check DNS
                  </button>
                  <button
                    type="button"
                    className="domain-remove-button"
                    onClick={() => void removeDomain(domain)}
                    disabled={busy}
                    aria-label={`Detach ${domain.hostname}`}
                    title={`Detach ${domain.hostname}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {domain.status === "active" && !published ? (
                <p className="domain-message">DNS is ready. Publish this project to serve it on this domain.</p>
              ) : null}
              {domain.status !== "active" && domain.lastError ? (
                <p className="domain-message">{domain.lastError}</p>
              ) : null}

              {domain.status === "active" ? null : (
                <div className="domain-records">
                  <p>
                    {domain.managedByProvider
                      ? "Cognix manages these records for you. Check DNS to confirm they resolved."
                      : "Create these records with your DNS provider, then check DNS."}
                  </p>
                  {domain.records.map((record) => (
                    <RecordRow key={`${record.type}-${record.name}`} record={record} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
