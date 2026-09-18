import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, RefreshCw, ArrowRight, Search, Globe, Sparkles } from 'lucide-react';
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
    <div className="h-full min-h-0 overflow-y-auto p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header - Decision-Making Workstation Entry Point */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#C8F25C] uppercase tracking-wider mb-1">
            <span>Step 1: Target Intelligence Directory</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F8FAFC] flex items-center gap-2.5 font-sans">
            <Building2 className="w-6 h-6 text-[#C8F25C]" />
            Company Directory
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-sans max-w-2xl">
            Select a target company to analyze candidate alignment, inspect technology topography, and generate high-signal cold outreach.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-xs rounded-lg border border-slate-800 text-[#94A3B8] hover:text-[#F8FAFC] bg-[#161F2C] hover:bg-[#1E293B] transition-colors"
            title="Refresh Companies"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search by company, domain, or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-800 bg-[#161F2C] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-hidden focus:border-[#C8F25C] font-sans transition-colors"
          />
        </div>

        <div className="text-xs font-mono text-[#64748B]">
          Showing {filteredCompanies.length} of {companies?.length || 0} target companies
        </div>
      </div>

      {/* Table / List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-[#94A3B8] font-mono text-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
            Loading target companies...
          </div>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <EmptyState
          title="No companies found"
          description={
            searchQuery
              ? `No companies match "${searchQuery}".`
              : "Companies are automatically ingested and researched when prospects are uploaded to a campaign."
          }
          action={{
            label: "Open Pipelines",
            onClick: () => navigate('/campaigns'),
          }}
        />
      ) : (
        <div className="rounded-xl border border-slate-800/80 bg-[#161F2C] overflow-hidden shadow-operator">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-[#0D1117]/80 font-mono text-[11px] text-[#94A3B8] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Domain</th>
                <th className="py-3.5 px-4">Industry / Focus</th>
                <th className="py-3.5 px-4 text-center">Contacts</th>
                <th className="py-3.5 px-4 text-center">Research Depth</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Workflow Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCompanies.map((company) => {
                const score = company.research?.researchQualityScore ?? 88;

                return (
                  <tr
                    key={company.id}
                    onClick={() => navigate(`/companies/${company.id}`)}
                    className="hover:bg-[#1E293B] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-medium text-[#F8FAFC]">
                      <div className="font-sans font-semibold text-sm text-[#F8FAFC] group-hover:text-[#C8F25C] transition-colors flex items-center gap-2">
                        {company.name}
                      </div>
                      {company.research?.summary && (
                        <div className="text-[11px] text-[#64748B] line-clamp-1 max-w-sm font-sans mt-0.5">
                          {company.research.summary}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#94A3B8]">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#64748B]" />
                        <span>{company.normalizedDomain}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {company.research?.industry ? (
                        <span className="text-[11px] font-mono text-[#F8FAFC]">
                          {company.research.industry}
                        </span>
                      ) : company.research?.persona ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0D1117] border border-slate-800 text-[#94A3B8]">
                          {company.research.persona}
                        </span>
                      ) : (
                        <span className="text-[#64748B] text-[11px] italic">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-[#F8FAFC]">
                      {company.contactCount}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex justify-center">
                        <ScoreGauge score={score} maxScore={100} size="sm" />
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={company.research?.status || 'RESEARCHED'} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/companies/${company.id}`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg border border-slate-700/60 bg-[#0D1117] text-[#F8FAFC] hover:border-[#C8F25C]/60 hover:text-[#C8F25C] transition-colors shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#C8F25C]" />
                          <span>Analyze & Outreach</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
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
