import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, RefreshCw, ExternalLink, ArrowRight, Search, Globe } from 'lucide-react';
import { companyService } from '../services/companyService';
import { StatusBadge } from '../components/common/StatusBadge';
import { ScoreGauge } from '../components/common/ScoreGauge';
import { EmptyState } from '../components/common/EmptyState';

export const CompaniesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: companies, isLoading, refetch } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => companyService.getAll(),
  });

  const filteredCompanies = (companies || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.normalizedDomain.toLowerCase().includes(q) ||
      (c.research?.industry && c.research.industry.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-relay-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-relay-text flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-relay-accent" />
            Target Companies
          </h1>
          <p className="text-xs text-relay-muted mt-1">
            Researched company intelligence, technology stack signatures, hiring signals, and outreach hooks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-xs rounded border border-relay-border text-relay-muted hover:text-relay-text bg-relay-card transition-colors"
            title="Refresh Companies"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-relay-subtle" />
          <input
            type="text"
            placeholder="Search by company or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-relay-border bg-relay-card text-relay-text placeholder:text-relay-subtle focus:outline-hidden focus:border-relay-accent font-sans"
          />
        </div>

        <div className="text-xs font-mono text-relay-subtle">
          Showing {filteredCompanies.length} of {companies?.length || 0} companies
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
          Loading target companies...
        </div>
      ) : filteredCompanies.length === 0 ? (
        <EmptyState
          title="No companies found"
          description={
            searchQuery
              ? `No companies match "${searchQuery}".`
              : "Companies are automatically registered and researched when you upload prospects to a campaign."
          }
          action={{
            label: "Open Campaigns",
            onClick: () => navigate('/campaigns'),
          }}
        />
      ) : (
        <div className="rounded-lg border border-relay-border bg-relay-card overflow-hidden shadow-operator">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-relay-border bg-relay-bg/60 font-mono text-[11px] text-relay-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Industry / Persona</th>
                <th className="py-3 px-4 text-center">Contacts</th>
                <th className="py-3 px-4 text-center">Research Quality</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-relay-border/60">
              {filteredCompanies.map((company) => {
                const score = company.research?.researchQualityScore ?? 0;

                return (
                  <tr
                    key={company.id}
                    onClick={() => navigate(`/companies/${company.id}`)}
                    className="hover:bg-relay-card-hover/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-medium text-relay-text">
                      <div className="font-sans font-medium text-relay-text flex items-center gap-1.5">
                        {company.name}
                      </div>
                      {company.research?.summary && (
                        <div className="text-[11px] text-relay-subtle line-clamp-1 max-w-sm">
                          {company.research.summary}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-relay-muted">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-relay-subtle" />
                        <span>{company.normalizedDomain}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {company.research?.industry ? (
                        <span className="text-[11px] font-mono text-relay-text">
                          {company.research.industry}
                        </span>
                      ) : company.research?.persona ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-muted">
                          {company.research.persona}
                        </span>
                      ) : (
                        <span className="text-relay-subtle text-[11px] italic">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-relay-text">
                      {company.contactCount}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex justify-center">
                        <ScoreGauge score={score} maxScore={100} size="sm" />
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={company.research?.status || 'PENDING'} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/companies/${company.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded border border-relay-border bg-relay-bg text-relay-text hover:border-relay-accent hover:text-relay-accent transition-colors"
                      >
                        Intelligence
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
